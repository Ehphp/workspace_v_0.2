# Analisi: Attività Preset vs Attività Requisiti

## 📋 Problema Identificato

Le attività generate dall'AI nel wizard di creazione tecnologia sono **troppo orientate all'implementazione del progetto specifico** invece di essere **attività template riusabili** per stimare requisiti futuri.

### Comportamento Attuale (❌ Errato)

Quando l'utente crea una "Power Platform HR Dashboard", l'AI genera attività come:

```json
{
  "title": "Creazione schema Dataverse Employee",
  "description": "Implementare entità Employee con campi Nome, Email, Matricola, Reparto",
  "estimatedHours": 8
}
```

**Problema**: Questa attività è specifica per il progetto "HR Dashboard" e non è riusabile per altri requisiti Power Platform.

### Comportamento Desiderato (✅ Corretto)

Le attività dovrebbero essere **building blocks generici** per quella tecnologia:

```json
{
  "title": "Creazione entità Dataverse custom",
  "description": "Setup di una nuova entità Dataverse con campi standard, relazioni e business rules",
  "estimatedHours": 8
}
```

**Vantaggio**: Questa attività può essere riusata per stimare qualsiasi requisito che prevede la creazione di entità Dataverse.

---

## 🎯 Concetto Corretto: Tecnologia come Contesto

### Flusso Funzionale

```
1. User crea Tecnologia "Power Platform HR"
   └─> AI genera attività TEMPLATE per Power Platform
   
2. User aggiunge requisito "Gestione dipendenti"
   └─> Seleziona attività preset: ["Creazione entità custom", "Form con validation", ...]
   
3. User aggiunge requisito "Onboarding automatizzato"
   └─> Seleziona attività preset: ["Power Automate flow", "Email template", ...]
```

### Relazione Corretta

```
TECNOLOGIA (Preset)
├── Nome: "Power Platform HR"
├── Categoria: POWER_PLATFORM
└── Attività Template (riusabili):
    ├── "Creazione entità Dataverse custom"
    ├── "Configurazione form con business rules"
    ├── "Power Automate flow con approval"
    ├── "Canvas App con offline mode"
    └── "Deploy soluzione da dev a prod"

REQUISITO
├── Titolo: "Gestione anagrafica dipendenti"
├── Tecnologia: "Power Platform HR"
└── Attività selezionate:
    ├── "Creazione entità Dataverse custom" (8h)
    ├── "Configurazione form con business rules" (16h)
    └── "Deploy soluzione da dev a prod" (4h)
    → Totale: 28h
```

---

## 🔍 Criticità Implementazione Attuale

### 1. Prompt System (❌ Problema principale)

**File**: `netlify/functions/lib/ai/prompts/preset-generation.ts`

```typescript
export const PRESET_GENERATION_SYSTEM_PROMPT = `
Generate a Technology Preset with 6-10 TECHNOLOGY-SPECIFIC activities.

## POWER PLATFORM EXAMPLES

✅ "Creazione schema Dataverse Employee (Nome, Email, Matricola, Reparto lookup)" - 8h
✅ "Power Automate Flow onboarding: approval Manager, creazione account AD" - 32h
```

**Problema**: Gli esempi mostrano attività **specifiche del progetto** invece di **template generici**.

### 2. Nessun Catalogo di Riferimento

Il sistema attuale genera attività "from scratch" senza consultare un catalogo di attività standard per quella tecnologia.

**Problema**: Ogni preset genera attività diverse, anche per tecnologie simili → Inconsistenza e difficoltà di riuso.

### 3. Schema JSON Troppo Libero

```typescript
activities: {
    type: "array",
    items: {
        title: { type: "string", minLength: 10, maxLength: 150 },
        description: { type: "string", minLength: 20, maxLength: 500 },
        // Nessun constraint su "template-ness"
    }
}
```

**Problema**: L'AI può generare qualsiasi titolo/descrizione senza vincoli sulla genericità.

---

## 💡 Soluzione Proposta

### Approccio 1: Catalogo Base + AI Selection (✅ Raccomandato)

#### 1.1 Creare Catalogo Attività Template

Popolate `activities` table con attività template per ogni tecnologia:

```sql
-- Power Platform Templates
INSERT INTO activities (code, name, description, tech_category, base_hours, group) VALUES
('PP_ENTITY_CREATE', 'Creazione entità Dataverse custom', 
 'Setup di una nuova entità con campi, relazioni e security roles', 
 'POWER_PLATFORM', 8, 'DEV'),
 
