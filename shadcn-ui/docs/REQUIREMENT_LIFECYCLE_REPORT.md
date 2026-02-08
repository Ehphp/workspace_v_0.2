# 📋 Report: Ciclo di Vita di un Requisito - Piattaforma Syntero

> Analisi completa del flusso dati dall'inserimento alla stima finale

---

## 🔄 Panoramica del Ciclo di Vita

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. CREAZIONE        2. AI NORMALIZATION    3. TECHNOLOGY PRESET           │
│  ┌─────────┐         ┌─────────────────┐    ┌──────────────────┐           │
│  │WizardStep1│ ──────►│ ai-suggest.ts   │────►│ WizardStep2      │          │
│  │Description│        │ normalize-req   │    │ Select Preset    │          │
│  └─────────┘         └─────────────────┘    └──────────────────┘           │
│       │                                              │                      │
│       ▼                                              ▼                      │
│  4. TECHNICAL INTERVIEW              5. DRIVERS & RISKS                    │
│  ┌─────────────────────────┐         ┌──────────────────────┐              │
│  │ ai-requirement-interview│         │ WizardStep4          │              │
│  │ + ai-estimate-from-     │────────►│ Driver/Risk Selection│              │
│  │   interview             │         └──────────────────────┘              │
│  └─────────────────────────┘                    │                          │
│                                                 ▼                          │
│  6. ESTIMATION ENGINE                  7. SAVE TO SUPABASE                 │
│  ┌──────────────────────┐              ┌────────────────────┐              │
│  │ estimationEngine.ts  │─────────────►│ api.ts             │              │
│  │ Calculate totals     │             │ saveEstimation()   │              │
│  └──────────────────────┘              └────────────────────┘              │
│                                                 │                          │
│                                                 ▼                          │
│                                        8. HISTORY & COMPARISON             │
│                                        ┌────────────────────┐              │
│                                        │ RequirementDetail  │              │
│                                        │ EstimationTimeline │              │
│                                        └────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Fase 1: Creazione del Requisito

### File Coinvolti
| File | Ruolo |
|------|-------|
| [src/components/requirements/CreateRequirementDialog.tsx](src/components/requirements/CreateRequirementDialog.tsx) | Dialog container |
| [src/components/requirements/RequirementWizard.tsx](src/components/requirements/RequirementWizard.tsx) | Wizard orchestrator (5 steps) |
| [src/components/requirements/wizard/WizardStep1.tsx](src/components/requirements/wizard/WizardStep1.tsx) | Inserimento descrizione |
| [src/hooks/useWizardState.ts](src/hooks/useWizardState.ts) | Stato persistente (localStorage) |
| [src/types/database.ts](src/types/database.ts) | Interfacce TypeScript |

### Struttura Dati `Requirement`

```typescript
// src/types/database.ts
export interface Requirement {
  id: string;                    // UUID generato da Supabase
  list_id: string;               // FK alla lista di appartenenza
  req_id: string;                // ID custom es. "HR-API-001"
  title: string;                 // Titolo (generato da AI o manuale)
  description: string;           // Descrizione dettagliata
  tech_preset_id: string;        // FK al preset tecnologico
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner: string;
  labels: string[];
  assigned_estimation_id: string | null;  // Stima assegnata
  created_at: string;
  updated_at: string;
}
```

### Stato del Wizard (`WizardData`)

```typescript
// src/hooks/useWizardState.ts
export interface WizardData {
  // Step 1 - Basilari
  description: string;           // Descrizione requisito
  title?: string;               // Titolo (opzionale, AI-generated)
  business_owner?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  
  // Step 2 - Tecnologia
  techPresetId: string;
  techCategory: string;
  
  // Step 3 - Interview
  interviewQuestions?: TechnicalQuestion[];
  interviewAnswers?: Record<string, InterviewAnswer>;
  interviewReasoning?: string;
  estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Step 4 - Activities/Drivers/Risks
  selectedActivityCodes: string[];
  aiSuggestedActivityCodes: string[];
  selectedDriverValues: Record<string, string>;
  selectedRiskCodes: string[];
  
  // AI Results
  normalizationResult?: NormalizationResult;
  activityBreakdown?: SelectedActivityWithReason[];
  suggestedDrivers?: SuggestedDriver[];
  confidenceScore?: number;
  aiAnalysis?: string;
}
```

