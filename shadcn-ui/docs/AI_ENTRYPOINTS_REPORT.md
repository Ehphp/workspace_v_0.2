# AI Entry Points - Report Completo

> **Generato:** Febbraio 2026  
> **Progetto:** Syntero Estimation Tool  
> **Scopo:** Mappatura di tutti i punti di invocazione AI per stime/suggerimenti

---

## Sommario Esecutivo

Il sistema Syntero espone **7 endpoint AI** in `netlify/functions/` che vengono invocati da **6 contesti frontend** distinti.

### Quick Reference

| Contesto | Endpoint Principale | Scopo |
|----------|---------------------|-------|
| Quick Estimate | `ai-suggest` | Stima rapida con suggerimento attività |
| Requirement Wizard | `ai-suggest` + `ai-requirement-interview` + `ai-estimate-from-interview` | Creazione requirement con interview |
| Bulk Interview | `ai-bulk-interview` + `ai-bulk-estimate-with-answers` | Stima multipla aggregata |
| AI Preset Wizard | `ai-generate-questions` + `ai-generate-preset` | Creazione preset tecnologico |
| Requirement Detail | `ai-suggest` | Re-stima di requirement esistente |

---

## 1. Endpoint AI Backend (netlify/functions/)

### 1.1 ai-suggest.ts

**Path:** `/.netlify/functions/ai-suggest`

| Action | Scopo | Model | Timeout |
|--------|-------|-------|---------|
| `suggest-activities` | Suggerisce attività per un requisito | gpt-4o | default |
| `generate-title` | Genera titolo da descrizione | gpt-4o | default |
| `normalize-requirement` | Normalizza e valida descrizione | gpt-4o | default |

**Payload (suggest-activities):**
```typescript
{
  action?: 'suggest-activities' | 'generate-title' | 'normalize-requirement';
  description: string;
  preset?: TechnologyPreset;
  activities?: Activity[];
  projectContext?: { name: string; description: string; owner?: string };
  testMode?: boolean;
}
```

**Response:**
```typescript
{
  isValidRequirement: boolean;
  activityCodes: string[];
  reasoning?: string;
}
```

---

### 1.2 ai-requirement-interview.ts

**Path:** `/.netlify/functions/ai-requirement-interview`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera domande tecniche per singolo requisito | gpt-4o | 60s |

**Payload:**
```typescript
{
  description: string;
  techPresetId: string;
  techCategory: 'POWER_PLATFORM' | 'BACKEND' | 'FRONTEND' | 'MULTI';
  projectContext?: { name: string; description: string; owner?: string };
}
```

**Response:**
```typescript
{
  success: boolean;
  questions: TechnicalQuestion[];
  reasoning: string;
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedActivities: string[];
}
```

---

### 1.3 ai-estimate-from-interview.ts

**Path:** `/.netlify/functions/ai-estimate-from-interview`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera stima da risposte interview | gpt-4o | 55s |

**Payload:**
```typescript
{
  description: string;
  techPresetId: string;
  techCategory: string;
  answers: Record<string, InterviewAnswer>;
  activities: Activity[];
  projectContext?: { name: string; description: string; owner?: string };
}
```

**Response:**
```typescript
{
  generatedTitle: string;
  activities: SelectedActivityWithReason[];
  totalBaseDays: number;
  reasoning: string;
  confidenceScore: number;
  suggestedDrivers: SuggestedDriver[];
  suggestedRisks: string[];
}
```

---

### 1.4 ai-bulk-interview.ts

**Path:** `/.netlify/functions/ai-bulk-interview`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera domande aggregate per N requisiti | gpt-4o-mini | 28s |

**Payload:**
```typescript
{
  requirements: BulkRequirementInput[];
  techCategory: string;
  techPresetId?: string;
  projectContext?: { name: string; description: string };
}
```

**Response:**
```typescript
{
  success: boolean;
  questions: BulkInterviewQuestion[];
  requirementAnalysis: RequirementAnalysis[];
  reasoning: string;
  summary: {
    totalRequirements: number;
    globalQuestions: number;
    multiReqQuestions: number;
    specificQuestions: number;
  };
}
```

---

### 1.5 ai-bulk-estimate-with-answers.ts

**Path:** `/.netlify/functions/ai-bulk-estimate-with-answers`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera stime per N requisiti da risposte | gpt-4o-mini | 28s |

**Payload:**
```typescript
{
  requirements: BulkRequirementInput[];
  techCategory: string;
  answers: Record<string, BulkInterviewAnswer>;
  activities: Activity[];
}
```

