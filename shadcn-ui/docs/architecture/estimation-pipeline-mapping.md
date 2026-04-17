# Mapping Tabella Funzionale → Codebase

> **Data generazione:** 2026-04-16  
> **Metodo:** Analisi rigorosa della codebase con vincolo di veridicità — nessuna inferenza non supportata dal codice.

---

## Tabella di Mapping

### Passaggio 1 — Comprensione del requisito

| Campo | Valore |
|---|---|
| **Funzione** | Trasformare il testo grezzo in un problema chiaro |
| **Domanda** | "Che cosa vuole davvero il richiedente?" |
| **Output atteso** | Obiettivo, risultato atteso, contesto |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Artefatto AI dedicato con pipeline completa (prompt → LLM → validazione Zod → cache → DB → UI review) |
| **Evidenza codebase** | `generateRequirementUnderstanding()` in `generate-understanding.ts`; endpoint POST `ai-requirement-understanding`; tipo `RequirementUnderstanding` con campi `businessObjective`, `expectedOutput`, `complexityAssessment`; prompt system `UNDERSTANDING_SYSTEM_PROMPT` in `understanding-generation.ts`; persistenza JSONB in tabella `requirement_understanding`; UI review con conferma utente |
| **File/Path principali** | `netlify/functions/lib/ai/actions/generate-understanding.ts`; `netlify/functions/lib/ai/prompts/understanding-generation.ts`; `netlify/functions/ai-requirement-understanding.ts`; `src/lib/requirement-understanding-api.ts`; `src/types/requirement-understanding.ts`; `src/components/requirements/wizard/WizardStepUnderstanding.tsx`; `src/components/requirements/wizard/RequirementUnderstandingCard.tsx` |
| **Simboli rilevanti** | `RequirementUnderstanding`; `generateRequirementUnderstanding()`; `UNDERSTANDING_SYSTEM_PROMPT`; `createUnderstandingResponseSchema()`; `WizardStepUnderstanding`; `RequirementUnderstandingCard`; `requirementUnderstandingConfirmed` |
| **Livello architetturale** | UI; API client; endpoint backend; domain service (AI action); prompt/schema; DB schema; state management |
| **Note** | Artefatto completo: generato da gpt-4o-mini (temp=0.2), validato con Zod, cachettato 12h, versionato per requirement_id. L'utente può confermare, rigenerare o saltare. Downstream alimenta ImpactMap, Blueprint, Interview. |
| **Ambiguità / Gap** | Nessuna ambiguità significativa. Il campo `confidence` (0–1) è presente ma non bloccante. |

---

### Passaggio 2 — Delimitazione del perimetro

| Campo | Valore |
|---|---|
| **Funzione** | Separare ciò che è dentro da ciò che è fuori |
| **Domanda** | "Che cosa stiamo stimando e che cosa no?" |
| **Output atteso** | In scope / out of scope |
| **Stato mapping** | **AGGREGATA IN ALTRA FUNZIONE** |
| **Tipo di corrispondenza** | Campi strutturati dentro l'artefatto RequirementUnderstanding (Step 1) |
| **Evidenza codebase** | `functionalPerimeter: string[]` (1–8 items in-scope) e `exclusions: string[]` (0–5 items out-of-scope) in `RequirementUnderstanding`; prompt esplicito: "Elenca da 1 a 8 punti che definiscono cosa è IN SCOPE" e "Elenca da 0 a 5 punti che definiscono cosa è ESCLUSO"; stessa generazione/validazione/cache di Step 1; campo `exclusions` duplicato anche in `EstimationBlueprint` |
| **File/Path principali** | `src/types/requirement-understanding.ts`; `netlify/functions/lib/ai/prompts/understanding-generation.ts`; `src/types/estimation-blueprint.ts` |
| **Simboli rilevanti** | `functionalPerimeter`; `exclusions` (su RequirementUnderstanding); `exclusions` (su EstimationBlueprint) |
| **Livello architetturale** | Stessi layer di Step 1 (generazione + review avvengono nello stesso step wizard) |
| **Note** | Non esiste come step autonomo. In-scope ed out-of-scope sono campi dell'artefatto `RequirementUnderstanding`, generati nella stessa chiamata AI del Step 1. Anche il Blueprint ha un proprio campo `exclusions[]` (ripetizione). |
| **Ambiguità / Gap** | La tabella prevede uno step dedicato; nella codebase è un sottoinsieme dei campi dell'artefatto Understanding. Il campo `exclusions` è presente sia in Understanding che in Blueprint senza logica di merge visibile. |

---

### Passaggio 3 — Identificazione degli attori e dei flussi