### Input Utente (WizardStep1)

```tsx
// src/components/requirements/wizard/WizardStep1.tsx
<textarea
  id="description"
  value={data.description}
  onChange={(e) => onUpdate({ description: e.target.value })}
  maxLength={2000}
  placeholder="Describe scope, constraints, integrations, and outcomes..."
/>

// Campi addizionali
<Input id="business_owner" placeholder="John Doe" />
<Select onValueChange={(value) => onUpdate({ priority: value })}>
  <SelectItem value="LOW">Low</SelectItem>
  <SelectItem value="MEDIUM">Medium</SelectItem>
  <SelectItem value="HIGH">High</SelectItem>
</Select>
```

---

## 2️⃣ Fase 2: AI Normalization (Opzionale)

### Flusso

```
User clicks "Analyze & Improve"
       │
       ▼
useRequirementNormalization() hook
       │
       ▼
POST /.netlify/functions/ai-suggest
{
  "action": "normalize-requirement",
  "description": "..."
}
       │
       ▼
OpenAI GPT-4 (structured output)
       │
       ▼
NormalizationResult returned
```

### File Coinvolti

| File | Ruolo |
|------|-------|
| [src/hooks/useRequirementNormalization.ts](src/hooks/useRequirementNormalization.ts) | Hook React |
| [netlify/functions/ai-suggest.ts](netlify/functions/ai-suggest.ts) | Endpoint serverless |
| [netlify/functions/lib/ai/actions/normalize-requirement.ts](netlify/functions/lib/ai/actions/normalize-requirement.ts) | Logica AI |

### Risposta AI

```typescript
// src/lib/openai.ts
export interface NormalizationResult {
  isValidRequirement: boolean;
  confidence: number;              // 0-1
  originalDescription: string;
  normalizedDescription: string;   // Versione migliorata
  validationIssues: string[];      // Problemi rilevati
  transformNotes: string[];        // Note sulla trasformazione
  generatedTitle?: string;         // Titolo suggerito
}
```

---

## 3️⃣ Fase 3: Selezione Technology Preset

### File Coinvolti

| File | Ruolo |
|------|-------|
| [src/components/requirements/wizard/WizardStep2.tsx](src/components/requirements/wizard/WizardStep2.tsx) | UI selezione |
| [src/types/database.ts](src/types/database.ts) | TechnologyPreset interface |

### Struttura `TechnologyPreset`

```typescript
export interface TechnologyPreset {
  id: string;
  code: string;                          // es. "POWER_PLATFORM"
  name: string;                          // es. "Power Platform (Canvas + Dataverse)"
  description: string;
  tech_category: string;                 // POWER_PLATFORM, BACKEND, FRONTEND, MULTI
  default_driver_values: Record<string, string>;  // {COMPLEXITY: "MEDIUM"}
  default_risks: string[];               // ["RISK_INTEGRATION"]
  default_activity_codes: string[];      // ["PP_DV_ENTITY_SM", "PP_CANVAS_FORM"]
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_custom?: boolean;
  created_by?: string | null;
}
```

---

## 4️⃣ Fase 4: Technical Interview (AI-Powered)