**Response:**
```typescript
{
  success: boolean;
  estimations: BulkRequirementEstimation[];
  summary: {
    totalRequirements: number;
    successfulEstimations: number;
    failedEstimations: number;
    totalBaseDays: number;
    avgConfidenceScore: number;
  };
}
```

---

### 1.6 ai-generate-questions.ts

**Path:** `/.netlify/functions/ai-generate-questions`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera domande per creazione preset (Stage 1) | gpt-4o | 20s |

**Payload:**
```typescript
{
  description: string;
  userId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  questions: AiQuestion[];
  reasoning?: string;
  suggestedTechCategory?: string;
}
```

---

### 1.7 ai-generate-preset.ts

**Path:** `/.netlify/functions/ai-generate-preset`

| Scopo | Model | Timeout |
|-------|-------|---------|
| Genera preset tecnologico (Stage 2) | gpt-4o | 50s |

**Payload:**
```typescript
{
  description: string;
  answers: Record<string, any>;
  suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
}
```

**Response:**
```typescript
{
  success: boolean;
  preset: GeneratedPreset;
  metadata: {
    totalActivities: number;
    coreActivities: number;
    recommendedActivities: number;
    optionalActivities: number;
    estimatedDays: number;
  };
}
```

---

## 2. Entry Points Frontend

### 2.1 Quick Estimate

**Feature:** Stima rapida di un singolo requisito senza interview

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `QuickEstimate.tsx` + `QuickEstimateInput.tsx` |
| **Hook** | `useQuickEstimation()` |
| **Client API** | `src/lib/openai.ts` → `suggestActivities()` |
| **Endpoint** | `ai-suggest` (action: `suggest-activities`) |
| **Contesto** | Homepage / Dashboard |

**Input Utente:**
- Descrizione requisito (textarea, min 10 chars)
- Selezione preset tecnologico (dropdown)

**Output:**
- Attività suggerite dall'AI
- Stima in giorni/ore
- Reasoning dell'AI

**File Coinvolti:**
```
src/components/estimation/QuickEstimate.tsx
src/components/estimation/quick-estimate/QuickEstimateInput.tsx
src/components/estimation/quick-estimate/QuickEstimateResult.tsx
src/hooks/useQuickEstimation.ts
src/lib/openai.ts
netlify/functions/ai-suggest.ts
```

**Schema Zod:**
```typescript
// src/types/ai-validation.ts
AIActivitySuggestionSchema = z.object({
  isValidRequirement: z.boolean(),
  activityCodes: z.array(z.string().regex(/^[A-Z0-9_]{3,50}$/)).max(50),
  reasoning: z.string().max(2000).optional()
})
```

---

### 2.2 Requirement Wizard - Step 1 (Normalization)

**Feature:** AI migliora descrizione del requisito

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `WizardStep1.tsx` |
| **Hook** | `useRequirementNormalization()` |
| **Client API** | `src/lib/openai.ts` → `normalizeRequirement()` |
| **Endpoint** | `ai-suggest` (action: `normalize-requirement`) |
| **Contesto** | Wizard creazione requirement |

**Input Utente:**
- Descrizione requisito (textarea)
- Click su "Analyze & Improve with AI"

**Output:**
- Descrizione normalizzata
- Flag `isValidRequirement`
- Lista `validationIssues`
- `transformNotes`
- Titolo generato (opzionale)

**File Coinvolti:**
```
src/components/requirements/wizard/WizardStep1.tsx
src/hooks/useRequirementNormalization.ts
src/lib/openai.ts
netlify/functions/ai-suggest.ts
netlify/functions/lib/ai/actions/normalize-requirement.ts
```

---

### 2.3 Requirement Wizard - Step Interview

**Feature:** Interview tecnica AI-driven per singolo requisito

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `WizardStepInterview.tsx` |
| **Hook** | `useRequirementInterview()` |
| **Client API** | `src/lib/requirement-interview-api.ts` |
| **Endpoint** | `ai-requirement-interview` → `ai-estimate-from-interview` |
| **Contesto** | Wizard creazione requirement (Step 3) |

**Flusso:**
1. **Genera domande** → `ai-requirement-interview`
2. **Utente risponde** alle 4-6 domande tecniche
3. **Genera stima** → `ai-estimate-from-interview`

**Input Utente:**
- Risposte a domande (single-choice, multiple-choice, range)
- Tipi domanda: INTEGRATION, DATA, SECURITY, PERFORMANCE, UI_UX, ARCHITECTURE, TESTING, DEPLOYMENT