| Campo | Valore |
|---|---|
| **Funzione** | Capire chi usa cosa e come si muove l'informazione |
| **Domanda** | "Chi interagisce con il sistema e attraverso quali passaggi?" |
| **Output atteso** | Attori, trigger, input, output, workflow |
| **Stato mapping** | **AGGREGATA IN ALTRA FUNZIONE** |
| **Tipo di corrispondenza** | Campi strutturati dentro l'artefatto RequirementUnderstanding (Step 1) |
| **Evidenza codebase** | `actors: RequirementActor[]` (1–5 attori con `type: 'human'\|'system'`, `role`, `interaction`, `interactionMode: 'manual'\|'automated'\|'api_ingestion'`); `stateTransition: { initialState, finalState }` (workflow before/after); `preconditions: string[]` (0–5 trigger/dipendenze); `assumptions: string[]` (0–5 chiarimenti) — tutti campi di `RequirementUnderstanding` |
| **File/Path principali** | `src/types/requirement-understanding.ts`; `netlify/functions/lib/ai/prompts/understanding-generation.ts` |
| **Simboli rilevanti** | `RequirementActor`; `ActorType`; `ActorInteractionMode`; `StateTransition`; `preconditions`; `assumptions` |
| **Livello architetturale** | Stessi layer di Step 1 |
| **Note** | Non esiste come step autonomo. Attori, trigger, workflow sono campi strutturati dell'artefatto Understanding, generati nella stessa chiamata AI. `stateTransition` è binario (before/after), non cattura flussi multi-step. |
| **Ambiguità / Gap** | La tabella implica un'analisi di workflow sequenziale (step-by-step); la codebase implementa solo una transizione di stato lineare (initialState → finalState) senza coreografia dettagliata degli attori. `preconditions` cattura dipendenze ma senza priorità. |

---

### Passaggio 4 — Analisi dell'impatto sul sistema

| Campo | Valore |
|---|---|
| **Funzione** | Capire dove il requisito tocca l'architettura |
| **Domanda** | "Quali aree tecniche vengono modificate?" |
| **Output atteso** | Aree impattate: UI, backend, dati, integrazioni, sicurezza, ecc. |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Artefatto AI dedicato con pipeline completa (prompt → LLM → validazione → cache → DB → UI review) |
| **Evidenza codebase** | `generateImpactMap()` in `generate-impact-map.ts`; tipo `ImpactMap` con `impacts: ImpactItem[]` dove ogni item ha `layer` (frontend\|logic\|data\|integration\|automation\|configuration\|ai_pipeline), `action` (read\|modify\|create\|configure), `components[]`, `reason`, `confidence`; endpoint `ai-impact-map`; tabella DB `impact_map` (JSONB) |
| **File/Path principali** | `netlify/functions/lib/ai/actions/generate-impact-map.ts`; `netlify/functions/lib/ai/prompts/impact-map-generation.ts`; `netlify/functions/ai-impact-map.ts`; `src/lib/impact-map-api.ts`; `src/types/impact-map.ts`; `src/components/requirements/wizard/WizardStepTechnicalAnalysis.tsx`; `src/components/requirements/wizard/ImpactMapCard.tsx`; `netlify/functions/lib/impact-map-signal-extractor.ts` |
| **Simboli rilevanti** | `ImpactMap`; `ImpactItem`; `generateImpactMap()`; `IMPACT_MAP_SYSTEM_PROMPT`; `WizardStepTechnicalAnalysis` (fase 1/2); `ImpactMapCard`; `extractImpactMapSignals()` |
| **Livello architetturale** | UI; API client; endpoint backend; domain service (AI action); prompt/schema; DB schema; signal extraction |
| **Note** | Artefatto completo: 7 layer architetturali, 4 tipi di azione, componenti per layer. Generato da gpt-4o-mini, cachettato 12h. Iniettato downstream in Blueprint e in CandidateBuilder tramite `extractImpactMapSignals()`. UI: fase 1 di `WizardStepTechnicalAnalysis`. |
| **Ambiguità / Gap** | La tabella menziona "sicurezza" come area impattata; nella codebase la security non è un layer esplicito (potrebbe ricadere in `logic` o `configuration`). Nessun layer dedicato per security/performance. |

---

### Passaggio 5 — Decomposizione tecnica