### Flusso Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Generate Questions                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WizardStepInterview.tsx                                        │
│         │                                                        │
│         ▼                                                        │
│  useRequirementInterview() hook                                 │
│         │                                                        │
│         ▼                                                        │
│  POST /.netlify/functions/ai-requirement-interview              │
│  Body: {                                                         │
│    description: "...",                                           │
│    techPresetId: "uuid",                                         │
│    techCategory: "POWER_PLATFORM",                               │
│    projectContext?: { name, description, owner }                 │
│  }                                                               │
│         │                                                        │
│         ▼                                                        │
│  OpenAI generates 4-6 technical questions                       │
│  (structured JSON output with Zod validation)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: User Answers Questions                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RequirementInterviewStep.tsx                                   │
│         │                                                        │
│         ▼                                                        │
│  TechnicalQuestionCard.tsx (per ogni domanda)                   │
│  - single-choice (radio buttons)                                 │
│  - multiple-choice (checkboxes)                                  │
│  - range (slider con min/max/step)                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Generate Estimate from Answers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /.netlify/functions/ai-estimate-from-interview            │
│  Body: {                                                         │
│    description: "...",                                           │
│    techPresetId: "uuid",                                         │
│    techCategory: "POWER_PLATFORM",                               │
│    answers: { q1: {...}, q2: {...} },                            │
│    activities: [{ code, name, base_hours, ... }]                 │
│  }                                                               │
│         │                                                        │
│         ▼                                                        │
│  OpenAI selects activities based on answers                      │
│  Returns reasoning + confidence score                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Coinvolti

| File | Ruolo |
|------|-------|
| [src/components/requirements/wizard/WizardStepInterview.tsx](src/components/requirements/wizard/WizardStepInterview.tsx) | Container step |
| [src/components/estimation/interview/RequirementInterviewStep.tsx](src/components/estimation/interview/RequirementInterviewStep.tsx) | UI domande |
| [src/components/estimation/interview/TechnicalQuestionCard.tsx](src/components/estimation/interview/TechnicalQuestionCard.tsx) | Card singola domanda |
| [src/hooks/useRequirementInterview.ts](src/hooks/useRequirementInterview.ts) | State management |
| [netlify/functions/ai-requirement-interview.ts](netlify/functions/ai-requirement-interview.ts) | Genera domande |
| [netlify/functions/ai-estimate-from-interview.ts](netlify/functions/ai-estimate-from-interview.ts) | Genera stima |
| [src/types/requirement-interview.ts](src/types/requirement-interview.ts) | Type definitions + Zod schemas |

### Tipi di Domande

```typescript
// src/types/requirement-interview.ts
export type TechnicalQuestionCategory =
  | 'INTEGRATION'      // API, external systems
  | 'DATA'             // Volumes, structures, migrations
  | 'SECURITY'         // Auth, compliance
  | 'PERFORMANCE'      // Scalability, caching
  | 'UI_UX'            // Interface complexity
  | 'ARCHITECTURE'     // Patterns, design
  | 'TESTING'          // Coverage, E2E
  | 'DEPLOYMENT';      // CI/CD, environments

export type InterviewQuestionType = 
  | 'single-choice'    // Radio buttons
  | 'multiple-choice'  // Checkboxes
  | 'range';           // Slider (min/max/step/unit)

export interface TechnicalQuestion {
  id: string;
  type: InterviewQuestionType;
  category: TechnicalQuestionCategory;
  question: string;
  technicalContext: string;     // WHY developer needs to know
  impactOnEstimate: string;     // HOW it affects estimate
  options?: TechnicalQuestionOption[];
  required: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}
```

### Esempio Domanda Generata

```json
{
  "id": "q1_dataverse_entities",
  "type": "single-choice",
  "category": "DATA",
  "question": "Quante nuove tabelle Dataverse servono per questo requisito?",
  "technicalContext": "Il numero di entità impatta direttamente sulla modellazione dati e sui tempi di sviluppo delle form.",
  "impactOnEstimate": "1-2 tabelle: attività standard. 3-5 tabelle: +40% effort. 5+: analisi architetturale necessaria.",
  "options": [
    { "id": "few", "label": "1-2 tabelle", "impactMultiplier": 1.0 },
    { "id": "medium", "label": "3-5 tabelle", "impactMultiplier": 1.4 },
    { "id": "many", "label": "5+ tabelle", "impactMultiplier": 2.0 }
  ],
  "required": true
}
```

### Risposta Stima da Interview