**Output:**
- Titolo generato
- Attività selezionate con reasoning
- totalBaseDays
- confidenceScore (0.6-0.9)
- suggestedDrivers
- suggestedRisks

**File Coinvolti:**
```
src/components/requirements/wizard/WizardStepInterview.tsx
src/components/estimation/interview/RequirementInterviewStep.tsx
src/components/estimation/interview/TechnicalQuestionCard.tsx
src/hooks/useRequirementInterview.ts
src/lib/requirement-interview-api.ts
netlify/functions/ai-requirement-interview.ts
netlify/functions/ai-estimate-from-interview.ts
```

**Schema Zod:**
```typescript
// src/types/requirement-interview.ts
TechnicalQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['single-choice', 'multiple-choice', 'range']),
  category: z.string(),
  question: z.string(),
  technicalContext: z.string().optional(),
  impactOnEstimate: z.string().optional(),
  options: z.array(TechnicalQuestionOptionSchema).optional(),
  required: z.boolean(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  step: z.number().nullable(),
  unit: z.string().nullable()
})

EstimationFromInterviewResponseSchema = z.object({
  success: z.boolean(),
  generatedTitle: z.string().optional(),
  activities: z.array(SelectedActivityWithReasonSchema),
  totalBaseDays: z.number(),
  reasoning: z.string(),
  confidenceScore: z.number(),
  suggestedDrivers: z.array(...).optional(),
  suggestedRisks: z.array(...).optional(),
  error: z.string().optional()
})
```

---

### 2.4 Bulk Interview Dialog

**Feature:** Stima multipla di N requisiti con interview aggregata

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `BulkInterviewDialog.tsx` |
| **Hook** | `useBulkInterview()` |
| **Client API** | `src/lib/bulk-interview-api.ts` |
| **Endpoint** | `ai-bulk-interview` → `ai-bulk-estimate-with-answers` |
| **Contesto** | Lista requisiti (selezione multipla) |

**Flusso:**
1. **Preview** - Mostra requisiti selezionati
2. **Analyzing** → `ai-bulk-interview` genera 6-10 domande aggregate
3. **Interview** - Utente risponde
4. **Generating** → `ai-bulk-estimate-with-answers`
5. **Review** - Mostra stime per ciascun requisito
6. **Save** - Salva nel database

**Input Utente:**
- Selezione requisiti (max 50)
- Risposte a domande aggregate
- Scope domande: `global`, `multi-requirement`, `specific`

**Output:**
- Stima per ogni requisito
- Attività suggerite
- Confidence score per requisito
- Summary totale

**File Coinvolti:**
```
src/components/requirements/BulkInterviewDialog.tsx
src/hooks/useBulkInterview.ts
src/lib/bulk-interview-api.ts
netlify/functions/ai-bulk-interview.ts
netlify/functions/ai-bulk-estimate-with-answers.ts
```

**Schema Zod:**
```typescript
// src/types/bulk-interview.ts
BulkInterviewQuestionSchema = z.object({
  id: z.string(),
  scope: z.enum(['global', 'multi-requirement', 'specific']),
  affectedRequirementIds: z.array(z.string()),
  type: z.enum(['single-choice', 'multiple-choice', 'range']),
  category: z.string(),
  question: z.string(),
  options: z.array(BulkQuestionOptionSchema).nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  step: z.number().nullable(),
  unit: z.string().nullable(),
  required: z.boolean().default(true)
})
```

---

### 2.5 AI Technology Preset Wizard

**Feature:** Creazione guidata di preset tecnologico con AI

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `AiTechnologyWizard.tsx` |
| **Hook** | `useAiWizardState()` |
| **Client API** | `src/lib/ai-interview-api.ts` + `src/lib/ai-preset-api.ts` |
| **Endpoint** | `ai-generate-questions` → `ai-generate-preset` |
| **Contesto** | Configurazione > Presets > "Create with AI" |

**Flusso (Two-Stage):**
1. **Stage 1** - Utente descrive tecnologia → `ai-generate-questions`
2. **Interview** - Utente risponde a 5-8 domande (lifecycle, patterns, etc.)
3. **Stage 2** - AI genera preset → `ai-generate-preset`
4. **Review** - Utente modifica attività generate
5. **Save** - Salva preset nel database

**Input Utente:**
- Descrizione tecnologia (min 20 chars)
- Risposte: Greenfield/Brownfield, patterns architetturali, testing strategy, etc.