('PP_FORM_CONFIG', 'Configurazione form Dataverse',
 'Creazione form con tab, sezioni, business rules e validation',
 'POWER_PLATFORM', 16, 'DEV'),
 
('PP_FLOW_APPROVAL', 'Power Automate approval flow',
 'Implementazione flow con approval multi-stage e notifiche',
 'POWER_PLATFORM', 24, 'DEV');

-- React Templates  
INSERT INTO activities (code, name, description, tech_category, base_hours, group) VALUES
('REACT_COMPONENT', 'Creazione componente React riusabile',
 'Sviluppo componente con props, state management e test',
 'FRONTEND', 8, 'DEV'),
 
('REACT_FORM_VALIDATION', 'Form React con validation',
 'Implementazione form con React Hook Form e schema validation',
 'FRONTEND', 16, 'DEV');
```

#### 1.2 Modificare AI Prompt per Selection

**Nuovo prompt**:
```typescript
export const PRESET_GENERATION_SYSTEM_PROMPT = `
You are a Technical Estimator. Generate a Technology Preset by SELECTING activities from the catalog.

## USER INPUT
Project: "${description}"
Answers: ${JSON.stringify(answers)}
Tech Category: "${techCategory}"

## AVAILABLE ACTIVITIES (Catalog)
${catalogActivities.map(a => `- ${a.code}: ${a.name} (${a.base_hours}h) - ${a.description}`).join('\n')}

## YOUR TASK
Select 6-10 activities from the catalog that best fit this project.
DO NOT create new activities - ONLY select codes from the catalog above.

OUTPUT:
{
  "success": true,
  "preset": {
    "name": "Short project name",
    "description": "Brief summary",
    "techCategory": "FRONTEND" | "BACKEND" | "POWER_PLATFORM" | "MULTI",
    "activityCodes": ["PP_ENTITY_CREATE", "PP_FORM_CONFIG", ...],  // ← Selection from catalog
    "driverValues": {...},
    "riskCodes": [...],
    "reasoning": "Why these activities fit the project"
  }
}
`;
```

#### 1.3 Passare Catalogo al Function

**File**: `netlify/functions/ai-generate-preset.ts`

```typescript
// 1. Fetch catalog activities for tech category
const { data: catalogActivities } = await supabaseServer
    .from('activities')
    .select('code, name, description, base_hours, group, tech_category')
    .or(`tech_category.eq.${body.suggestedTechCategory},tech_category.eq.MULTI`)
    .eq('active', true)
    .eq('is_custom', false); // Only standard activities

// 2. Build prompt with catalog
const systemPrompt = buildPresetPromptWithCatalog(
    sanitizedDescription,
    body.answers,
    body.suggestedTechCategory,
    catalogActivities
);

