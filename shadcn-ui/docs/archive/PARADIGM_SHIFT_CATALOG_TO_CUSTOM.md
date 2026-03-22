# Cambio di Paradigma: Da Selezione Catalogo a Generazione Custom

**Data**: 2024-01-XX  
**Motivazione**: Risolvere timeout di 27s con 99 attività (14KB prompt) → Approccio generativo con ~2KB prompt

---

## Problema Originale

- **Sintomo**: Timeout dopo 27s durante generazione preset
- **Causa**: 99 attività dal database → prompt di 14.248 caratteri → latenza OpenAI elevata
- **Token usage**: ~4000 input tokens con catalogo completo

## Soluzione Implementata

### Prima (Selezione da Catalogo)
```typescript
// 1. Caricare 99+ attività da Supabase
const activities = await loadActivities(supabase, techCategory);

// 2. Costruire prompt gigante con tutto il catalogo
const prompt = buildPrompt(description, answers, activities); // 14KB

// 3. GPT seleziona codici attività esistenti
{
  "activities": [
    { "code": "REACT_SETUP", "name": "React Setup", "baseDays": 1.5 }
  ]
}

// 4. Validare che tutti i codici esistano nel DB
validateActivityCodes(activities, validCodes);
```

**Problemi**:
- ❌ 99 attività × ~150 char = ~15KB prompt
- ❌ Timeout frequenti (>27s)
- ❌ Attività generiche dal catalogo
- ❌ Dipendenza da Supabase per ogni generazione

### Dopo (Generazione Custom)
```typescript
// 1. NO database call needed
// 2. Costruire prompt minimo (solo contesto progetto)
const prompt = buildPrompt(description, answers); // ~2KB

// 3. GPT genera attività custom per il progetto specifico
{
  "activities": [
    {
      "title": "Build OAuth Login with Google & Microsoft",
      "description": "Implement OAuth 2.0 flow for social login...",
      "estimatedHours": 24,
      "group": "DEV",
      "priority": "core",
      "confidence": 0.95
    }
  ]
}

// 4. Validare solo struttura (no codici da verificare)
validateStructure(activities);
```

**Vantaggi**:
- ✅ Nessun caricamento DB → -2s latenza
- ✅ Prompt ridotto del 85% (14KB → 2KB)
- ✅ Attività project-specific (non generiche)
- ✅ Stima oraria integrata (no conversione da baseDays)
- ✅ Timeout atteso: 5-8s vs 27s+

---

## Modifiche Tecniche

### 1. Backend - System Prompt
**File**: `netlify/functions/lib/ai/prompts/preset-generation.ts`

**Cambiamenti**:
```diff
- You are selecting activities from a catalog of 99 pre-defined activities
+ You are GENERATING custom activities tailored to this specific project

- Select activities by their CODE from the provided catalog
+ Create 8-20 activities with descriptive TITLE and detailed DESCRIPTION

- Activities must match catalog baseDays values
+ Estimate realistic HOURS for each activity (include testing/debugging)
```

**Nuova struttura prompt**:
```typescript
## PROJECT DESCRIPTION
E-commerce platform with React & Node.js...

## WIZARD ANSWERS
- Team size: 3-5 developers
- Timeline: 3 months
- Budget: Medium
- Technologies: React, Node.js, PostgreSQL

---
Generate a complete estimation preset with custom activities.
```

### 2. Backend - JSON Schema
**File**: `netlify/functions/lib/ai/prompts/preset-generation.ts`

**Cambiamenti**:
```diff
- code: { type: "string", enum: validActivityCodes } // ❌ Rimosso
+ title: { type: "string", minLength: 10, maxLength: 150 } // ✅ Aggiunto
+ description: { type: "string", minLength: 20, maxLength: 500 } // ✅ Obbligatorio
- baseDays: { type: "number", minimum: 0 }
+ estimatedHours: { type: "number", minimum: 1, maximum: 320 }
```

**Nuova validazione**:
- ✅ Attività deve avere title univoco (non code)
- ✅ Description obbligatoria e dettagliata (20-500 char)
- ✅ estimatedHours tra 1-320 (1h - 40 giorni)
- ✅ group, priority, confidence come prima

### 3. Backend - Logic Simplification
**File**: `netlify/functions/lib/ai/actions/generate-preset.ts`

**Rimossi**:
```diff
- async function loadActivities(supabase, techCategory) { ... }
- const activities = await loadActivities(supabaseClient, input.suggestedTechCategory);
- const validActivityCodes = activities.map(a => a.code);
- const validation = validatePreset(aiResponse.preset, validActivityCodes);
```

**Semplificati**:
```typescript
export async function generatePreset(
    input: GeneratePresetInput,
-   openaiClient: OpenAI,
-   supabaseClient: SupabaseClient  // ❌ Rimosso
+   openaiClient: OpenAI             // ✅ Solo OpenAI
): Promise<PresetGenerationResponse> {
    // No DB call
    const userPrompt = buildPresetGenerationPrompt(
        sanitizedDescription,
        input.answers,
-       activitiesForPrompt,  // ❌ Rimosso
        input.suggestedTechCategory
    );
    
    // Validazione senza codici
    const validation = validatePreset(aiResponse.preset); // No validActivityCodes
}
```