**Output:**
- Preset completo con:
  - nome, description, detailedDescription
  - techCategory
  - 6-10 attività atomiche
  - driverValues default
  - riskCodes suggeriti
  - confidence score

**File Coinvolti:**
```
src/components/configuration/presets/ai-wizard/AiTechnologyWizard.tsx
src/components/configuration/presets/ai-wizard/DescriptionInput.tsx
src/components/configuration/presets/ai-wizard/InterviewStep.tsx
src/components/configuration/presets/ai-wizard/DynamicQuestionnaire.tsx
src/components/configuration/presets/ai-wizard/ReviewStep.tsx
src/hooks/useAiWizardState.ts
src/lib/ai-interview-api.ts
src/lib/ai-preset-api.ts
netlify/functions/ai-generate-questions.ts
netlify/functions/ai-generate-preset.ts
```

**Schema Zod:**
```typescript
// src/types/ai-preset-generation.ts
PresetGenerationResponseSchema = z.object({
  success: z.boolean(),
  preset: GeneratedPresetSchema.optional(),
  error: z.string().optional(),
  metadata: z.object({
    totalActivities: z.number(),
    coreActivities: z.number(),
    recommendedActivities: z.number(),
    optionalActivities: z.number(),
    estimatedDays: z.number()
  }).optional()
})

// src/types/ai-interview.ts
QuestionGenerationResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(AiQuestionSchema),
  reasoning: z.string().optional(),
  suggestedTechCategory: z.string().optional(),
  error: z.string().optional()
})
```

---

### 2.6 Requirement Detail (Re-estimate)

**Feature:** Re-stima di un requisito esistente

| Aspetto | Dettaglio |
|---------|-----------|
| **Componente** | `RequirementDetail.tsx` |
| **Hook** | N/A (chiamata diretta) |
| **Client API** | `src/lib/openai.ts` → `suggestActivities()` |
| **Endpoint** | `ai-suggest` (action: `suggest-activities`) |
| **Contesto** | Pagina dettaglio requisito |

**File Coinvolti:**
```
src/pages/requirements/RequirementDetail.tsx
src/lib/openai.ts
netlify/functions/ai-suggest.ts
```

---

## 3. Tabella Comparativa Entry Points

| # | Entry Point | Endpoint(s) | Hook | Tipo Domande | Max Questions | Caching |
|---|-------------|-------------|------|--------------|---------------|---------|
| 1 | Quick Estimate | ai-suggest | useQuickEstimation | N/A | 0 | No |
| 2 | Wizard Normalization | ai-suggest | useRequirementNormalization | N/A | 0 | No |
| 3 | Wizard Interview | ai-requirement-interview + ai-estimate-from-interview | useRequirementInterview | single/multi/range | 4-6 | No |
| 4 | Bulk Interview | ai-bulk-interview + ai-bulk-estimate-with-answers | useBulkInterview | single/multi/range | 6-10 | No |
| 5 | AI Preset Wizard | ai-generate-questions + ai-generate-preset | useAiWizardState | single/multi/text/range | 5-8 | No |
| 6 | Requirement Detail | ai-suggest | N/A | N/A | 0 | No |

---

## 4. Tabella Comparativa Endpoint

| Endpoint | Model | Max Tokens | Timeout | Rate Limit | Structured Output |
|----------|-------|------------|---------|------------|-------------------|
| ai-suggest | gpt-4o | default | default | Disabled (dev) | No |
| ai-requirement-interview | gpt-4o | dynamic | 60s | Disabled | Yes (JSON Schema) |
| ai-estimate-from-interview | gpt-4o | dynamic | 55s | Disabled | Yes (JSON Schema) |
| ai-bulk-interview | gpt-4o-mini | 1800 | 28s | Disabled | Yes (json_object) |
| ai-bulk-estimate-with-answers | gpt-4o-mini | dynamic (500+80×N) | 28s | Disabled | Yes (json_object) |
| ai-generate-questions | gpt-4o | default | 20s | Disabled | Yes |
| ai-generate-preset | gpt-4o | 1500 | 50s | Disabled | No |

---

## 5. Gestione Errori

### Pattern Comune (tutti gli endpoint)

```typescript
// Frontend (hook/api client)
try {
  const response = await fetch(endpoint, options);
  
  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded');
    if (response.status === 401) throw new Error('Unauthorized');
    if (response.status === 504) throw new Error('Timeout');
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return schema.parse(data); // Zod validation
} catch (error) {
  // Fallback to preset defaults or show error
}
```