// 3. Call OpenAI with ENUM schema (only allowed codes)
const allowedCodes = catalogActivities.map(a => a.code);
const schema = createPresetSchemaWithCodeEnum(allowedCodes);
```

#### 1.4 Schema con Enum Constraint

```typescript
function createPresetSchemaWithCodeEnum(allowedCodes: string[]) {
    return {
        type: "object",
        properties: {
            preset: {
                type: "object",
                properties: {
                    activityCodes: {
                        type: "array",
                        minItems: 6,
                        maxItems: 10,
                        items: {
                            type: "string",
                            enum: allowedCodes  // ← Force selection from catalog
                        }
                    }
                }
            }
        }
    };
}
```

---

### Approccio 2: AI Generativa Raffinata (✅ Soluzione Raccomandata)

Mantenere la generazione AI ma con controlli multipli per garantire genericità e riusabilità.

#### 2.1 Prompt Engineering Avanzato

**Strategia Multi-Layer**:
1. **System prompt** con regole chiare e esempi negativi
2. **Validation prompt** che chiede all'AI di auto-verificare la genericità
3. **Post-processing** per rilevare pattern specifici

```typescript
export const PRESET_GENERATION_SYSTEM_PROMPT = `You are an expert Technical Estimator creating REUSABLE ACTIVITY TEMPLATES.

## CRITICAL UNDERSTANDING
You are NOT describing THIS specific project.
You are creating GENERIC BUILDING BLOCKS for ANY future project using this technology.

## THE TEST: "Can this activity be used for 10 different projects?"

❌ FAILS TEST (project-specific):
- "Creazione schema Dataverse Employee con campi Nome, Email, Matricola"
  → Only works for HR/Employee projects
- "API endpoint POST /auth/login con JWT"
  → Only works for login functionality
- "React component UserProfile con avatar e bio"
  → Only works for user profile feature

✅ PASSES TEST (reusable template):
- "Creazione entità Dataverse con campi custom e relazioni"
  → Works for ANY entity (Employee, Product, Order, Project...)
- "Endpoint API REST con autenticazione token-based"
  → Works for ANY authenticated endpoint
- "Componente React con form validation e state management"
  → Works for ANY form (profile, settings, checkout...)

## FORBIDDEN WORDS/PATTERNS
These indicate project-specific content - NEVER use them:
- Specific entity names: Employee, Product, Order, User, Customer
- Specific features: login, registration, checkout, payment, onboarding
- Specific endpoints: /auth/login, /api/users, /products/list
- Specific fields: Nome, Email, Prezzo, Quantità
- Specific screens: Dashboard, Profile, Settings

## ALLOWED PATTERNS
Use these generic terms:
- "entità custom", "master data", "transactional data"
- "form con validation", "flow multi-step", "componente riusabile"
- "endpoint CRUD", "API con autenticazione", "servizio integrazione"
- "campi standard", "relazioni 1:N", "lookup multipli"

## STRUCTURE YOUR ACTIVITIES BY TECHNICAL PATTERN

### Power Platform Templates
✅ "Setup entità Dataverse con security roles"
✅ "Form multi-tab con business rules e validation"
✅ "Power Automate flow con approval workflow"
✅ "Canvas App con offline sync e geolocalizzazione"
✅ "Model-driven App con dashboard e report custom"

### React/Frontend Templates
✅ "Componente React con state management (Context/Redux)"
✅ "Form complesso con validation schema (Yup/Zod)"
✅ "Integrazione API REST con error handling"
✅ "Routing protetto con autenticazione"
✅ "UI responsive con grid system e breakpoint"

### Backend/API Templates
✅ "Endpoint REST CRUD con pagination"
✅ "Middleware autenticazione JWT"
✅ "Servizio integrazione API esterna"
✅ "Background job processing con queue"
✅ "Database migration e seeding"

## OUTPUT FORMAT
{
  "activities": [
    {
      "title": "GENERIC technical pattern (no specific names!)",
      "description": "Implementation approach reusable across projects. Focus on WHAT/HOW, not specific content.",
      "estimatedHours": 8,
      "group": "DEV",
      "priority": "core",
      "acceptanceCriteria": [
        "Generic criteria (e.g., 'CRUD operations implemented')",
        "Not project-specific (e.g., NOT 'Employee fields created')"
      ]
    }
  ]
}

## SELF-CHECK BEFORE RESPONDING
For each activity, ask yourself:
1. "Could this activity title be used in 10+ different projects?" → If NO, make it more generic
2. "Does this contain ANY specific business entity/feature name?" → If YES, remove it
3. "Is this describing a technical pattern or a business requirement?" → Must be technical pattern
`;
```

#### 2.2 Two-Pass Generation con Auto-Validation

Invece di generare direttamente le attività, l'AI fa due passaggi:

**Pass 1: Generate Activity Categories**
```typescript
const categoriesPrompt = `
Based on this project: "${description}"
Tech: ${techCategory}

Generate 6-8 GENERIC activity categories (no details yet).
Focus on technical patterns, not business specifics.

Example output:
{
  "categories": [
    "Entity setup with relationships",
    "Form with validation rules",
    "Approval workflow automation",
    "Mobile app with offline mode"
  ]
}
`;
```

**Pass 2: Expand Categories with Generic Details**
```typescript
const detailsPrompt = `
For each category, provide implementation details.
CRITICAL: Keep it generic - no project-specific names!

Categories: ${JSON.stringify(categories)}

For each, generate:
- Generic title (reusable pattern)
- Implementation steps (technology-focused)
- Estimated hours
`;
```

#### 2.3 Post-Processing Validation con Pattern Detection

Dopo la generazione AI, validare automaticamente:

```typescript
interface ValidationResult {
    isGeneric: boolean;
    issues: string[];
    suggestions: string[];
}