| Campo | Valore |
|---|---|
| **Funzione** | Spezzare il requisito in blocchi di lavoro stimabili |
| **Domanda** | "Da quali parti di lavoro concrete è composto?" |
| **Output atteso** | Lista componenti/task tecnici |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Artefatto AI dedicato (EstimationBlueprint) con decomposizione strutturata in 4 dimensioni |
| **Evidenza codebase** | `generateEstimationBlueprint()` in `generate-estimation-blueprint.ts`; tipo `EstimationBlueprint` con `components[]` (name, layer, interventionType, complexity, notes), `integrations[]` (target, type, direction), `dataEntities[]` (entity, operation), `testingScope[]` (area, testType, criticality); mapping deterministico blueprint→activities via `mapBlueprintToActivities()` in `blueprint-activity-mapper.ts`; tabella DB `estimation_blueprint` (JSONB) |
| **File/Path principali** | `netlify/functions/lib/ai/actions/generate-estimation-blueprint.ts`; `netlify/functions/lib/ai/prompts/blueprint-generation.ts`; `netlify/functions/ai-estimation-blueprint.ts`; `src/lib/estimation-blueprint-api.ts`; `src/types/estimation-blueprint.ts`; `src/components/requirements/wizard/EstimationBlueprintCard.tsx`; `src/components/requirements/wizard/WizardStepTechnicalAnalysis.tsx`; `netlify/functions/lib/blueprint-activity-mapper.ts` |
| **Simboli rilevanti** | `EstimationBlueprint`; `BlueprintComponent`; `BlueprintIntegration`; `BlueprintDataEntity`; `BlueprintTestingScope`; `generateEstimationBlueprint()`; `mapBlueprintToActivities()`; `LAYER_TECH_PATTERNS`; `EstimationBlueprintCard`; `WizardStepTechnicalAnalysis` (fase 2/2) |
| **Livello architetturale** | UI; API client; endpoint backend; domain service (AI action); prompt/schema; DB schema; deterministic mapper |
| **Note** | Blueprint descrive COSA costruire (anatomia tecnica), NON quanto costa. 4 dimensioni: components (layer × intervention × complexity), integrations, data entities, testing scope. Downstream: mapping deterministico a attività catalogo via `LAYER_TECH_PATTERNS`. |
| **Ambiguità / Gap** | Il Blueprint NON produce task/WBS ma componenti architetturali. La trasformazione in "blocchi di lavoro stimabili" avviene nel mapper (`blueprint-activity-mapper.ts`), non nel Blueprint stesso. La tabella implica blocchi di lavoro direttamente; la codebase separa decomposizione (Blueprint) da mappatura ad attività (Mapper). |

---

### Passaggio 6 — Classificazione del tipo di intervento

| Campo | Valore |
|---|---|
| **Funzione** | Distinguere la natura del lavoro |
| **Domanda** | "È nuova costruzione, modifica, configurazione, bugfix, integrazione?" |
| **Output atteso** | Tipologia di intervento per ogni blocco |
| **Stato mapping** | **AGGREGATA IN ALTRA FUNZIONE** |
| **Tipo di corrispondenza** | Campo strutturato per-componente nell'EstimationBlueprint (Step 5) + campo per-attività in project_activities |
| **Evidenza codebase** | `BlueprintComponent.interventionType`: `'new_development'\|'modification'\|'configuration'\|'integration'\|'migration'` (5 valori, schema LLM in `blueprint-generation.ts`); `ImpactItem.action`: `'read'\|'modify'\|'create'\|'configure'` (4 azioni nel ImpactMap); `project_activities.intervention_type` DB: `CHECK (intervention_type IN ('NEW','MODIFY','CONFIGURE','MIGRATE'))` (4 valori UPPERCASE) |
| **File/Path principali** | `src/types/estimation-blueprint.ts`; `netlify/functions/lib/ai/prompts/blueprint-generation.ts`; `netlify/functions/lib/domain/pipeline/pipeline-domain.ts`; `netlify/functions/lib/domain/project/project-activity.types.ts`; `src/components/requirements/wizard/EstimationBlueprintCard.tsx` |
| **Simboli rilevanti** | `InterventionType` (pipeline-domain.ts: 5 valori lowercase); `InterventionType` (project-activity.types.ts: 4 valori UPPERCASE); `interventionBadge` mapping in EstimationBlueprintCard; `ImpactItem.action` |
| **Livello architetturale** | Tipi; prompt AI; UI (badge); DB schema (project_activities) |
| **Note** | Non è uno step autonomo. La classificazione è un attributo per-componente nel Blueprint e un attributo per-attività nelle project_activities. L'AI assegna il tipo durante la generazione del Blueprint. |
| **Ambiguità / Gap** | **Mismatch critico**: LLM output ha 5 valori (`new_development\|modification\|configuration\|integration\|migration`), DB `project_activities` ne accetta 4 (`NEW\|MODIFY\|CONFIGURE\|MIGRATE`). Nessuna funzione di conversione visibile. Il valore `integration` non ha mapping DB. La tabella menziona "bugfix" che NON esiste nella codebase. Due definizioni separate di `InterventionType` con valori diversi. |

---

### Passaggio 7 — Valutazione della complessità intrinseca