```typescript
// src/types/requirement-interview.ts
export interface EstimationFromInterviewResponse {
  success: boolean;
  generatedTitle?: string;       // Titolo AI-generated
  activities: SelectedActivityWithReason[];
  totalBaseDays: number;
  reasoning: string;             // Spiegazione AI
  confidenceScore: number;       // 0-1
  suggestedDrivers?: SuggestedDriver[];
  suggestedRisks?: string[];
  error?: string;
}

export interface SelectedActivityWithReason {
  code: string;              // "PP_DV_ENTITY_SM"
  name: string;              // "Dataverse Entity (Simple)"
  baseHours: number;         // 8
  reason: string;            // "Necessaria per gestire i dati..."
  fromAnswer?: string;       // "1-2 tabelle"
  fromQuestionId?: string;   // "q1_dataverse_entities"
}
```

---

## 5️⃣ Fase 5: Motore di Stima (Deterministic Engine)

### File Principale

[src/lib/estimationEngine.ts](src/lib/estimationEngine.ts)

### Formula Completa

```
┌─────────────────────────────────────────────────────────────────┐
│ FORMULA DI STIMA                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BASE DAYS = Σ(activity.base_hours) / 8                      │
│                                                                  │
│  2. DRIVER MULTIPLIER = Π(driver.option.multiplier)             │
│     (prodotto di tutti i moltiplicatori driver)                  │
│                                                                  │
│  3. SUBTOTAL = BASE DAYS × DRIVER MULTIPLIER                    │
│                                                                  │
│  4. RISK SCORE = Σ(risk.weight)                                 │
│                                                                  │
│  5. CONTINGENCY % = f(RISK SCORE)                               │
│     ┌────────────────┬─────────────┐                            │
│     │ Risk Score     │ Contingency │                            │
│     ├────────────────┼─────────────┤                            │
│     │ 0              │ 0%          │                            │
│     │ 1-10           │ 10%         │                            │
│     │ 11-20          │ 15%         │                            │
│     │ 21-30          │ 20%         │                            │
│     │ 31+            │ 25%         │                            │
│     └────────────────┴─────────────┘                            │
│                                                                  │
│  6. TOTAL DAYS = SUBTOTAL × (1 + CONTINGENCY %)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Codice Engine

```typescript
// src/lib/estimationEngine.ts

export function calculateBaseDays(activities: SelectedActivity[]): number {
  const totalHours = activities.reduce((sum, a) => sum + a.baseHours, 0);
  return totalHours / 8.0;
}

export function calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
  if (drivers.length === 0) return 1.0;
  return drivers.reduce((product, d) => product * d.multiplier, 1.0);
}

export function calculateRiskScore(risks: { weight: number }[]): number {
  return risks.reduce((sum, r) => sum + r.weight, 0);
}

export function calculateContingency(riskScore: number): number {
  if (riskScore <= 0) return 0.0;
  if (riskScore <= 10) return 0.10;
  if (riskScore <= 20) return 0.15;
  if (riskScore <= 30) return 0.20;
  return 0.25;
}

export function calculateEstimation(input: EstimationInput): EstimationResult {
  const baseDays = calculateBaseDays(input.activities);
  const driverMultiplier = calculateDriverMultiplier(input.drivers);
  const subtotal = baseDays * driverMultiplier;
  const riskScore = calculateRiskScore(input.risks);
  const contingencyPercent = calculateContingency(riskScore);
  const contingencyDays = subtotal * contingencyPercent;
  const totalDays = subtotal + contingencyDays;

  return {
    baseDays: Number(baseDays.toFixed(2)),
    driverMultiplier: Number(driverMultiplier.toFixed(3)),
    subtotal: Number(subtotal.toFixed(2)),
    riskScore,
    contingencyPercent: Number((contingencyPercent * 100).toFixed(2)),
    contingencyDays: Number(contingencyDays.toFixed(2)),
    totalDays: Number(totalDays.toFixed(2)),
    breakdown: { byGroup: {}, byTech: {} },
  };
}
```

---

## 6️⃣ Fase 6: Salvataggio Stima

### Flusso

```
WizardStep5.tsx (onSave)
       │
       ▼