### Fallback Strategies

| Entry Point | Fallback |
|-------------|----------|
| Quick Estimate | Usa `preset.default_activity_codes` |
| Wizard Interview | Mostra errore, permette retry |
| Bulk Interview | Mostra errore, permette retry |
| AI Preset Wizard | Mostra errore, permette retry |

---

## 6. Validazione Input (ai-validation.ts)

```typescript
export function sanitizePromptInput(text: string): string {
  return text
    .replace(/[<>]/g, '')           // Remove HTML-like tags
    .replace(/[{}]/g, '')           // Remove JSON delimiters
    .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control chars
    .slice(0, 5000)                 // Limit length
    .trim();
}
```

**Applicato in:**
- Tutti i client API (defense in depth)
- Tutti gli endpoint serverless

---

## 7. Diagramma Architetturale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────────────┐   │
│  │  Quick Estimate  │  │ Requirement Wizard│  │   Bulk Interview        │   │
│  │                  │  │                   │  │   Dialog                │   │
│  │ useQuickEstimate │  │ useReqInterview   │  │   useBulkInterview      │   │
│  └────────┬─────────┘  └────────┬──────────┘  └───────────┬─────────────┘   │
│           │                     │                         │                 │
│  ┌────────┴─────────┐  ┌────────┴──────────┐  ┌───────────┴─────────────┐   │
│  │ AI Preset Wizard │  │ Requirement Detail│  │                         │   │
│  │                  │  │                   │  │                         │   │
│  │ useAiWizardState │  │ (direct call)     │  │                         │   │
│  └────────┬─────────┘  └────────┬──────────┘  │                         │   │
│           │                     │             │                         │   │
├───────────┼─────────────────────┼─────────────┼─────────────────────────┤   │
│           │      CLIENT API LAYER              │                         │   │
│           │                                    │                         │   │
│  ┌────────▼───────────────────────────────────▼─────────────────────────┐   │
│  │ src/lib/openai.ts  │ src/lib/requirement-interview-api.ts            │   │
│  │ src/lib/ai-interview-api.ts  │ src/lib/bulk-interview-api.ts         │   │
│  │ src/lib/ai-preset-api.ts                                             │   │
│  └────────┬─────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │ HTTPS POST
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NETLIFY FUNCTIONS (Serverless)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐   │
│  │  ai-suggest     │  │ ai-requirement-        │  │ ai-bulk-interview   │   │
│  │  (3 actions)    │  │ interview              │  │                     │   │
│  └─────────────────┘  └────────────────────────┘  └─────────────────────┘   │
│                                                                             │
│  ┌─────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐   │
│  │ ai-generate-    │  │ ai-estimate-from-      │  │ ai-bulk-estimate-   │   │
│  │ questions       │  │ interview              │  │ with-answers        │   │
│  └─────────────────┘  └────────────────────────┘  └─────────────────────┘   │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ ai-generate-    │                                                        │
│  │ preset          │                                                        │
│  └─────────────────┘                                                        │
│           │                                                                 │
│           │ lib/auth/auth-validator.ts  (Supabase JWT validation)           │
│           │ lib/security/cors.ts        (Origin allowlist)                  │
│           │ lib/security/rate-limiter.ts (Disabled in dev)                  │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │ HTTPS (OPENAI_API_KEY)
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OpenAI API                                     │
│                         gpt-4o / gpt-4o-mini                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. File Index per Entry Point

### 8.1 Quick Estimate
| File | Ruolo |
|------|-------|
| [src/components/estimation/QuickEstimate.tsx](src/components/estimation/QuickEstimate.tsx) | Container principale |
| [src/components/estimation/quick-estimate/QuickEstimateInput.tsx](src/components/estimation/quick-estimate/QuickEstimateInput.tsx) | Form input + normalize button |
| [src/components/estimation/quick-estimate/QuickEstimateResult.tsx](src/components/estimation/quick-estimate/QuickEstimateResult.tsx) | Risultato stima |
| [src/hooks/useQuickEstimation.ts](src/hooks/useQuickEstimation.ts) | State management + AI call |
| [src/lib/openai.ts](src/lib/openai.ts) | Client API (`suggestActivities`) |
| [netlify/functions/ai-suggest.ts](netlify/functions/ai-suggest.ts) | Endpoint serverless |