| Campo | Valore |
|---|---|
| **Funzione** | Stimare la difficoltà tecnica pura |
| **Domanda** | "Quanto è complesso realizzare questo blocco, in sé?" |
| **Output atteso** | Complessità bassa/media/alta o punteggio |
| **Stato mapping** | **DISTRIBUITA SU PIÙ PUNTI** |
| **Tipo di corrispondenza** | Complessità valutata a 3 livelli indipendenti: Understanding, Blueprint per-componente, routing a moltiplicatori catalogo |
| **Evidenza codebase** | `ComplexityAssessment { level: 'LOW'\|'MEDIUM'\|'HIGH', rationale }` in `RequirementUnderstanding`; `BlueprintComponent.complexity: 'LOW'\|'MEDIUM'\|'HIGH'` per-componente; routing `sm_multiplier`/`lg_multiplier` su attività catalogo (tabella `activities`); `complexityToVariant()` in `understanding-signal-extractor.ts` mappa LOW→_SM, HIGH→_LG; `overallConfidence` (0–1) su tutti gli artefatti |
| **File/Path principali** | `src/types/requirement-understanding.ts`; `src/types/estimation-blueprint.ts`; `netlify/functions/lib/understanding-signal-extractor.ts`; `netlify/functions/lib/blueprint-activity-mapper.ts`; `netlify/functions/lib/domain/pipeline/pipeline-domain.ts`; `supabase_schema.sql` (colonne `sm_multiplier`, `lg_multiplier`) |
| **Simboli rilevanti** | `ComplexityAssessment`; `COMPLEXITY_LEVELS`; `complexityToVariant()`; `sm_multiplier`; `lg_multiplier`; `overallConfidence`; `BlueprintComponent.complexity` |
| **Livello architetturale** | Tipi; AI prompt; signal extraction; deterministic mapper; DB schema (catalogo attività) |
| **Note** | 3 punti di valutazione: (a) Understanding dà assessment complessivo con rationale, (b) Blueprint dà complessità per-componente, (c) Signal extractor traduce complessità in routing _SM/_LG che scala `base_hours` tramite moltiplicatori catalogo (es. LOW: ×0.50, HIGH: ×2.00). |
| **Ambiguità / Gap** | La tabella prevede un singolo step; nella codebase la complessità è valutata in almeno 3 punti diversi della pipeline. Non esiste un punto unico che "decide" la complessità — è distribuita tra AI (generazione) e logica deterministica (routing). La relazione tra complessità Understanding-level e Blueprint-component-level non è esplicitamente riconciliata. |

---

### Passaggio 8 — Valutazione delle dipendenze e delle incertezze

| Campo | Valore |
|---|---|
| **Funzione** | Capire cosa può rallentare o falsare la stima |
| **Domanda** | "Da cosa dipende? Cosa non sappiamo?" |
| **Output atteso** | Assunzioni, rischi, dipendenze |
| **Stato mapping** | **DISTRIBUITA SU PIÙ PUNTI** |
| **Tipo di corrispondenza** | Informazioni distribuite su più artefatti (Understanding, Blueprint) + catalogo rischi + driver AI-suggeriti |
| **Evidenza codebase** | `RequirementUnderstanding.assumptions[]` + `preconditions[]`; `EstimationBlueprint.assumptions[]` + `uncertainties[]` + `exclusions[]`; `SuggestedDriver[]` e `suggestedRisks[]` nell'output di `ai-estimate-from-interview`; tabelle DB `estimation_drivers` e `estimation_risks`; regole deterministiche in `project-context-rules.ts` e `blueprint-rules.ts` |
| **File/Path principali** | `src/types/requirement-understanding.ts`; `src/types/estimation-blueprint.ts`; `src/types/requirement-interview.ts`; `netlify/functions/ai-estimate-from-interview.ts`; `netlify/functions/lib/domain/estimation/project-context-rules.ts`; `netlify/functions/lib/domain/estimation/blueprint-rules.ts` |
| **Simboli rilevanti** | `assumptions` (su Understanding e Blueprint); `uncertainties` (su Blueprint); `preconditions` (su Understanding); `SuggestedDriver`; `suggestedRisks`; `estimation_drivers`; `estimation_risks`; `risk_score` |
| **Livello architetturale** | Tipi; AI prompt; endpoint backend; DB schema; domain service (rules) |
| **Note** | Dipendenze/incertezze emergono in 4 momenti: (1) Understanding produce assumptions + preconditions, (2) Blueprint produce uncertainties + assumptions + exclusions, (3) Interview flow produce suggestedDrivers + suggestedRisks, (4) regole deterministiche (project-context-rules, blueprint-rules) derivano suggerimenti da contesto. |
| **Ambiguità / Gap** | La tabella prevede un singolo step; nella codebase le informazioni sono disperse su almeno 4 punti della pipeline. `assumptions` è duplicato tra Understanding e Blueprint senza merge visibile. I rischi sono un catalogo pre-definito (`risks` table) con weight, non un'analisi dinamica delle incertezze. Le "dipendenze" come concetto esplicito non sono tracciate separatamente — ricadono in `preconditions`. |