function validateActivityGenericness(activity: GeneratedActivity): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // 1. Check for specific business terms
    const forbiddenTerms = [
        // Business entities
        /\b(employee|dipendent|user|cliente|prodotto|ordine|fattura)\b/i,
        // Specific features
        /\b(login|registra(tion|zione)|checkout|payment|onboarding|dashboard)\b/i,
        // Specific fields
        /\b(nome|cognome|email|telefono|indirizzo|prezzo|quantità)\b/i,
        // Specific endpoints
        /\/(auth|api|users|products|orders)\/[a-z]+/i,
    ];
    
    const title = activity.title.toLowerCase();
    const description = activity.description.toLowerCase();
    
    for (const pattern of forbiddenTerms) {
        if (pattern.test(title) || pattern.test(description)) {
            issues.push(`Contains project-specific term: ${pattern.source}`);
            suggestions.push('Replace with generic term (e.g., "entità custom", "master data")');
        }
    }
    
    // 2. Check for generic indicators
    const genericIndicators = [
        /\bcustom\b/i,
        /\bgeneric\b/i,
        /\btemplate\b/i,
        /\briusabile\b/i,
        /\bpattern\b/i,
    ];
    
    const hasGenericIndicator = genericIndicators.some(
        pattern => pattern.test(title) || pattern.test(description)
    );
    
    if (!hasGenericIndicator) {
        suggestions.push('Add generic qualifier (e.g., "custom", "riusabile", "template")');
    }
    
    // 3. Check title length (too specific = too long)
    if (title.length > 80) {
        issues.push('Title too long (likely too specific)');
        suggestions.push('Shorten to essential technical pattern');
    }
    
    // 4. Check for "and" conjunctions (sign of multiple specific things)
    const hasMultipleSpecifics = /\b(con|with)\b.*\b(e|and)\b.*\b(e|and)\b/i.test(title);
    if (hasMultipleSpecifics) {
        issues.push('Title lists multiple specific items');
        suggestions.push('Focus on one generic pattern per activity');
    }
    
    return {
        isGeneric: issues.length === 0,
        issues,
        suggestions
    };
}

// Usage in generation flow
async function generateAndValidatePreset(input: PresetInput): Promise<PresetResponse> {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const generatedPreset = await callOpenAI(input);
        
        // Validate each activity
        const validationResults = generatedPreset.activities.map(validateActivityGenericness);
        const failedActivities = validationResults.filter(r => !r.isGeneric);
        
        if (failedActivities.length === 0) {
            console.log('[generate-preset] All activities passed validation');
            return generatedPreset;
        }
        
        // If validation fails, regenerate with feedback
        console.log(`[generate-preset] ${failedActivities.length} activities failed validation, attempt ${attempts + 1}`);
        
        const feedbackPrompt = `
VALIDATION FAILED. These activities are too project-specific:

${failedActivities.map((result, i) => `
Activity ${i + 1}:
Issues: ${result.issues.join(', ')}
Suggestions: ${result.suggestions.join(', ')}
`).join('\n')}

Regenerate these activities as GENERIC TEMPLATES (no specific business terms).
`;
        
        input.additionalContext = feedbackPrompt;
        attempts++;
    }
    
    // If still failing after max attempts, return with warnings
    console.warn('[generate-preset] Some activities still not fully generic after max attempts');
    return generatedPreset;
}
```

#### 2.4 Normalization Layer

Applicare trasformazioni automatiche per rendere più generiche le attività:

```typescript
function normalizeActivityTitle(title: string): string {
    const normalizations: [RegExp, string][] = [
        // Replace specific entities with "entità custom"
        [/\b(employee|dipendente|user|utente|product|prodotto)\b/gi, 'entità custom'],
        
        // Replace specific features with generic terms
        [/\b(login|registrazione)\s+(form|page|screen)\b/gi, 'form autenticazione'],
        [/\b(dashboard|homepage|profile)\s+/gi, 'interfaccia '],
        
        // Replace specific fields with "campi custom"
        [/\bcon campi\s+(nome|email|telefono)(,\s*\w+)*/gi, 'con campi custom'],
        
        // Replace specific endpoints with generic
        [/endpoint\s+\/[a-z]+\/[a-z]+/gi, 'endpoint REST'],
        
        // Remove overly detailed specifications
        [/\s*\([^)]*employee[^)]*\)/gi, ''],
        [/\s*\([^)]*dipendent[^)]*\)/gi, ''],
    ];
    
    let normalized = title;
    for (const [pattern, replacement] of normalizations) {
        normalized = normalized.replace(pattern, replacement);
    }
    
    return normalized.trim();
}