RequirementWizard.handleSave()
       │
       ├──► createRequirement() ──► INSERT requirements
       │
       └──► saveEstimation() ───┬──► INSERT estimations
                                ├──► INSERT estimation_activities
                                ├──► INSERT estimation_drivers
                                ├──► INSERT estimation_risks
                                └──► UPSERT requirement_driver_values
```

### File Coinvolti

| File | Ruolo |
|------|-------|
| [src/lib/api.ts](src/lib/api.ts) | API functions |
| [src/lib/supabase.ts](src/lib/supabase.ts) | Supabase client |
| [supabase_schema.sql](supabase_schema.sql) | Database schema |
| [supabase_save_estimation_rpc.sql](supabase_save_estimation_rpc.sql) | Atomic RPC (alternativo) |

### Funzione `createRequirement`

```typescript
// src/lib/api.ts
export async function createRequirement(input: CreateRequirementInput): Promise<Requirement> {
  const reqId = input.req_id || (await generateNextRequirementId(input.listId));
  
  const payload = {
    list_id: input.listId,
    req_id: reqId,
    title: input.title,
    description: input.description || '',
    priority: input.priority,
    state: input.state,
    business_owner: input.business_owner || '',
    tech_preset_id: input.tech_preset_id ?? null,
    labels: [],
  };

  return requireSingle(
    supabase.from('requirements').insert(payload).select('*').single()
  );
}
```

### Funzione `saveEstimation`

```typescript
// src/lib/api.ts
export async function saveEstimation(input: SaveEstimationInput): Promise<void> {
  // 1. Validazione
  if (!input.activities || input.activities.length === 0) {
    throw new ApiError('Cannot save without activities', 400);
  }

  // 2. Insert estimation record
  const { data: estimation } = await supabase
    .from('estimations')
    .insert({
      requirement_id: input.requirementId,
      user_id: input.userId,
      total_days: input.totalDays,
      base_hours: input.baseDays * 8,
      driver_multiplier: input.driverMultiplier,
      risk_score: input.riskScore,
      contingency_percent: input.contingencyPercent,
      scenario_name: 'Wizard',
      ai_reasoning: input.aiReasoning || null,
    })
    .select()
    .single();

  // 3. Map codes to IDs
  const masterData = await fetchEstimationMasterData();

  // 4. Insert activities
  const activityInserts = input.activities.map((a) => ({
    estimation_id: estimation.id,
    activity_id: masterData.activities.find(ma => ma.code === a.code)?.id,
    is_ai_suggested: a.isAiSuggested,
  })).filter(i => i.activity_id);

  // 5. Insert drivers
  const driverInserts = input.drivers.map((d) => ({
    estimation_id: estimation.id,
    driver_id: masterData.drivers.find(md => md.code === d.code)?.id,
    selected_value: d.value,
  })).filter(i => i.driver_id);

  // 6. Insert risks
  const riskInserts = input.risks.map((r) => ({
    estimation_id: estimation.id,
    risk_id: masterData.risks.find(mr => mr.code === r.code)?.id,
  })).filter(i => i.risk_id);

  // 7. Parallel insert
  await Promise.all([
    supabase.from('estimation_activities').insert(activityInserts),
    supabase.from('estimation_drivers').insert(driverInserts),
    supabase.from('estimation_risks').insert(riskInserts),
  ]);
}
```

### Schema Database (Estratto)

```sql
-- supabase_schema.sql

-- Estimations
CREATE TABLE estimations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    total_days DECIMAL(10,2) NOT NULL,
    base_days DECIMAL(10,2) NOT NULL,
    driver_multiplier DECIMAL(5,3) NOT NULL,
    risk_score INTEGER NOT NULL,
    contingency_percent DECIMAL(5,2) NOT NULL,
    scenario_name VARCHAR(255) DEFAULT 'Base',
    ai_reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction tables