---

### Passaggio 9 — Stima elementare dei blocchi

| Campo | Valore |
|---|---|
| **Funzione** | Attribuire una stima ai singoli pezzi |
| **Domanda** | "Quanto costa realizzare ogni parte?" |
| **Output atteso** | Stima per componente/task |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Mapping deterministico Blueprint→Attività catalogo, ogni attività ha `base_hours` pre-definite |
| **Evidenza codebase** | `SelectedActivityWithReason.baseHours` (ore per attività) in `requirement-interview.ts`; `activities.base_hours` nel catalogo DB; routing complessità: `sm_multiplier` × `base_hours` (LOW) o `lg_multiplier` × `base_hours` (HIGH); `mapBlueprintToActivities()` traduce componenti Blueprint in attività catalogo con ore; `project_activities.base_hours` + `effort_modifier` per override progetto; AI seleziona codici attività, ore vengono dal catalogo |
| **File/Path principali** | `src/types/requirement-interview.ts`; `netlify/functions/lib/blueprint-activity-mapper.ts`; `netlify/functions/ai-estimate-from-interview.ts`; `netlify/functions/lib/candidate-builder.ts`; `supabase_schema.sql` (tabella `activities`); `supabase_seed.sql`; `src/components/estimation/SelectedActivitiesPanel.tsx` |
| **Simboli rilevanti** | `SelectedActivityWithReason`; `baseHours`; `base_hours`; `sm_multiplier`; `lg_multiplier`; `effort_modifier`; `mapBlueprintToActivities()`; `buildCandidateSet()`; `selectTopActivities()`; `SelectedActivitiesPanel` |
| **Livello architetturale** | Tipi; AI response; deterministic mapper; candidate builder; DB schema (catalogo); UI |
| **Note** | Le ore NON sono stimate dall'AI per ogni blocco: l'AI seleziona codici attività dal catalogo, e le ore derivano dal campo `base_hours` pre-definito nel catalogo + routing complessità (_SM/_LG). Le `project_activities` permettono override per progetto con `effort_modifier`. |
| **Ambiguità / Gap** | La tabella implica una stima attiva per-blocco; nella codebase la stima elementare è un LOOKUP da catalogo pre-definito, non un calcolo ad-hoc. L'AI decide QUALI attività servono, ma le ore sono fissate nel catalogo. Se un componente Blueprint non mappa a nessuna attività catalogo, non ha stima (gap di copertura segnalato dal `coverage` report). |

---

### Passaggio 10 — Composizione della stima complessiva

| Campo | Valore |
|---|---|
| **Funzione** | Sommare in modo coerente |
| **Domanda** | "Qual è la stima aggregata?" |
| **Output atteso** | Totale base |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Funzione pura deterministica: somma ore attività / 8 = giorni base |
| **Evidenza codebase** | `computeEstimation(input)` in `estimation-engine.ts` L28; `calculateBaseDays()` L53: `Σ(activity.baseHours) / 8`; `EstimationResult.baseDays`; frontend SDK wrapper `EstimationEngineSDK.calculateBaseDays()` in `EstimationEngine.ts`; `finalizeEstimation()` in `estimation-utils.ts` L82; breakdown by group/tech calcolato ma non persistito; test: `estimationConsistency.test.ts` valida `(16+8+4)/8 = 3.5` |
| **File/Path principali** | `netlify/functions/lib/domain/estimation/estimation-engine.ts`; `netlify/functions/lib/domain/types/estimation.ts`; `src/lib/sdk/EstimationEngine.ts`; `src/lib/estimationEngine.ts`; `src/lib/estimation-utils.ts`; `src/components/estimation/CalculationSummary.tsx`; `src/test/estimationConsistency.test.ts` |
| **Simboli rilevanti** | `computeEstimation()`; `calculateBaseDays()`; `EstimationInput`; `EstimationResult`; `baseDays`; `subtotal`; `finalizeEstimation()`; `interviewFinalizeEstimation()`; `CalculationSummary` |
| **Livello architetturale** | Domain service (puro calcolo); SDK wrapper; frontend facade; UI; test |
| **Note** | Formula: `baseDays = Σ(baseHours) / 8`, poi `subtotal = baseDays × driverMultiplier`. Calcolo deterministico, testato, replicato identicamente tra backend (`estimation-engine.ts`) e frontend (`EstimationEngine.ts` SDK). Breakdown per gruppo (ANALYSIS/DEV/TEST/OPS/GOVERNANCE) calcolato in-memory. |
| **Ambiguità / Gap** | Nessuna ambiguità. Il breakdown per gruppo/tecnologia è calcolato ma non persistito in DB (solo il totale `base_days` e `total_days` sono salvati). |