function normalizeActivityDescription(description: string): string {
    // Remove specific examples and focus on pattern
    return description
        .replace(/esempio:\s*[^.]+\./gi, '') // Remove examples
        .replace(/\b(come|such as)\s+[^.]+\./gi, '') // Remove "such as" clauses
        .replace(/\(e\.g\.[^)]+\)/gi, ''); // Remove e.g. clauses
}
```

#### 2.5 Hybrid: AI Generation + Catalog Mapping

Compromesso tra generazione e selezione:

1. **AI genera** attività con descrizione dettagliata
2. **Sistema cerca** nel catalogo attività simili esistenti
3. **Se match >80%**: Usa attività catalogo (garantisce riuso)
4. **Se match <80%**: Propone all'utente di salvare come nuova attività template

```typescript
async function generateWithCatalogFallback(
    generatedActivities: GeneratedActivity[],
    catalogActivities: CatalogActivity[]
): Promise<Activity[]> {
    const finalActivities: Activity[] = [];
    
    for (const generated of generatedActivities) {
        // Find similar activity in catalog using semantic similarity
        const similar = findSimilarActivity(generated, catalogActivities);
        
        if (similar && similar.similarity > 0.8) {
            console.log(`Matched "${generated.title}" → catalog "${similar.activity.name}"`);
            finalActivities.push(similar.activity);
        } else {
            console.log(`New activity pattern: "${generated.title}"`);
            // Normalize before adding
            const normalized = {
                ...generated,
                title: normalizeActivityTitle(generated.title),
                description: normalizeActivityDescription(generated.description)
            };
            finalActivities.push(normalized);
        }
    }
    
    return finalActivities;
}
```

---

## 📊 Confronto Approcci Raffinati

| Approccio | Pro | Contro | Complessità |
|-----------|-----|--------|-------------|
| **Prompt Avanzato** | ✅ Semplice, nessun cambio architetturale | ⚠️ Dipende da AI, non garantito | Bassa |
| **Two-Pass + Validation** | ✅ Maggior controllo, feedback loop | ⚠️ 2x chiamate AI (più lento/costoso) | Media |
| **Post-Processing** | ✅ Deterministico, sempre applicato | ⚠️ Può non catturare tutti i casi | Media |
| **Normalization** | ✅ Garantisce uniformità | ⚠️ Può alterare intent originale | Bassa |
| **Hybrid AI+Catalog** | ✅✅ Best of both worlds | ⚠️ Richiede catalogo base | Alta |

---

## 💡 Soluzione Raccomandata: Combinazione Multi-Layer

**Stack di controlli progressivi**:

```
User Input → Description + Answers
       ↓
[1. Enhanced Prompt] ← Con esempi chiari good/bad
       ↓
[2. AI Generation] ← GPT genera attività
       ↓
[3. Post-Validation] ← Pattern detection automatica
       ↓
[4. Normalization] ← Trasformazioni automatiche
       ↓
[5. Catalog Matching] ← (Opzionale) Cerca match esistenti
       ↓