**File**: `netlify/functions/ai-generate-preset.ts`

```diff
- const openai = getOpenAIClient();
- const supabase = getSupabaseClient();  // ❌ Rimosso

const result = await generatePreset(
    { ... },
-   openai,
-   supabase  // ❌ Rimosso
+   openai
);
```

### 4. Frontend - Type Definitions
**File**: `src/types/ai-preset-generation.ts`

**Cambiamenti**:
```diff
export interface SuggestedActivity {
-   code: string;                    // ❌ Rimosso
-   name: string;                    // ❌ Rimosso
+   title: string;                   // ✅ Aggiunto (custom per progetto)
+   description: string;             // ✅ Ora obbligatorio (prima optional)
    group: string;
-   baseDays: number;                // ❌ Rimosso
+   estimatedHours: number;          // ✅ Aggiunto (diretto in ore)
    confidence: number;
    priority: 'core' | 'recommended' | 'optional';
-   reasoning?: string;              // ❌ Rimosso
}
```

**Schema Zod aggiornato**:
```typescript
export const SuggestedActivitySchema = z.object({
-   code: z.string(),
+   title: z.string().min(10).max(150),
-   name: z.string(),
+   description: z.string().min(20).max(500), // Non più optional
    group: z.enum(['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE']),
-   baseDays: z.number().min(0),
+   estimatedHours: z.number().min(1).max(320),
    confidence: z.number().min(0).max(1),
    priority: z.enum(['core', 'recommended', 'optional']),
-   reasoning: z.string().optional(),
});
```

**Helper functions**:
```diff
export function calculateEstimatedDays(activities: SuggestedActivity[]): number {
-   return activities.reduce((sum, act) => sum + act.baseDays, 0);
+   const totalHours = activities.reduce((sum, act) => sum + act.estimatedHours, 0);
+   return Math.round((totalHours / 8) * 10) / 10; // Convert to days
}
```

### 5. Frontend - UI Component
**File**: `src/components/configuration/presets/ai-wizard/ReviewStep.tsx`

**Cambiamenti**:
```diff
- {activities.map((activity) => (
-   <div key={activity.code}>
-     <div>{activity.name}</div>
-     <Badge>{activity.baseDays}d</Badge>
+   <div key={activity.title}>
+     <div>{activity.title}</div>
+     <Badge>{Math.round(activity.estimatedHours)}h</Badge>
-     {activity.reasoning && <p>{activity.reasoning}</p>}
+     {activity.description && <p>{activity.description}</p>}
  </div>
))}
```

**Funzioni aggiornate**:
```diff
- const handleToggleActivity = (activityCode: string) => {
-   const newActivities = preset.activities.some(a => a.code === activityCode)
-     ? preset.activities.filter(a => a.code !== activityCode)
-     : [...preset.activities, preset.activities.find(a => a.code === activityCode)!];
+ const handleToggleActivity = (activityTitle: string) => {
+   const newActivities = preset.activities.some(a => a.title === activityTitle)
+     ? preset.activities.filter(a => a.title !== activityTitle)
+     : [...preset.activities, preset.activities.find(a => a.title === activityTitle)!];
```

---

## Comparazione Output

### Prima (Da Catalogo)
```json
{
  "activities": [
    {
      "code": "REACT_SETUP",
      "name": "React Project Setup",
      "description": "Initialize React app with TypeScript, ESLint, Prettier",
      "baseDays": 1.5,
      "group": "DEV",
      "priority": "core",
      "confidence": 1.0,
      "reasoning": "React explicitly mentioned"
    }
  ]
}
```

**Problemi**:
- Nome generico: "React Project Setup"
- Description generica dal catalogo
- baseDays fisso dal DB (no flessibilità)

### Dopo (Generazione Custom)
```json
{
  "activities": [
    {
      "title": "Build Product Catalog with Advanced Filtering and Search",
      "description": "Implement product listing page with category navigation, price range filters, search functionality, and pagination. Include responsive grid layout and product detail views.",
      "estimatedHours": 32,
      "group": "DEV",
      "priority": "core",
      "confidence": 0.95
    }
  ]
}
```

**Vantaggi**:
- ✅ Title specifico per il progetto (Product Catalog per e-commerce)
- ✅ Description dettagliata con scope chiaro
- ✅ Ore stimate realistiche per quel feature specifico
- ✅ No codice generico dal DB

---

## Metriche di Performance

| Metrica | Prima (Catalogo) | Dopo (Custom) | Miglioramento |
|---------|------------------|---------------|---------------|
| **Prompt size** | ~14KB | ~2KB | -85% |
| **Input tokens** | ~4000 | ~600 | -85% |
| **DB queries** | 1-2 | 0 | -100% |
| **Latenza totale** | 27s+ | 5-8s (stimato) | -70% |
| **Timeout risk** | Alto | Basso | ✅ |
| **Specificità attività** | Generica | Project-specific | ✅ |