---

### Passaggio 11 — Applicazione di driver correttivi

| Campo | Valore |
|---|---|
| **Funzione** | Adattare la stima al contesto reale |
| **Domanda** | "Ci sono fattori organizzativi/tecnici che aumentano o riducono lo sforzo?" |
| **Output atteso** | Moltiplicatori o aggiustamenti |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Calcolo deterministico: prodotto dei moltiplicatori driver selezionati |
| **Evidenza codebase** | `calculateDriverMultiplier()` in `estimation-engine.ts` L59: `Π(driver.multiplier)`, default 1.0; catalogo driver in tabella DB `drivers` con `options JSONB` (ogni opzione ha `{ value, label, multiplier }`); selezione utente in WizardStep4 e DriversSection; AI suggerisce driver via `SuggestedDriver[]` in response `ai-estimate-from-interview`; risoluzione valori: `resolveWizardDrivers()` in `domain-save.ts`; persistenza in `estimation_drivers` junction table + `estimations.driver_multiplier`; RPC `save_estimation_atomic` accetta `p_driver_multiplier DECIMAL(5,3)` |
| **File/Path principali** | `netlify/functions/lib/domain/estimation/estimation-engine.ts`; `netlify/functions/lib/domain/types/estimation.ts`; `src/lib/domain-save.ts`; `src/components/estimation/DriversSection.tsx`; `src/components/requirements/wizard/WizardStep4.tsx`; `src/lib/export/pdfGenerator.ts`; `src/test/estimationConsistency.test.ts` |
| **Simboli rilevanti** | `calculateDriverMultiplier()`; `SelectedDriver`; `SuggestedDriver`; `resolveWizardDrivers()`; `resolveDriversById()`; `driver_multiplier`; `estimation_drivers`; `DriversSection`; `WizardStep4` |
| **Livello architetturale** | Domain service (calcolo); DB schema (catalogo + junction); UI (selezione + display); export (PDF/Excel/CSV); test |
| **Note** | Formula: `driverMultiplier = Π(selected_drivers.multiplier)`. Driver sono catalogo pre-definito con opzioni a scelta. L'AI suggerisce valori ma l'utente può modificarli. Persistiti sia il moltiplicatore aggregato che le singole selezioni. Esportati in PDF/Excel/CSV. |
| **Ambiguità / Gap** | Nessuna ambiguità significativa. Le opzioni driver sono JSONB (flessibili ma non normalizzate). |

---

### Passaggio 12 — Applicazione della contingenza

| Campo | Valore |
|---|---|
| **Funzione** | Coprire l'incertezza residua |
| **Domanda** | "Quanto margine serve per non raccontare una favola?" |
| **Output atteso** | Buffer / contingency |
| **Stato mapping** | **MATCH** |
| **Tipo di corrispondenza** | Calcolo deterministico: step function risk_score → contingency % |
| **Evidenza codebase** | `calculateContingency(riskScore)` in `estimation-engine.ts` L72: step function (≤10→10%, ≤20→15%, ≤30→20%, >30→25%); `calculateRiskScore()` L66: `Σ(risk.weight)`; `contingencyDays = subtotal × contingencyPercent`; `totalDays = subtotal + contingencyDays`; catalogo rischi in tabella DB `risks` con `weight INTEGER`; selezione utente in WizardStep4; AI suggerisce rischi via `suggestedRisks[]`; persistenza in `estimation_risks` junction + `estimations.risk_score` + `estimations.contingency_percent`; test boundary in `estimationConsistency.test.ts` |
| **File/Path principali** | `netlify/functions/lib/domain/estimation/estimation-engine.ts`; `netlify/functions/lib/domain/types/estimation.ts`; `src/components/requirements/wizard/WizardStep4.tsx`; `src/lib/export/pdfGenerator.ts`; `src/test/estimationConsistency.test.ts`; `supabase_save_estimation_rpc.sql` |
| **Simboli rilevanti** | `calculateContingency()`; `calculateRiskScore()`; `SelectedRisk`; `riskScore`; `contingencyPercent`; `contingencyDays`; `totalDays`; `estimation_risks` |
| **Livello architetturale** | Domain service (calcolo); DB schema (catalogo + junction + colonne estimations); UI; export; test |
| **Note** | Formula: `riskScore = Σ(weights)`, poi step function a 4 soglie. Contingenza applicata come % sul subtotal (baseDays × driverMultiplier). I rischi sono catalogo pre-definito con peso fisso, non un'analisi dinamica dell'incertezza. |
| **Ambiguità / Gap** | La tabella parla di "incertezza residua" generica; nella codebase la contingenza è meccanicamente legata ai rischi selezionati (catalogo fisso con pesi). Non c'è un meccanismo per aggiungere buffer manuale oltre alla selezione rischi. Le soglie (10/15/20/25%) sono hardcoded nella step function. |