Final Activities → Generic & Reusable
```

### Vantaggi Stack Multi-Layer:
- ✅ **Layer 1-2**: Guida l'AI verso output corretto
- ✅ **Layer 3-4**: Corregge errori residui automaticamente  
- ✅ **Layer 5**: Incentiva riuso attività esistenti
- ✅ **Fallback**: Anche se un layer fallisce, altri compensano
- ✅ **Incremental**: Implementabile gradualmente

---

---

## 📊 Confronto Finale Approcci

| Criterio | Catalogo + Selection | AI Multi-Layer Raffinata | AI Semplice (Attuale) |
|----------|---------------------|-------------------------|---------------------|
| **Consistenza** | ✅✅✅ Alta | ✅✅ Buona | ⚠️ Bassa |
| **Riusabilità** | ✅✅✅ Alta | ✅✅ Buona | ❌ Bassa |
| **Manutenzione** | ⚠️ Richiede catalogo | ✅ Automatica | ✅ Nessuna |
| **Flessibilità** | ⚠️ Limitata | ✅✅✅ Alta | ✅✅✅ Alta |
| **Performance** | ✅✅ Veloce | ⚠️ Media (validation) | ✅✅ Veloce |
| **Qualità** | ✅✅✅ Garantita | ✅✅ Molto buona | ❌ Variabile |
| **Setup iniziale** | ⚠️⚠️ Alto | ⚠️ Medio | ✅ Nessuno |
| **AI Freedom** | ❌ Vincolata | ✅✅ Guidata | ✅✅✅ Libera |

**Raccomandazione**: **Approccio 2 (AI Multi-Layer)** per bilanciare flessibilità e qualità mantenendo la generazione AI.

---

## 🛠️ Piano di Implementazione (Approccio Multi-Layer)

### Fase 1: Enhanced Prompt (1 giorno) ⭐ START HERE

**File**: `netlify/functions/lib/ai/prompts/preset-generation.ts`

1. **Sostituire system prompt** con versione avanzata (vedi sezione 2.1)
   - Aggiungere esempi good/bad chiari
   - Liste forbidden words
   - Self-check questions

2. **Test immediato**
   ```bash
   # Testare con 5 progetti diversi
   curl -X POST localhost:8888/.netlify/functions/ai-generate-preset \
     -d '{"description": "HR Dashboard Power Platform", ...}'
   ```

3. **Misurare miglioramento**
   - Prima: % attività specifiche
   - Dopo: % attività generiche
   - Target: >80% generic

**Effort**: 1 giorno | **Impact**: Alto | **Risk**: Basso

---

### Fase 2: Post-Processing Validation (2 giorni)

**File**: `netlify/functions/lib/validation/activity-genericness-validator.ts` (nuovo)

1. **Implementare `validateActivityGenericness()`**
   - Pattern detection (forbidden terms)
   - Generic indicators check
   - Length/complexity checks

2. **Integrare in generation flow**
   ```typescript
   // In ai-generate-preset.ts
   const generated = await generatePreset(...);
   const validated = validateAndRefineActivities(generated.activities);
   ```

3. **Logging e metriche**
   - Tracciare % attività che falliscono validation
   - Identificare pattern comuni da aggiungere

**Effort**: 2 giorni | **Impact**: Alto | **Risk**: Basso

---

### Fase 3: Auto-Normalization (1 giorno)

**File**: `netlify/functions/lib/normalization/activity-normalizer.ts` (nuovo)

1. **Implementare transformation functions**
   - `normalizeActivityTitle()`
   - `normalizeActivityDescription()`
   - Pattern replacement rules

2. **Applicare post-AI**
   ```typescript
   const normalized = activities.map(a => ({
     ...a,
     title: normalizeActivityTitle(a.title),
     description: normalizeActivityDescription(a.description)
   }));
   ```

3. **Test trasformazioni**
   - Input: "Creazione schema Employee con Nome, Email"
   - Output: "Creazione entità custom con campi standard"

**Effort**: 1 giorno | **Impact**: Medio | **Risk**: Basso

---

### Fase 4: Feedback Loop (Opzionale, 2 giorni)

**Enhancement**: Rigenerazione automatica se validation fallisce

1. **Implementare retry logic**
   ```typescript
   let attempts = 0;
   while (attempts < 3 && !allActivitiesValid) {
     generatedPreset = await regenerateWithFeedback(feedbackPrompt);
     attempts++;
   }
   ```

2. **Build feedback prompt** da validation errors
   - "Activity X is too specific because..."
   - "Replace Y with generic term Z"

3. **Metriche success rate**
   - % casi risolti al 1° attempt
   - % casi risolti al 2°/3° attempt
   - % casi ancora problematici

**Effort**: 2 giorni | **Impact**: Medio-Alto | **Risk**: Medio

---

### Fase 5: Catalog Matching (Opzionale, 3 giorni)

**Enhancement**: Riuso attività esistenti quando possibile

1. **Setup base catalog** (ridotto, 20-30 attività comuni)
2. **Implementare similarity matching**
   - Embedding-based (OpenAI embeddings)
   - O keyword-based (più semplice)
3. **Suggerire match all'utente** in review step

**Effort**: 3 giorni | **Impact**: Medio | **Risk**: Basso

---

### Timeline Consigliata

**Quick Wins** (1-2 settimane):
- ✅ Fase 1: Enhanced Prompt (settimana 1)
- ✅ Fase 2: Validation (settimana 1-2)
- ✅ Fase 3: Normalization (settimana 2)
- ⏸️ Deploy & test in produzione

**Enhancements** (opzionali, settimane successive):
- Fase 4: Feedback Loop
- Fase 5: Catalog Matching

**Totale Quick Wins**: 4 giorni lavorativi  
**Totale con Enhancements**: 9 giorni lavorativi

---

## ✅ Checklist Implementazione (Approccio Multi-Layer)

### Fase 1: Enhanced Prompt ⭐ PRIORITY
- [ ] Aggiornare `PRESET_GENERATION_SYSTEM_PROMPT` in `preset-generation.ts`
  - [ ] Aggiungere sezione "CRITICAL UNDERSTANDING"
  - [ ] Inserire esempi good/bad chiari
  - [ ] Liste forbidden words/patterns
  - [ ] Self-check questions
- [ ] Test con 5 progetti diversi (HR, E-commerce, CRM, Dashboard, API)
- [ ] Misurare baseline: % attività generiche prima/dopo
- [ ] Target: >80% attività passano "10 projects test"

### Fase 2: Post-Validation
- [ ] Creare file `netlify/functions/lib/validation/activity-genericness-validator.ts`
- [ ] Implementare `validateActivityGenericness(activity)`
  - [ ] Forbidden terms patterns
  - [ ] Generic indicators check
  - [ ] Length/complexity validation
  - [ ] "and" conjunction detection
- [ ] Implementare `validateActivities(activities[])`
- [ ] Integrare in `ai-generate-preset.ts` dopo AI call
- [ ] Logging: track validation failures + patterns
- [ ] Test con attività problematiche note

### Fase 3: Auto-Normalization
- [ ] Creare file `netlify/functions/lib/normalization/activity-normalizer.ts`
- [ ] Implementare `normalizeActivityTitle(title)`
  - [ ] Entity name replacements
  - [ ] Feature name replacements
  - [ ] Field list replacements
  - [ ] Endpoint path replacements
- [ ] Implementare `normalizeActivityDescription(description)`
  - [ ] Remove examples
  - [ ] Remove "such as" clauses
  - [ ] Remove overly specific details
- [ ] Test transformation rules
- [ ] Applicare in pipeline dopo validation

### Fase 4: Testing & Metrics
- [ ] Test con 20+ progetti diversi
- [ ] Calcolare metriche:
  - [ ] % attività generiche (target >80%)
  - [ ] % attività che richiedono normalizzazione
  - [ ] Tempo generazione medio
  - [ ] Variance tra generazioni simili
- [ ] Raccogliere feedback utenti beta
- [ ] Iterare su prompt basandosi su failure patterns

### Fase 5: Documentation
- [ ] Documentare in `docs/ai/ai-preset-generation.md`
- [ ] Aggiornare `README.md` con nuova logica
- [ ] Aggiornare `docs/ai/ai-system-overview.md`
- [ ] Creare guida utente "Come creare preset efficaci"

### Opzionali (Post-MVP)
- [ ] Feedback loop con retry (Fase 4)
- [ ] Catalog matching per riuso (Fase 5)
- [ ] A/B testing: prompt v1 vs v2
- [ ] Embeddings-based similarity per duplicates detection

---

## 📚 File da Modificare

1. **Backend**
   - `netlify/functions/lib/ai/prompts/preset-generation.ts`
   - `netlify/functions/ai-generate-preset.ts`
   - `netlify/functions/lib/ai/actions/generate-preset.ts`

2. **Database**
   - Nuovo: `supabase_activity_templates.sql`

3. **Documentazione**
   - Nuovo: `docs/ai/ai-preset-generation.md`
   - Update: `README.md`
   - Update: `docs/ai/ai-system-overview.md`

4. **Frontend** (minime modifiche)
   - `src/types/ai-preset-generation.ts` (se serve aggiornare types)

---

## 🎯 Risultato Finale

### Prima (❌)
```
Tecnologia: "Power Platform HR Dashboard"
Attività generate:
- "Creazione schema Employee con Nome, Email, Matricola"  ← Specifica progetto
- "Flow onboarding con approval Manager"                  ← Specifica progetto
```

### Dopo (✅)
```
Tecnologia: "Power Platform HR Dashboard"  
Attività selezionate dal catalogo:
- "Creazione entità Dataverse custom"      ← Template riusabile
- "Power Automate flow con approval"       ← Template riusabile
- "Form Dataverse con business rules"      ← Template riusabile
```

Quando l'utente aggiunge un requisito "Gestione dipendenti", può selezionare le stesse attività template e stimare le ore!