### 8.2 Wizard Interview
| File | Ruolo |
|------|-------|
| [src/components/requirements/wizard/WizardStepInterview.tsx](src/components/requirements/wizard/WizardStepInterview.tsx) | Orchestratore step |
| [src/components/estimation/interview/RequirementInterviewStep.tsx](src/components/estimation/interview/RequirementInterviewStep.tsx) | UI domande |
| [src/components/estimation/interview/TechnicalQuestionCard.tsx](src/components/estimation/interview/TechnicalQuestionCard.tsx) | Card singola domanda |
| [src/hooks/useRequirementInterview.ts](src/hooks/useRequirementInterview.ts) | State + API calls |
| [src/lib/requirement-interview-api.ts](src/lib/requirement-interview-api.ts) | Client API |
| [src/types/requirement-interview.ts](src/types/requirement-interview.ts) | Tipi + Zod schemas |
| [netlify/functions/ai-requirement-interview.ts](netlify/functions/ai-requirement-interview.ts) | Genera domande |
| [netlify/functions/ai-estimate-from-interview.ts](netlify/functions/ai-estimate-from-interview.ts) | Genera stima |

### 8.3 Bulk Interview
| File | Ruolo |
|------|-------|
| [src/components/requirements/BulkInterviewDialog.tsx](src/components/requirements/BulkInterviewDialog.tsx) | Dialog multi-step |
| [src/hooks/useBulkInterview.ts](src/hooks/useBulkInterview.ts) | State + API calls |
| [src/lib/bulk-interview-api.ts](src/lib/bulk-interview-api.ts) | Client API |
| [src/types/bulk-interview.ts](src/types/bulk-interview.ts) | Tipi + Zod schemas |
| [netlify/functions/ai-bulk-interview.ts](netlify/functions/ai-bulk-interview.ts) | Genera domande aggregate |
| [netlify/functions/ai-bulk-estimate-with-answers.ts](netlify/functions/ai-bulk-estimate-with-answers.ts) | Genera stime bulk |

### 8.4 AI Preset Wizard
| File | Ruolo |
|------|-------|
| [src/components/configuration/presets/ai-wizard/AiTechnologyWizard.tsx](src/components/configuration/presets/ai-wizard/AiTechnologyWizard.tsx) | Orchestratore wizard |
| [src/components/configuration/presets/ai-wizard/DescriptionInput.tsx](src/components/configuration/presets/ai-wizard/DescriptionInput.tsx) | Input descrizione |
| [src/components/configuration/presets/ai-wizard/InterviewStep.tsx](src/components/configuration/presets/ai-wizard/InterviewStep.tsx) | Step domande |
| [src/components/configuration/presets/ai-wizard/DynamicQuestionnaire.tsx](src/components/configuration/presets/ai-wizard/DynamicQuestionnaire.tsx) | Renderer domande |
| [src/components/configuration/presets/ai-wizard/ReviewStep.tsx](src/components/configuration/presets/ai-wizard/ReviewStep.tsx) | Review preset generato |
| [src/hooks/useAiWizardState.ts](src/hooks/useAiWizardState.ts) | State machine |
| [src/lib/ai-interview-api.ts](src/lib/ai-interview-api.ts) | Client API (questions) |
| [src/lib/ai-preset-api.ts](src/lib/ai-preset-api.ts) | Client API (preset) |
| [src/types/ai-interview.ts](src/types/ai-interview.ts) | Tipi questions |
| [src/types/ai-preset-generation.ts](src/types/ai-preset-generation.ts) | Tipi + Zod preset |
| [netlify/functions/ai-generate-questions.ts](netlify/functions/ai-generate-questions.ts) | Stage 1 |
| [netlify/functions/ai-generate-preset.ts](netlify/functions/ai-generate-preset.ts) | Stage 2 |

---

## 9. Note Implementative

### Security
- **CORS:** Origin allowlist in `lib/security/cors.ts`
- **Auth:** Supabase JWT validation (opzionale per alcune chiamate)
- **Rate Limiting:** Disabilitato in development
- **Input Sanitization:** `sanitizePromptInput()` su client e server

### Performance
- **Model Selection:** `gpt-4o-mini` per bulk (velocità), `gpt-4o` per singoli (qualità)
- **Timeout:** 20-55s a seconda dell'endpoint
- **Structured Output:** JSON Schema per ridurre errori parsing

### Error Handling
- Tutti gli endpoint restituiscono `{ success: false, error: string }` in caso di errore
- Frontend mostra toast/alert e permette retry
- Fallback a preset defaults quando possibile

---

*Report generato automaticamente dall'analisi del codebase Syntero*