---

### Passaggio 13 — Formalizzazione della stima

| Campo | Valore |
|---|---|
| **Funzione** | Rendere la stima spiegabile e difendibile |
| **Domanda** | "Come la presento in modo trasparente?" |
| **Output atteso** | Stima finale + motivazioni + assunzioni |
| **Stato mapping** | **DISTRIBUITA SU PIÙ PUNTI** |
| **Tipo di corrispondenza** | Presentazione UI multi-componente + export multi-formato + persistenza strutturata + reasoning AI |
| **Evidenza codebase** | **UI**: `EstimationResultStep` (risultato wizard), `CalculationSummary` (breakdown calcolo), `QuickEstimateResult` (stima rapida); **Reasoning**: `ai_reasoning TEXT` su `estimations` (persistito), `drawAiReasoningSection()` L486 in `pdfGenerator.ts`; **Export**: `generatePDF()` in `pdfGenerator.ts` L44, `generateExcel()` in `excelGenerator.ts`, `generateCSV()` in `csvGenerator.ts`; **ExportDialog** con opzioni (include activities/drivers/risks/AI reasoning); **Save**: `saveEstimation()` → `save_estimation_atomic` RPC; **Domain**: `orchestrateDomainSave()` in `save-orchestrator.ts` L128 + `finalizeSnapshot()` L289; **History**: `estimation_snapshots` table per audit trail |
| **File/Path principali** | `src/components/estimation/interview/EstimationResultStep.tsx`; `src/components/estimation/CalculationSummary.tsx`; `src/components/export/ExportDialog.tsx`; `src/lib/export/pdfGenerator.ts`; `src/lib/export/excelGenerator.ts`; `src/lib/export/csvGenerator.ts`; `src/types/export.ts`; `src/lib/api.ts`; `netlify/functions/lib/domain/estimation/save-orchestrator.ts`; `supabase_save_estimation_rpc.sql` |
| **Simboli rilevanti** | `EstimationResultStep`; `CalculationSummary`; `QuickEstimateResult`; `ExportDialog`; `generatePDF()`; `generateExcel()`; `generateCSV()`; `ExportableEstimation`; `ExportOptions`; `drawAiReasoningSection()`; `saveEstimation()`; `saveEstimationByIds()`; `orchestrateDomainSave()`; `finalizeSnapshot()`; `ai_reasoning`; `estimation_snapshots` |
| **Livello architetturale** | UI (display + export dialog); export service (PDF/Excel/CSV); API client (save); domain service (orchestrazione + snapshot); DB schema (estimations + estimation_snapshots) |
| **Note** | La formalizzazione è distribuita: (1) display interattivo (wizard result + calculation summary), (2) export multi-formato (PDF con sezioni dedicate per activities/drivers/risks/AI reasoning), (3) persistenza strutturata (RPC atomica con tutti i dati), (4) audit trail (estimation_snapshots). L'AI reasoning è persistito come TEXT e incluso nel PDF. Provenance delle attività (why selected) NON persistita in DB (solo in-memory/frontend). |
| **Ambiguità / Gap** | La tabella prevede "motivazioni + assunzioni" come output; nella codebase le motivazioni AI (`ai_reasoning`) sono persistite ma il reasoning per-attività (`reason`, `fromAnswer`, `provenance`) è disponibile solo nell'API response e nel frontend state, NON salvato in DB. Le assunzioni (da Understanding e Blueprint) non sono incluse direttamente nell'export della stima. |

---

## Findings generali

### 1. Funzioni non trovate

Nessuna riga della tabella è completamente assente dalla codebase. Tutte le 13 responsabilità funzionali trovano almeno una corrispondenza parziale o aggregata.

### 2. Funzioni aggregate

| Passaggio tabella | Aggregata dentro | Evidenza |
|---|---|---|
| **2. Delimitazione del perimetro** | Step 1 — Artefatto `RequirementUnderstanding` | Campi `functionalPerimeter[]` (in-scope) e `exclusions[]` (out-of-scope) sono attributi strutturati dell'artefatto Understanding, generati nella stessa chiamata AI |
| **3. Identificazione attori e flussi** | Step 1 — Artefatto `RequirementUnderstanding` | Campi `actors[]`, `stateTransition`, `preconditions[]`, `assumptions[]` sono attributi strutturati dell'artefatto Understanding |
| **6. Classificazione tipo intervento** | Step 5 — Artefatto `EstimationBlueprint` | Campo `interventionType` per-componente assegnato durante generazione Blueprint; anche presente come attributo su `project_activities` |