CREATE TABLE estimation_activities (
    id UUID PRIMARY KEY,
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id),
    is_ai_suggested BOOLEAN DEFAULT false,
    notes TEXT,
    UNIQUE(estimation_id, activity_id)
);

CREATE TABLE estimation_drivers (
    id UUID PRIMARY KEY,
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    selected_value VARCHAR(50) NOT NULL,
    UNIQUE(estimation_id, driver_id)
);

CREATE TABLE estimation_risks (
    id UUID PRIMARY KEY,
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    risk_id UUID NOT NULL REFERENCES risks(id),
    UNIQUE(estimation_id, risk_id)
);
```

### RPC Atomica (Alternativa)

```sql
-- supabase_save_estimation_rpc.sql
CREATE OR REPLACE FUNCTION save_estimation_atomic(
    p_requirement_id UUID,
    p_user_id UUID,
    p_total_days DECIMAL(10,2),
    p_base_days DECIMAL(10,2),
    p_driver_multiplier DECIMAL(5,3),
    p_risk_score INTEGER,
    p_contingency_percent DECIMAL(5,2),
    p_scenario_name VARCHAR(255),
    p_activities JSONB,  -- [{activity_id, is_ai_suggested, notes}]
    p_drivers JSONB,     -- [{driver_id, selected_value}]
    p_risks JSONB        -- [{risk_id}]
)
RETURNS TABLE(estimation_id UUID, activities_count INT, drivers_count INT, risks_count INT)
-- All-or-nothing transaction with automatic rollback on error
```

---

## 7️⃣ Fase 7: Visualizzazione Storico

### File Coinvolti

| File | Ruolo |
|------|-------|
| [src/pages/requirements/RequirementDetail.tsx](src/pages/requirements/RequirementDetail.tsx) | Pagina dettaglio |
| [src/hooks/useEstimationHistory.ts](src/hooks/useEstimationHistory.ts) | Hook fetch history |
| [src/components/estimation/EstimationTimeline.tsx](src/components/estimation/EstimationTimeline.tsx) | Grafico timeline |
| [src/components/estimation/EstimationComparison.tsx](src/components/estimation/EstimationComparison.tsx) | Confronto side-by-side |
| [src/components/requirements/detail/tabs/HistoryTab.tsx](src/components/requirements/detail/tabs/HistoryTab.tsx) | Tab History |

### Hook `useEstimationHistory`

```typescript
// src/hooks/useEstimationHistory.ts
export function useEstimationHistory(
  requirementId: string | undefined,
  options?: { page?: number; pageSize?: number }
): UseEstimationHistoryReturn {
  
  const query = useQuery({
    queryKey: ['estimation-history', requirementId, page, pageSize],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('estimations')
        .select(`
          *,
          estimation_activities (id, activity_id, is_ai_suggested, is_done),
          estimation_drivers (driver_id, selected_value),
          estimation_risks (risk_id)
        `, { count: 'exact' })
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeEnd);
      
      return { estimations: data, total: count };
    },
  });

  return { history, loading, totalCount, refetch };
}
```

### Componente `EstimationTimeline`

```tsx
// src/components/estimation/EstimationTimeline.tsx
// Visualizza le stime come punti su un grafico temporale
// - Click per selezionare e confrontare fino a 2 stime
// - Chip "Use" per assegnare una stima al requisito
// - Badge "Active" per la stima correntemente assegnata

<LineChart>
  <Line dataKey="total_days" />
  <CustomDot 
    onClick={handleDotClick}
    isSelected={selectedIds.includes(payload.id)}
    isAssigned={payload.id === assignedId}
  />
</LineChart>
```

### Componente `EstimationComparison`

```tsx
// src/components/estimation/EstimationComparison.tsx
// Confronto side-by-side tra due stime selezionate
// - Summary: Total Days, Base Days con trend icons
// - Activities: diff delle attività selezionate
// - Drivers: diff dei valori driver
// - Risks: diff dei rischi selezionati