---

## File Modificati

### Backend
1. ✅ `netlify/functions/lib/ai/prompts/preset-generation.ts`
   - System prompt rewrite (linee 1-140)
   - JSON schema update (linee 230-350)
   - buildPresetGenerationPrompt semplificato (no activities param)

2. ✅ `netlify/functions/lib/ai/actions/generate-preset.ts`
   - Rimossa funzione loadActivities()
   - Rimosso parametro supabaseClient
   - Aggiornata validatePreset() (no validActivityCodes)
   - Aggiornata calculateMetadata() (estimatedHours)

3. ✅ `netlify/functions/ai-generate-preset.ts`
   - Rimossa inizializzazione Supabase client
   - Rimosso parametro supabase da generatePreset()

### Frontend
4. ✅ `src/types/ai-preset-generation.ts`
   - Interface SuggestedActivity aggiornata
   - Schema Zod aggiornato
   - calculateEstimatedDays() aggiornato

5. ✅ `src/components/configuration/presets/ai-wizard/ReviewStep.tsx`
   - Usato activity.title invece di activity.code
   - Mostrato estimatedHours invece di baseDays
   - Aggiornato handleToggleActivity()

---

## Test Plan (Next Steps)

### 1. Smoke Test
```bash
# Test con progetto semplice
curl -X POST /ai-generate-preset \
  -d '{
    "description": "Simple React todo app with local storage",
    "answers": { "teamSize": "1-2", "timeline": "1 month" },
    "suggestedTechCategory": "FRONTEND"
  }'

# Verificare:
# - Response time < 10s
# - 5-10 attività generate
# - Titoli specifici (non "Frontend Development")
# - Ore realistiche (8-40h per attività)
```

### 2. Complex Project Test
```bash
# Test con progetto complesso
curl -X POST /ai-generate-preset \
  -d '{
    "description": "E-commerce platform with React, Node.js, PostgreSQL, Stripe payments, AWS deployment",
    "answers": {
      "teamSize": "5-10",
      "timeline": "6 months",
      "technologies": ["React", "Node.js", "PostgreSQL", "Stripe", "AWS"]
    },
    "suggestedTechCategory": "MULTI"
  }'

# Verificare:
# - Response time < 15s
# - 12-20 attività generate
# - Mix di ANALYSIS, DEV, TEST, OPS
# - Attività specifiche: "Stripe Payment Integration", "AWS Lambda Deployment"
```

### 3. Validation Test
```typescript
// Test schema validation con attività invalida
const invalidActivity = {
  title: "X", // Too short
  description: "Short", // Too short
  estimatedHours: 500, // > 320 max
  group: "INVALID",
  priority: "invalid",
  confidence: 1.5 // > 1.0
};

// Dovrebbe fallire la validazione con errori specifici
```

### 4. Token Usage Test
```typescript
// Monitorare token usage nelle response
console.log('Input tokens:', completion.usage.prompt_tokens);
console.log('Output tokens:', completion.usage.completion_tokens);

// Target: <1000 input tokens (vs 4000 prima)
```

---

## Rollback Plan

Se la nuova implementazione causa problemi:

### Quick Rollback (Git)
```bash
git revert HEAD~5  # Revert ultimi 5 commit
git push origin main --force
```

### Fallback Implementation
Mantenere vecchia implementazione come `/ai-generate-preset-legacy`:
```typescript
// netlify/functions/ai-generate-preset-legacy.ts
// Import old loadActivities() logic
// Keep catalog-based selection
```

---

## Lessons Learned

1. **Token Economics**: A volte meno contesto è meglio
   - Prima: "Dammi tutto il catalogo" → 14KB prompt
   - Dopo: "Genera ciò che serve" → 2KB prompt

2. **Specificità vs Generalità**:
   - Catalogo generico (99 attività) = copertura ma non specificità
   - Generazione custom = specificità ma richiede GPT affidabile

3. **Validation Trade-offs**:
   - Prima: Validation rigida contro DB (codici esistenti)
   - Dopo: Validation strutturale (format, range, type)
   - Rischio: Attività duplicate o mal formattate (mitigato da prompt engineering)

4. **Database as Bottleneck**:
   - Query Supabase aggiungeva 1-2s latenza
   - Rimuoverla migliora sia performance che semplicità

---

## Conclusione

Cambio di paradigma da **"Seleziona da catalogo"** a **"Genera custom"**:
- ✅ Risolve timeout (27s → 5-8s stimato)
- ✅ Riduce complessità (no DB dependency)
- ✅ Migliora specificità (attività project-specific)
- ✅ Riduce token usage (-85%)
- ⚠️ Trade-off: Maggiore dipendenza da GPT quality (mitigato con prompt dettagliato)

**Stato**: Implementation complete, ready for testing