### 3. Funzioni distribuite

| Passaggio tabella | Distribuita su | Dettaglio |
|---|---|---|
| **7. Valutazione complessità intrinseca** | (a) `RequirementUnderstanding.complexityAssessment` — livello complessivo con rationale; (b) `BlueprintComponent.complexity` — per-componente; (c) `complexityToVariant()` + `sm_multiplier`/`lg_multiplier` — routing a ore effettive | 3 punti distinti nella pipeline; la complessità Understanding-level e Blueprint-component-level non sono esplicitamente riconciliate |
| **8. Valutazione dipendenze e incertezze** | (a) Understanding: `assumptions[]` + `preconditions[]`; (b) Blueprint: `uncertainties[]` + `assumptions[]` + `exclusions[]`; (c) Interview output: `SuggestedDriver[]` + `suggestedRisks[]`; (d) Regole deterministiche: `project-context-rules.ts` + `blueprint-rules.ts` | 4 momenti distinti; `assumptions` duplicato tra Understanding e Blueprint senza merge |
| **13. Formalizzazione della stima** | (a) UI: `EstimationResultStep` + `CalculationSummary`; (b) Export: PDF/Excel/CSV con `ExportDialog`; (c) Save: `save_estimation_atomic` RPC; (d) Audit: `estimation_snapshots` | 4 canali di formalizzazione indipendenti |

### 4. Mismatch tra tabella e codebase

| Mismatch | Dettaglio |
|---|---|
| **Granularità Step 2 e 3** | La tabella li tratta come step separati; la codebase li unifica in un unico artefatto (`RequirementUnderstanding`) generato in una singola chiamata AI |
| **Step 5 vs Step 9** | La tabella implica che la decomposizione (Step 5) produca blocchi direttamente stimabili; nella codebase il Blueprint produce componenti architetturali e la stima elementare (Step 9) avviene tramite lookup da catalogo attività pre-definito, non calcolo ad-hoc |
| **Step 6: "bugfix"** | La tabella menziona "bugfix" come tipo di intervento; il tipo NON esiste nella codebase (né nel Blueprint né nelle project_activities) |
| **Step 6: InterventionType mismatch** | Il Blueprint LLM produce 5 valori lowercase (`new_development\|modification\|configuration\|integration\|migration`); il DB `project_activities` accetta 4 valori UPPERCASE (`NEW\|MODIFY\|CONFIGURE\|MIGRATE`); nessuna funzione di conversione visibile; `integration` non ha mapping DB |
| **Step 7: punto unico vs distribuito** | La tabella prevede un singolo step per la complessità; la codebase la valuta in almeno 3 punti separati senza riconciliazione esplicita |
| **Step 8: dipendenze esplicite** | La tabella prevede tracking esplicito delle dipendenze; nella codebase ricadono in `preconditions` (Understanding) senza struttura dedicata (nessun grafo di dipendenze, nessuna priorità) |
| **Step 12: contingenza fissa** | La tabella prevede margine adattivo; nella codebase la contingenza è una step function hardcoded (4 soglie: 10/15/20/25%) legata al peso dei rischi selezionati da catalogo |
| **Step 13: reasoning per-attività** | La tabella prevede stima "spiegabile"; il reasoning per-attività (`reason`, `fromAnswer`, `provenance`) è generato dall'AI e mostrato in UI ma NON persistito in DB — solo il reasoning complessivo (`ai_reasoning TEXT`) è salvato |

### 5. Aree che richiederebbero verifica manuale ulteriore

| Area | Motivo |
|---|---|
| **Conversione InterventionType Blueprint→DB** | Non trovata funzione di mapping tra i 5 valori LLM lowercase e i 4 valori DB UPPERCASE. Potrebbe esistere in un file non esplorato o essere un gap reale. |
| **Merge assumptions Understanding/Blueprint** | Entrambi gli artefatti hanno `assumptions[]`; non è chiaro se vengono unificati downstream o restano paralleli. |
| **Riconciliazione complessità Understanding vs Blueprint** | `ComplexityAssessment.level` (globale) e `BlueprintComponent.complexity` (per-componente) coesistono; non è visibile una logica che li riconcilia in caso di conflitto. |
| **Persistenza reasoning per-attività** | `SelectedActivityWithReason.reason`, `fromAnswer`, `fromQuestionId`, `provenance` sono disponibili solo in-memory. Il campo `estimation_activities.notes` è generico e non strutturato per ospitarli. |
| **Step function contingenza** | Le 4 soglie (10/15/20/25%) sono hardcoded. Non è chiaro se siano calibrate empiricamente o arbitrarie. |