<Card>
  <CardTitle>Compare Estimations</CardTitle>
  
  {/* Summary */}
  <div className="grid grid-cols-3">
    <div>Est 1: {est1.total_days} days</div>
    <div>{renderDifferenceIcon(diff)} {percent}%</div>
    <div>Est 2: {est2.total_days} days</div>
  </div>
  
  {/* Activities Diff */}
  <Badge variant="destructive">-Activity X</Badge>
  <Badge variant="success">+Activity Y</Badge>
</Card>
```

---

## 📊 Diagramma Relazioni Database

```
┌──────────────────┐       ┌──────────────────┐
│     lists        │       │ technology_      │
│                  │       │ presets          │
│ id               │       │                  │
│ user_id          │       │ id               │
│ name             │       │ code             │
│ tech_preset_id ──┼───────┤ name             │
└────────┬─────────┘       │ default_...      │
         │                 └────────┬─────────┘
         │                          │
         │ 1:N                      │
         ▼                          │
┌──────────────────┐                │
│  requirements    │                │
│                  │◄───────────────┘
│ id               │
│ list_id          │
│ req_id           │
│ title            │
│ description      │
│ tech_preset_id   │
│ assigned_est_id ─┼──────────┐
└────────┬─────────┘          │
         │                    │
         │ 1:N                │
         ▼                    ▼
┌──────────────────┐   ┌──────────────────┐
│  estimations     │   │   activities     │
│                  │   │                  │
│ id ◄─────────────┼───│ id               │
│ requirement_id   │   │ code             │
│ user_id          │   │ name             │
│ total_days       │   │ base_hours       │
│ base_hours       │   │ tech_category    │
│ driver_multiplier│   │ group            │
│ risk_score       │   └──────────────────┘
│ contingency_%    │
│ ai_reasoning     │
└────────┬─────────┘
         │
         │ 1:N (junction tables)
         ▼
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────┐ │
│  │ estimation_    │  │ estimation_    │  │estim._ │ │
│  │ activities     │  │ drivers        │  │risks   │ │
│  │                │  │                │  │        │ │
│  │ estimation_id  │  │ estimation_id  │  │est_id  │ │
│  │ activity_id    │  │ driver_id      │  │risk_id │ │
│  │ is_ai_suggested│  │ selected_value │  │        │ │
│  └────────────────┘  └────────────────┘  └────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🔗 Riepilogo Funzioni Chiave

| Fase | Funzione | File |
|------|----------|------|
| Input | `onUpdate({ description })` | WizardStep1.tsx |
| Normalize | `normalizeRequirement()` | lib/openai.ts |
| Interview Questions | `generateInterviewQuestions()` | lib/requirement-interview-api.ts |
| Interview Estimate | `generateEstimateFromInterview()` | lib/requirement-interview-api.ts |
| Calculate | `calculateEstimation()` | lib/estimationEngine.ts |
| Save Requirement | `createRequirement()` | lib/api.ts |
| Save Estimation | `saveEstimation()` | lib/api.ts |
| Load History | `useEstimationHistory()` | hooks/useEstimationHistory.ts |
| Compare | `EstimationComparison` | components/estimation/EstimationComparison.tsx |

---

## 📝 Note Tecniche

### Persistenza Stato Wizard
Il wizard utilizza `localStorage` per persistere lo stato tra refresh:
```typescript
const STORAGE_KEY = 'estimation_wizard_data';
localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
```

### Row Level Security (RLS)
Tutte le tabelle utente hanno RLS abilitato:
- `lists`, `requirements`, `estimations`: solo owner può leggere/scrivere
- `activities`, `drivers`, `risks`, `technology_presets`: lettura pubblica

### Validazione Input AI
Tutti gli input verso OpenAI sono sanitizzati:
```typescript
import { sanitizePromptInput } from '@/types/ai-validation';
const sanitized = sanitizePromptInput(description); // Max 5000 chars, strips dangerous patterns
```

---

**Report generato il:** 2026-02-07  
**Versione Piattaforma:** Syntero Estimation Platform v1.x
