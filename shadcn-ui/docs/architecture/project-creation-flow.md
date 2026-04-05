# Pipeline di Stima Requisiti Syntero — Documento Architetturale

> **Versione**: 4.0 — Aprile 2026  
> **Scope**: End-to-end flow dall'autenticazione al salvataggio della stima + execution architecture

---

> **Stato del sistema**
>
> Questo documento descrive il **current state operativo** della pipeline Syntero
> e il **piano di transizione architetturale** verificato al codice di aprile 2026.
>
> **Problema strutturale identificato**: manca un contratto di dominio unico tra
> AI → decisione → calcolo. Il sistema appare multi-artifact ma è **blueprint-centric**:
> solo il Blueprint entra nel ranking attività come dato strutturale; Understanding
> e ImpactMap sono decorazione testuale per il prompt AI, pur essendo **già strutturati**
> con tipi che mappano direttamente su `LAYER_TECH_PATTERNS` (§16.0.2).
> La candidate generation non ha provenance obbligatoria. (§16 per dettaglio, §17 per piano).
>
> **Priorità di transizione**: CandidateBuilder a 3 layer (Signal Extraction → Scoring
> → Selection) con provenance obbligatoria (Fase 1), collegamento consumatori (Fase 2),
> cleanup legacy (Fase 3). Rischi di esecuzione documentati (§16.0.1).
>
> La tabella DB è `projects` (rename completato, migration `20260330`).
> Lo state shape del wizard usa ancora `techPresetId`/`techCategory` (nomi legacy).
>
> Il wizard a 7 step è una **rappresentazione UX** di una pipeline architetturale più profonda.
> Il core del sistema è il **motore di decisione + calcolo deterministico + salvataggio auditabile**.

---

## Indice

1. [Terminologia Canonica](#1-terminologia-canonica)
2. [Panoramica Architetturale](#2-panoramica-architetturale)
3. [La Pipeline — Due Modalità, Un Motore](#3-la-pipeline--due-modalità-un-motore)
4. [Routing e Navigazione](#4-routing-e-navigazione)
5. [Fase 1 — Creazione Progetto](#5-fase-1--creazione-progetto)
6. [Fase 2 — Pagina Requisiti](#6-fase-2--pagina-requisiti)
7. [Fase 3 — Raccolta Input e Validazione](#7-fase-3--raccolta-input-e-validazione)
8. [Fase 4 — Generazione AI Artifacts](#8-fase-4--generazione-ai-artifacts)
9. [Fase 5 — Decisione ASK/SKIP e Proposta AI](#9-fase-5--decisione-askskip-e-proposta-ai)
10. [Fase 6 — Override Umano e Ranking Attività](#10-fase-6--override-umano-e-ranking-attività)
11. [Fase 7 — Calcolo Deterministico e Persistenza](#11-fase-7--calcolo-deterministico-e-persistenza)
12. [Gerarchia Source of Truth](#12-gerarchia-source-of-truth)
13. [UI Artifacts vs Domain Artifacts](#13-ui-artifacts-vs-domain-artifacts)
14. [Schema Dati & Persistenza](#14-schema-dati--persistenza)
15. [Diagramma Pipeline Completo](#15-diagramma-pipeline-completo)
16. [Audit Tecnico: Debito Strutturale](#16-audit-tecnico-debito-strutturale)
17. [Piano di Transizione Architetturale](#17-piano-di-transizione-architetturale)
18. [Criteri di Uscita dalla Transizione](#18-criteri-di-uscita-dalla-transizione)

---

## 1. Terminologia Canonica

| Termine | Significato | Record/Tabella |
|---------|------------|----------------|
| **Project** | Container di requisiti con contesto organizzativo | `projects` (tabella DB, rinominata da `lists` in migration 20260330) |
| **Requirement** | Singolo requisito stimabile all'interno di un progetto | `requirements` |
| **Technology** | Stack tecnologico che determina il catalogo attività | `technologies` (FK: `technology_id`) |
| **AI Artifact** | Output AI leggibile/contestuale per revisione umana | `requirement_understanding`, `impact_map`, `estimation_blueprint` |
| **Domain Artifact** | Rappresentazione normalizzata per decisione/audit | `requirement_analyses`, `candidate_sets`, `estimation_decisions`, `estimation_snapshots` |
| **Estimation** | Risultato deterministico persistito del calcolo stima | `estimations` + pivot tables |

### Termini Legacy (backward compatibility only)

| Termine legacy | Sostituto canonico | Stato |
|---------------|-------------------|-------|
| `techPresetId` | `technologyId` | Ancora presente in WizardData e alcune API; da non usare come primitivo architetturale |
| `techCategory` | Derivato da `technologies.code` | Usato internamente per routing catalogo attività; non esposto come campo business |
| `tech_preset_id` | `technology_id` | Colonna DB deprecata, mantenuta per compatibilità |
| `lists` (tabella) | `projects` | Rename completato (migration 20260330). `lists` non esiste più nello schema |

> **Regola**: nel codice nuovo usare esclusivamente `technologyId` / `technology_id`.
> I nomi legacy possono apparire solo come alias di fallback, mai come primitive decisionali.

---

## 2. Panoramica Architetturale

| Layer | Tecnologia | Ruolo |
|-------|-----------|-------|
| **Frontend** | React + Vite + shadcn/ui + TailwindCSS | SPA con routing client-side |
| **State** | React hooks + localStorage | Pipeline state persistence |
| **Backend** | Netlify Functions (serverless) | API endpoints AI + domain logic |
| **AI** | OpenAI GPT-4o-mini (artifacts) / GPT-4o (estimation) | Generazione artefatti + stima |
| **Database** | Supabase (PostgreSQL) + RLS | Persistenza + row-level security |
| **Auth** | Supabase Auth | Autenticazione utente |

**Stack di file principali:**

```
src/
├── App.tsx                                    # Routing
├── pages/requirements/Requirements.tsx        # Pagina lista requisiti
├── components/
│   ├── projects/CreateProjectDialog.tsx        # Dialog creazione progetto
│   ├── projects/EditProjectDialog.tsx          # Dialog modifica progetto
│   ├── projects/ProjectTechnologyDialog.tsx    # Cambio tecnologia default
│   └── requirements/
│       ├── CreateRequirementDialog.tsx         # Wrapper wizard
│       └── RequirementWizard.tsx               # Orchestratore pipeline (7 step UI)
│           └── wizard/
│               ├── WizardStep1.tsx             # Descrizione + validazione
│               ├── WizardStepUnderstanding.tsx # AI Understanding
│               ├── WizardStepImpactMap.tsx     # AI Impact Map
│               ├── WizardStepBlueprint.tsx     # AI Blueprint
│               ├── WizardStepInterview.tsx     # AI Interview + Stima
│               ├── WizardStep4.tsx             # Driver & Rischi
│               └── WizardStep5.tsx             # Risultati + Salvataggio
├── hooks/
│   ├── useWizardState.ts                      # State management pipeline
│   ├── useRequirementsList.ts                 # Fetch progetto + requisiti
│   ├── useRequirementInterview.ts             # Hook interview AI
│   └── useQuickEstimationV2.ts                # Pipeline automatica (Quick Mode)
├── lib/
│   ├── api.ts                                 # CRUD Supabase (delega a project-repository)
│   ├── projects/                              # Project repository layer
│   │   ├── project-repository.ts              # Single source of truth per queries `projects`
│   │   ├── project-mapper.ts                  # DB mapping + costanti (PROJECT_TABLE, PROJECT_FK)
│   │   └── project-types.ts                   # CreateProjectInput, UpdateProjectInput
│   ├── requirement-interview-api.ts           # Client API interview
│   ├── estimation-blueprint-api.ts            # Client API blueprint
│   └── consultant-api.ts                      # Client API consulente
└── types/
    ├── database.ts                            # Entity types (Project, Requirement, Estimation)
    ├── requirement-interview.ts               # Tipi interview
    └── estimation-blueprint.ts                # Tipi blueprint

netlify/functions/
├── ai-requirement-understanding.ts            # Endpoint Understanding
├── ai-impact-map.ts                           # Endpoint Impact Map
├── ai-estimation-blueprint.ts                 # Endpoint Blueprint
├── ai-requirement-interview.ts                # Endpoint Interview Planner
├── ai-estimate-from-interview.ts              # Endpoint Stima Finale (GPT-4o)
├── ai-consultant.ts                           # Endpoint Consulente AI
└── lib/
    ├── ai/
    │   ├── prompt-builder.ts                  # Formatter contesto → prompt
    │   └── actions/                           # Logica generazione artefatti
    ├── activities.ts                          # selectTopActivities (ranking keyword-based)
    ├── blueprint-activity-mapper.ts           # BlueprintMapper (ranking strutturale)
    └── domain/estimation/
        ├── save-orchestrator.ts               # Catena di salvataggio dominio
        ├── project-context-rules.ts           # Regole deterministiche contesto
        └── estimation-engine.ts               # Calcolo deterministico stima
```

---

## 3. La Pipeline — Due Modalità, Un Motore

Il sistema non è "un wizard a 7 step". È una **pipeline decisionale** con:

1. Raccolta input
2. Generazione AI artifacts
3. Decisione ASK/SKIP
4. Proposta AI (attività, driver, rischi)
5. Override umano
6. Computazione deterministica
7. Persistenza auditabile

Questa pipeline ha **due modalità di esecuzione** che condividono lo stesso motore:

| | **Wizard Mode** | **Quick Mode** |
|---|---|---|
| **Hook** | `useWizardState` + `RequirementWizard.tsx` | `useQuickEstimationV2.ts` |
| **Checkpoint utente** | Sì — review artefatti, risposta domande, selezione driver | No — tutto automatico |
| **Artefatti** | Confermati manualmente o skippati | Auto-confermati, graceful degradation |
| **Calcolo finale** | `computeEstimation()` — identico | `interviewFinalizeEstimation()` → stesso engine deterministico |
| **Salvataggio** | `orchestrateWizardDomainSave()` → `save_estimation_atomic()` | **Non persiste dentro il hook**. Restituisce il risultato al chiamante, che è responsabile del save |  
| **Output** | Redirect alla pagina requisiti | `QuickEstimationV2Result` con `{ estimation, artifacts, trace, shouldEscalate }` |

**Quick Mode pipeline stages:**

```
loading-data → validation → understanding → impact-map → blueprint →
interview-planner → estimation → finalizing → done
```

**Condivisione e confine**: Wizard e Quick Mode condividono la stessa pipeline AI
(stessi endpoint, stessi modelli, stessa cascata di artefatti) e lo stesso motore
deterministico (`computeEstimation`). La differenza critica è nel **save path**:
il wizard persiste direttamente tramite `orchestrateWizardDomainSave()` →
`save_estimation_atomic()`. Quick Mode invece restituisce un `QuickEstimationV2Result`
al componente chiamante (es. `RequirementDetail.confirmSaveEstimation()`) che è
responsabile di invocare la catena di persistenza. Il hook non salva autonomamente.

---

## 4. Routing e Navigazione

**File**: `src/App.tsx`

```
ROTTE PUBBLICHE:
  /                    → Landing page
  /login               → Autenticazione
  /register            → Registrazione

ROTTE PROTETTE (AuthGuard):
  /dashboard                                    → Lista progetti
  /dashboard/:projectId/requirements            → Lista requisiti progetto
  /dashboard/:projectId/requirements/:reqId     → Dettaglio requisito + stima
  /configuration                                → Configurazione attività/tecnologie
  /profile                                      → Profilo utente
  /organization                                 → Gestione organizzazione

REDIRECT LEGACY:
  /lists/*             → /dashboard/*           # Backward compatibility
```

**Flusso di navigazione utente:**

```
Login → Dashboard (lista progetti)
  ↓ click "Nuovo Progetto"
CreateProjectDialog
  ↓ submit
Dashboard (aggiornato)
  ↓ click su progetto
Requirements.tsx (lista requisiti)
  ↓ click "Nuovo Requisito"
CreateRequirementDialog → RequirementWizard (pipeline 7 step)
  ↓ completamento pipeline
Requirements.tsx (aggiornato con nuovo requisito + stima)
```

---

## 5. Fase 1 — Creazione Progetto

### 5.1 UI: CreateProjectDialog

**File**: `src/components/projects/CreateProjectDialog.tsx`

Il dialog cattura i seguenti campi:

| Campo | Tipo | Obbligatorio | Valori |
|-------|------|-------------|--------|
| `name` | string | ✅ | Testo libero |
| `description` | text | ❌ | Testo libero |
| `owner` | string | ❌ | Default: email utente |
| `status` | enum | ✅ | `DRAFT` \| `ACTIVE` (default: DRAFT) |
| `technology_id` | UUID | ❌ | Selezionato da catalogo `technologies` |
| `project_type` | enum | ❌ | `NEW_DEVELOPMENT` \| `MAINTENANCE` \| `MIGRATION` \| `INTEGRATION` \| `REFACTORING` |
| `domain` | string | ❌ | Testo libero (HR, Finance, eCommerce, ...) |
| `scope` | enum | ❌ | `SMALL` \| `MEDIUM` \| `LARGE` \| `ENTERPRISE` |
| `team_size` | integer | ❌ | 1–100 |
| `deadline_pressure` | enum | ❌ | `RELAXED` \| `NORMAL` \| `TIGHT` \| `CRITICAL` |
| `methodology` | enum | ❌ | `AGILE` \| `WATERFALL` \| `HYBRID` |

### 5.2 Validazione

Il form utilizza **Zod** per validazione client-side (`projectSchema`). I campi di contesto progetto sono tutti opzionali per backward compatibility.

### 5.3 Persistenza

```typescript
// src/lib/api.ts → createProject() → delegato a project-repository.ts
// project-mapper.ts mapCreateProjectToInsert():
const payload = {
  user_id: input.userId,
  organization_id: input.organizationId,
  name: input.name,
  description: input.description || '',
  owner: input.owner || '',
  technology_id: input.technologyId ?? null,
  status: input.status,
  project_type: input.projectType || null,
  domain: input.domain || null,
  scope: input.scope || null,
  team_size: input.teamSize || null,
  deadline_pressure: input.deadlinePressure || null,
  methodology: input.methodology || null,
};

// INSERT su tabella `projects` via project-repository.ts
supabase.from(PROJECT_TABLE).insert(payload).select().single();
// dove PROJECT_TABLE = 'projects' (src/lib/projects/project-mapper.ts)
```

### 5.4 Tabella DB: `projects`

> **Nota storica**: prima della migration `20260330_rename_lists_to_projects.sql`
> la tabella si chiamava `lists` e la FK su requirements era `list_id`.
> Oggi lo schema usa `projects` e `project_id`.

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  owner           VARCHAR(255),
  technology_id   UUID REFERENCES technologies(id),
  tech_preset_id  UUID REFERENCES technology_presets(id),  -- DEPRECATED, legacy only
  status          VARCHAR(20) DEFAULT 'DRAFT',
  project_type    VARCHAR(30),    -- CHECK constraint
  domain          VARCHAR(50),
  scope           VARCHAR(20),    -- CHECK constraint  
  team_size       INTEGER,        -- CHECK 1-100
  deadline_pressure VARCHAR(20),  -- CHECK constraint
  methodology     VARCHAR(20),    -- CHECK constraint
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS**: Policy basate su organizzazione (`organization_id = ANY(get_user_org_ids())`).
Admin e Editor possono creare/modificare; solo Admin possono eliminare.

### 5.5 Relazioni

```
projects (1) ←—— (N) requirements    [project_id FK, CASCADE DELETE]
projects (N) ——→ (1) technologies    [technology_id FK, nullable]
projects (N) ——→ (1) auth.users      [user_id FK, CASCADE DELETE]  
projects (N) ——→ (1) organizations   [organization_id FK]
```

---

## 6. Fase 2 — Pagina Requisiti

### 6.1 Caricamento Dati

**File**: `src/pages/requirements/Requirements.tsx`  
**Hook**: `src/hooks/useRequirementsList.ts`

```typescript
// Input
useRequirementsList(projectId, userId)

// Output
{
  project: Project | null,                    // Metadati progetto
  requirements: RequirementWithEstimation[],  // Tutti i requisiti
  filteredRequirements: [...],                // Dopo filtri
  paginatedRequirements: [...],               // Dopo paginazione
  loading, errorMessage,
  searchTerm, filterPriority, filterState, sortBy,
  page, pageSize, totalPages,
  totalEstimation,                            // Somma giorni stimati
  estimatedCount, notEstimatedCount,          // Contatori
  loadData(), updateRequirement(),            // Azioni
}
```

### 6.2 Azioni Disponibili

Dalla pagina requisiti l'utente può:

| Azione | Componente | Risultato |
|--------|-----------|-----------|
| Nuovo requisito | `CreateRequirementDialog` | Apre pipeline wizard |
| Modifica progetto | `EditProjectDialog` | Aggiorna metadati + contesto |
| Elimina progetto | `DeleteProjectDialog` | CASCADE delete su tutto |
| Svuota requisiti | `ClearProjectDialog` | Rimuove tutti i requisiti |
| Cambia tecnologia | `ProjectTechnologyDialog` | Aggiorna default technology |
| Click su requisito | Navigate | → RequirementDetail page |

---

## 7. Fase 3 — Raccolta Input e Validazione

> **Pipeline stage**: Input Collection  
> **UI step**: Step 1 (`WizardStep1.tsx`)  
> **Quick mode**: `validation` stage

### 7.1 Inizializzazione Pipeline

Al mount, la pipeline (wizard o quick) esegue 3 operazioni:

1. **Salva il contesto progetto** nello state (`ProjectContext`)
2. **Risolve la tecnologia** dal progetto (`fetchTechnology(project.technology_id)` → imposta `technologyId` internamente; nello state attuale il campo si chiama ancora `techPresetId` per ragioni legacy)
3. **Carica il Project Technical Blueprint** per contesto architetturale

### 7.2 State Management

**File**: `src/hooks/useWizardState.ts`

```typescript
interface WizardData {
  // Input utente
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner?: string;
  
  // Technology (canonical: technology_id risolta a runtime)
  techPresetId: string;        // ⚠️ LEGACY FIELD NAME — contiene technology_id
  techCategory: string;        // ⚠️ LEGACY — derivato da technologies.code, usato per routing catalogo

  // ⚠️ NOTA: la migrazione semantica verso `technologyId` è dichiarata,
  //    ma lo state shape del wizard non è ancora stato aggiornato.
  //    CreateRequirementDialog passa ancora `defaultTechPresetId`,
  //    RequirementWizard risolve la technology e la salva in questi campi legacy.

  // Contesto progetto ereditato
  projectContext?: ProjectContext;
  
  // AI Artifacts (con flag di conferma)
  requirementUnderstanding?: RequirementUnderstanding;
  requirementUnderstandingConfirmed?: boolean;
  impactMap?: ImpactMap;
  impactMapConfirmed?: boolean;
  estimationBlueprint?: EstimationBlueprint;
  estimationBlueprintConfirmed?: boolean;
  projectTechnicalBlueprint?: ProjectTechnicalBlueprint;

  // Validation Gate
  requirementValidation?: RequirementValidationResult;
  
  // Interview results
  interviewQuestions?: TechnicalQuestion[];
  interviewAnswers?: Record<string, InterviewAnswer>;
  interviewReasoning?: string;
  estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  plannerDecision?: 'ASK' | 'SKIP';
  preEstimate?: PreEstimate;
  
  // AI estimation output
  selectedActivityCodes: string[];
  aiSuggestedActivityCodes: string[];
  activityBreakdown?: SelectedActivityWithReason[];
  suggestedDrivers?: SuggestedDriver[];
  suggestedRisks?: string[];
  confidenceScore?: number;
  aiAnalysis?: string;
  title?: string;
  
  // User overrides
  selectedDriverValues: Record<string, string>;
  selectedRiskCodes: string[];
}
```

**Persistenza**: `localStorage` (chiave `estimation_wizard_data`). Reset al completamento o annullamento.

### 7.3 Validation Gate (Step 1)

```
Descrizione utente
  ↓
Heuristic check (client-side)
  ↓
AI validation (GPT-4o-mini, ~100 tokens)
  ↓
confidence ≥ 0.7 → BLOCCA (descrizione non valida)
confidence < 0.7 → PASSA
errore di rete   → PASSA (fail-open)
```

---

## 8. Fase 4 — Generazione AI Artifacts

> **Pipeline stage**: Artifact Generation  
> **UI steps**: Step 2 (Understanding), Step 3 (ImpactMap), Step 4 (Blueprint)  
> **Quick mode**: stages `understanding`, `impact-map`, `blueprint` (auto-confirm, graceful degradation)

### 8.1 Pattern Comune

Ogni artefatto (Understanding, ImpactMap, Blueprint) segue lo stesso pattern:

```
1. Mount dello step (o stage automatico in Quick Mode)
   ↓
2. Controlla se artefatto già in state (da localStorage)
   ↓ (se assente)
3. Chiama endpoint Netlify con inputs a cascata
   ↓
4. [Solo Wizard] Renderizza card editabile con contenuto
   ↓
5. [Solo Wizard] Utente può:
   ├── Confermare → imposta flag Confirmed, avanza
   ├── Rigenerare → azzera artefatto, ri-chiama endpoint
   └── Skippare   → avanza senza conferma (backward compat)
```

### 8.2 Cascata degli Input

Ogni artefatto riceve tutti quelli precedenti come contesto:

```
Understanding ← (description, technologyId, projectContext)
ImpactMap     ← (description, technologyId, projectContext, understanding?)
Blueprint     ← (description, technologyId, projectContext, understanding?, impactMap?)
Interview     ← (description, technologyId, projectContext, understanding?, impactMap?, blueprint?)
Estimation    ← (description, technologyId, projectContext, understanding?, impactMap?, blueprint?, answers?)
```

### 8.3 Endpoint AI

| Endpoint | Modello | Input | Output |
|----------|---------|-------|--------|
| `ai-requirement-understanding` | gpt-4o-mini | desc, tech, projectContext | Analisi strutturata requisito |
| `ai-impact-map` | gpt-4o-mini | desc, tech, understanding | Layer/componenti impattati |
| `ai-estimation-blueprint` | gpt-4o-mini | desc, tech, understanding, impactMap | Decomposizione tecnica |
| `ai-requirement-interview` | gpt-4o-mini | desc, tech, tutti gli artefatti | Domande tecniche + decisione ASK/SKIP |
| `ai-estimate-from-interview` | **gpt-4o** | desc, answers, tutti gli artefatti | Stima finale strutturata |

### 8.4 Project Context nei Prompt AI

Il contesto progetto viene iniettato in tutti i prompt AI in due modi:

**1. Prompt formatting** (`formatProjectContextBlock()` in `prompt-builder.ts`):
```
CONTESTO PROGETTO:
- Nome: [nome]
- Descrizione: [descrizione]
- Responsabile: [owner]
- Tipo progetto: Nuova implementazione
- Dominio: HR
- Scope: LARGE
- Team: 8 persone
- Pressione deadline: Critica
- Metodologia: AGILE
```

**2. Regole deterministiche** (`evaluateProjectContextRules()` in `project-context-rules.ts`):
```
ProjectContext
  ↓ applyScopeRules()              → LARGE/ENTERPRISE → preferisci varianti _LG
  ↓ applyDeadlinePressureRules()   → CRITICAL → suggerisci TIMELINE_PRESSURE driver
  ↓ applyTeamSizeRules()           → >=8 → suggerisci TEAM_COORDINATION driver
  ↓ applyProjectTypeRules()        → MIGRATION → boost keyword mapping
  ↓ applyMethodologyRules()        → AGILE → impatto su activity preferences  
  ↓ applyDomainRules()             → domain-specific keyword boosts
  ↓
ProjectContextRuleResult {
  activityBiases: { preferLargeVariants?, preferSmallVariants?, boostGroups?, boostKeywords? }
  suggestedDrivers: ProjectContextRuleSuggestion[]
  suggestedRisks: ProjectContextRuleSuggestion[]
  notes: string[]
}
```

---

## 9. Fase 5 — Decisione ASK/SKIP e Proposta AI

> **Pipeline stage**: Interview Decision + Estimation Proposal  
> **UI step**: Step 5 (`WizardStepInterview.tsx`)  
> **Quick mode**: stages `interview-planner` + `estimation`

### 9.1 Interview Planner (Fase A)

**Hook**: `src/hooks/useRequirementInterview.ts`  
**API**: `src/lib/requirement-interview-api.ts`  
**Backend**: `netlify/functions/ai-requirement-interview.ts`

```
Input:
  description, technologyId, projectContext?,
  understanding?, impactMap?, blueprint?

Output:
  {
    questions: TechnicalQuestion[],
    reasoning: string,
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH',
    preEstimate: PreEstimate,
    decision: 'ASK' | 'SKIP'
  }
```

**Decisione ASK/SKIP**: L'AI valuta se servono domande aggiuntive o se gli artefatti forniscono informazioni sufficienti per stimare direttamente.

### 9.2 Interview (Fase B, solo se ASK)

L'utente risponde alle domande tecniche generate dall'AI. Le risposte sono memorizzate in `Record<questionId, InterviewAnswer>`.

### 9.3 Stima AI Finale (Fase C)

**Backend**: `netlify/functions/ai-estimate-from-interview.ts` (GPT-4o)

L'AI **propone**, non decide. Il suo output è un suggerimento che l'utente può modificare.

```
Input:
  description, answers (o vuoto se SKIP),
  technologyId, projectContext?,
  understanding?, impactMap?, blueprint?

Output:
  {
    generatedTitle: string,
    activities: { code, name, reason }[],        // ← proposta, non decisione
    suggestedDrivers: { code, suggestedValue, reason }[],
    suggestedRisks: { code, reason }[],
    confidenceScore: number,
    reasoning: string
  }
```

---

## 10. Fase 6 — Override Umano e Ranking Attività

> **Pipeline stage**: Human Override + Final Selection  
> **UI step**: Step 6 (`WizardStep4.tsx`)  
> **Quick mode**: nessun override (auto-accept proposta AI)

### 10.1 Pre-popolazione

I suggerimenti AI dallo step precedente pre-popolano:
- **Attività selezionate** (toggle on/off)
- **Driver di complessità** con valori suggeriti
- **Rischi** con toggle attivo/disattivo

L'utente può aggiungere, rimuovere e modificare qualsiasi selezione.

### 10.2 Contratto del Ranking Attività

Il ranking attività NON è un singolo algoritmo. Esistono **due strategie** che operano in cascata:

#### Strategia 1: Blueprint Activity Mapper (primaria, se blueprint confermato)

**File**: `netlify/functions/lib/blueprint-activity-mapper.ts`

```
mapBlueprintToActivities(blueprint, catalog, techCategory) → BlueprintMappingResult

Mapping deterministico:
  Blueprint.components  → LAYER_TECH_PATTERNS[techCategory][layer] → activity codes
  Blueprint.integrations → integration-specific activities
  Blueprint.dataEntities → data/field activities
  Blueprint.testingScope → testing activities

Routing per complessità:
  component.complexity = LOW/MEDIUM → prefisso _SIMPLE (es. PP_FLOW_SIMPLE)
  component.complexity = HIGH       → prefisso _COMPLEX (es. PP_FLOW_COMPLEX)

Variant suffix:
  LOW  → _SM
  HIGH → _LG
  MEDIUM/undefined → base (nessun suffisso)

Output:
  BlueprintMappingResult {
    blueprintActivities: MappedActivity[]     // from blueprint (primarie)
    fallbackActivities: MappedActivity[]      // from keyword fallback (gap-fill)
    allActivities: MappedActivity[]           // merged, blueprint-first
    coverage: CoverageReport                  // metriche di copertura
    warnings: CoverageWarning[]               // UNSUPPORTED_LAYER, LOW_COVERAGE, etc.
  }

Ogni MappedActivity porta provenance:
  { activity, provenance: 'blueprint-component'|'blueprint-integration'|...,
    sourceLabel: string, confidence: 0-1 }
```

#### Strategia 2: Keyword Ranking (fallback, o gap-fill dopo blueprint)

**File**: `netlify/functions/lib/activities.ts` → `selectTopActivities()`

```
selectTopActivities(activities, description, answers, topN=20, blueprint?, activityBiases?)

Algoritmo (euristico, non deterministico puro):
  1. Tokenizza descrizione + risposte intervista → keywordSet
  2. Tokenizza blueprint (components, integrations, dataEntities) → blueprintKeywords
  3. Per ogni attività nel catalogo:
     score = Σ(keyword match) × 1 + Σ(blueprint keyword match) × 2
     if tech_category == 'MULTI': score += 0.5   // cross-cutting boost
  4. Applica activityBiases da project context rules (additivo, mai esclude)
  5. Ordina per score decrescente → prendi top N

Soglia: nessuna threshold minima, solo top-N (default: 20)
Persistenza ranking: il ranking come lista ordinata NON è persistito.
                     Ciò che viene persistito è il candidate_set (domain artifact).
```

**Decisione architetturale**: il Blueprint Mapper è la strategia primaria.
`selectTopActivities` interviene come gap-fill per i gruppi non coperti dal blueprint,
o come unica strategia se non c'è blueprint confermato.

---

## 11. Fase 7 — Calcolo Deterministico e Persistenza

> **Pipeline stage**: Computation + Persistence  
> **UI step**: Step 7 (`WizardStep5.tsx`)  
> **Quick mode**: `finalizing` stage (solo calcolo deterministico; la persistenza
> è responsabilità del chiamante, non del hook `useQuickEstimationV2`)

### 11.1 Catena di Salvataggio

**File**: `src/components/requirements/RequirementWizard.tsx` → `handleSave()`

```
handleSave(estimationResult)
│
├── 1. createRequirement()                              [CRITICO]
│   └── INSERT requirements: { project_id, title, description, priority, 
│       state, business_owner, technology_id }
│   └── Returns: requirement.id
│
├── 2. saveRequirementUnderstanding()                   [non-blocking]
│   └── Se confirmed: INSERT su requirement_understanding
│       (AI artifact per revisione/contesto, NON input al calcolo)
│
├── 3. saveImpactMap()                                  [non-blocking]
│   └── Se confirmed: INSERT su impact_map
│       (AI artifact per revisione/contesto, NON input al calcolo)
│
├── 4. saveEstimationBlueprint()                        [non-blocking]
│   └── Se confirmed: INSERT su estimation_blueprint
│       (AI artifact per revisione + input al ranking attività)
│   └── Returns: blueprintId
│
├── 5. orchestrateWizardDomainSave()                    [CRITICO]
│   ├── createRequirementAnalysis()   → analysisId
│   ├── createImpactMap() (domain)    → linked to analysis
│   ├── buildCandidates()             → candidate activities set
│   ├── createCandidateSet()          → candidateSetId
│   ├── createEstimationDecision()    → decisionId
│   ├── computeEstimation()           → calcolo deterministico
│   │   └── { totalDays, baseDays, driverMultiplier, riskScore, contingencyPercent }
│   └── createEstimationSnapshot()    → audit trail
│   Returns: { analysisId, decisionId, estimation }
│
├── 6. saveEstimation()                                 [CRITICO]
│   ├── Mappa activity codes → IDs dal master data
│   └── Chiama RPC save_estimation_atomic()
│   Returns: estimationId
│
├── 7. finalizeWizardSnapshot()                         [non-blocking]
│   └── Crea record audit finale (estimation_snapshots)
│
└── 8. resetData() + onSuccess()
    └── Pulisce localStorage, redirect a Requirements
```

### 11.2 Calcolo Deterministico

**File**: `netlify/functions/lib/domain/estimation/estimation-engine.ts`

```
computeEstimation(input: EstimationInput): EstimationResult

Formula:
  baseDays = Σ(activity.base_hours) / 8
  driverMultiplier = Π(driver.multiplier)
  adjustedDays = baseDays × driverMultiplier
  riskScore = f(selectedRisks)
  contingency = riskScore × adjustedDays
  totalDays = adjustedDays + contingency
```

Questo calcolo è **puramente deterministico**: stessi input → stessi output, senza componente AI.

### 11.3 RPC Atomico

```sql
-- save_estimation_atomic(params)
-- Transazione atomica che:
-- 1. Inserisce estimation record
-- 2. Inserisce estimation_activities (pivot)
-- 3. Inserisce estimation_drivers (pivot)
-- 4. Inserisce estimation_risks (pivot)
-- 5. Aggiorna estimations.analysis_id e decision_id (FK traceability)
```

---

## 12. Gerarchia Source of Truth

Quando due entità raccontano la stessa cosa, la fonte autorevole è determinata da questa gerarchia:

```
┌────────────────────────────────────────────────────────────────────────┐
│  GERARCHIA DELLE FONTI DI VERITÀ                                      │
├───────────────┬────────────────────────────────────────────────────────┤
│ Livello       │ Descrizione                                            │
├───────────────┼────────────────────────────────────────────────────────┤
│ 1. AI propone │ L'AI genera suggerimenti (attività, driver, rischi).   │
│               │ Questi NON sono fonte di verità. Sono input.           │
├───────────────┼────────────────────────────────────────────────────────┤
│ 2. Utente     │ L'utente corregge/conferma la proposta AI.             │
│   corregge    │ Le selezioni dell'utente sovrascrivono l'AI.           │
├───────────────┼────────────────────────────────────────────────────────┤
│ 3. Engine     │ computeEstimation() calcola il risultato.              │
│   calcola     │ Questo è il valore mostrato a UI. È deterministico.   │
├───────────────┼────────────────────────────────────────────────────────┤
│ 4. RPC        │ save_estimation_atomic() è la persistenza finale       │
│   persiste    │ autorevole. La tabella `estimations` + pivot tables    │
│               │ sono la SOURCE OF TRUTH operativa.                     │
├───────────────┼────────────────────────────────────────────────────────┤
│ 5. Snapshot   │ estimation_snapshots è audit trail puro.               │
│   traccia     │ NON è un record operativo. Non va letto per calcoli.  │
└───────────────┴────────────────────────────────────────────────────────┘
```

**Regole derivate:**

- Il valore mostrato a UI viene da `computeEstimation()`, che è deterministico
- La persistenza finale autorevole è `save_estimation_atomic()` → tabella `estimations`
- `estimation_snapshots` è audit trail, **non** record operativo
- Gli AI artifacts (`requirement_understanding`, `impact_map`, `estimation_blueprint`) influenzano la decisione AI e il ranking, ma **non guidano da soli il calcolo finale**
- I domain artifacts (`requirement_analyses`, `candidate_sets`, `estimation_decisions`) documentano il processo decisionale per ricostruibilità

---

## 13. UI Artifacts vs Domain Artifacts

Questa è una distinzione architetturale critica. Nel sistema esistono due categorie di artefatti
che possono sembrare ridondanti ma servono scopi diversi:

| | **UI/AI Artifacts** | **Domain Artifacts** |
|---|---|---|
| **Tabelle** | `requirement_understanding`, `impact_map`, `estimation_blueprint` | `requirement_analyses`, `candidate_sets`, `estimation_decisions`, `estimation_snapshots` |
| **FK principale** | `requirement_id` | `requirement_id` (analyses) o `analysis_id` (gli altri) |
| **Scopo** | Comprensione umana, revisione utente, contesto per prompt AI | Auditabilità, ricostruibilità della decisione, tracciabilità |
| **Formato** | Narrativo/strutturato, leggibile dall'utente | Normalizzato/operativo, consumato dal domain layer |
| **Chi li produce** | AI endpoints (gpt-4o-mini) | Domain orchestrator (`save-orchestrator.ts`) |
| **Chi li consuma** | UI (card di revisione), prompt AI successivi | Domain services, audit, ricostruzione stima |
| **Salvati quando** | Al salvataggio finale, se confermati | Sempre, come parte della catena di salvataggio |
| **Guidano il calcolo?** | **No** — influenzano indirettamente via ranking e prompt | **No** — documentano la decisione, non la influenzano |

**Esempio concreto: Impact Map**

- `impact_map` (AI artifact, tabella `impact_map`): contesto narrativo generato dall'AI,
  mostra all'utente quali layer/componenti sono impattati. Usato nel prompt della fase successiva.
- `impact_maps` (domain artifact, tabella `impact_maps`): rappresentazione normalizzata
  creata dal domain orchestrator durante il salvataggio. Collegata all'`analysis_id`.
  Usata per ricostruire la catena decisionale.

Sono **semanticamente correlate ma operativamente distinte**:
l'AI artifact è il "cosa l'AI ha capito", il domain artifact è il "cosa il sistema ha registrato".

---

## 14. Schema Dati & Persistenza

### 14.1 Mappa delle Tabelle

```
┌──────────────────────────────┐
│          projects             │  ← Project (container)
│  id, name, technology_id      │
│  tech_preset_id (DEPRECATED)  │
│  project_type, domain,        │
│  scope, team_size, ...        │
└──────────────┬───────────────┘
               │ 1:N (project_id)
┌──────────────▼───────────────┐
│        requirements           │  ← Singolo requisito
│  id, project_id, title,       │
│  description, technology_id   │  ← override opzionale su tech progetto
└──────────────┬───────────────┘
               │ 1:N (requirement_id)
               │
     ┌─────────┼─────────────────┬──────────────────────────┐
     │  AI ARTIFACTS             │  OPERATIONAL + DOMAIN     │
     │                           │                           │
     ▼         ▼         ▼       ▼            ▼              ▼
┌─────────┐┌───────┐┌─────────┐┌──────────┐┌──────────────┐┌────────────┐
│require- ││impact ││estimat- ││estimat-  ││requirement_  ││   ...      │
│ment_    ││_map   ││ion_     ││ions      ││analyses      ││            │
│underst. ││(AI)   ││blueprint││(OPERATI- ││(domain)      ││            │
│(AI)     ││       ││(AI)     ││ONAL SoT) ││              ││            │
└─────────┘└───────┘└─────────┘└────┬─────┘└──────┬───────┘└────────────┘
                                     │ 1:N         │ 1:N
                              ┌──────┼──────┐      │
                              ▼      ▼      ▼      ▼
                        ┌────────┐┌──────┐┌─────┐┌──────────────────┐
                        │est_    ││est_  ││est_ ││candidate_sets    │
                        │activit.││driver││risks││estimation_decis. │
                        │(pivot) ││(piv.)││(pi.)││estimation_snapsh.│
                        └────────┘└──────┘└─────┘└──────────────────┘
```

### 14.2 AI Artifacts (revisione/contesto)

| Tabella | FK | Scopo |
|---------|-----|-------|
| `requirement_understanding` | requirement_id | Analisi strutturata AI del requisito |
| `impact_map` | requirement_id | Layer e componenti impattati (visione AI) |
| `estimation_blueprint` | requirement_id | Decomposizione tecnica del lavoro |

### 14.3 Domain Artifacts (decisione/audit)

| Tabella | FK | Scopo |
|---------|-----|-------|
| `requirement_analyses` | requirement_id | Record analisi di dominio |
| `impact_maps` (domain) | analysis_id | Mappa impatto normalizzata |
| `candidate_sets` | analysis_id | Set candidati attività considerati |
| `estimation_decisions` | analysis_id | Decisione finale (cosa selezionato e perché) |
| `estimation_snapshots` | estimation_id | Audit trail completo (non operativo) |

### 14.4 Operational Source of Truth

| Tabella | FK | Scopo |
|---------|-----|-------|
| `estimations` | requirement_id | **Record autorevole** della stima (SoT operativa) |
| `estimation_activities` | estimation_id | Attività selezionate (pivot) |
| `estimation_drivers` | estimation_id | Driver applicati (pivot) |
| `estimation_risks` | estimation_id | Rischi selezionati (pivot) |

### 14.5 Catalogo (Read-Only)

| Tabella | Contenuto |
|---------|----------|
| `technologies` | Catalogo tecnologie (Power Platform, Backend, Frontend) |
| `activities` | ~118 attività con base_hours, varianti _SM/_LG |
| `technology_preset_activities` | Pivot tecnologia→attività (filtra catalogo per tech) |

### 14.6 Tensioni Note nello Schema

| Aspetto | Current State | Target State |
|---------|--------------|-------------|
| Tabella progetti | `projects` ✅ (rename completato) | — |
| FK requisiti | `project_id` ✅ (rename completato) | — |
| FK tecnologia | `technology_id` + `tech_preset_id` (deprecated) | Solo `technology_id` |
| Naming `impact_map` vs `impact_maps` | Due tabelle con nomi quasi identici | Semantica diversa (AI vs domain), naming da chiarire |
| Wizard state shape | `techPresetId`, `techCategory` (nomi legacy) | `technologyId` (migrazione state non ancora completata) |
| Wizard localStorage key | `estimation_wizard_data` | — (nessun rename pianificato) |
| `CreateRequirementDialog` | Passa `defaultTechPresetId` | Dovrebbe passare `defaultTechnologyId` |

---

## 15. Diagramma Pipeline Completo

```
                    ┌─────────────────────────────┐
                    │         UTENTE               │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  1. Login / Dashboard        │
                    │     (lista progetti)          │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  2. Crea/Seleziona Progetto  │
                    │     name, technology_id,      │
                    │     contesto progetto          │
                    │     → INSERT projects          │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  3. Pagina Requisiti          │
                    │     (scegli: Wizard o Quick)  │
                    └──────────┬──────────────────┘
                               │
                 ┌─────────────┴──────────────┐
                 │                            │
          ┌──────▼──────┐              ┌──────▼──────┐
          │ WIZARD MODE │              │ QUICK MODE  │
          │ (con review)│              │ (automatico)│
          └──────┬──────┘              └──────┬──────┘
                 │                            │
                 └─────────────┬──────────────┘
                               │
            ╔══════════════════╧══════════════════════╗
            ║         PIPELINE CONDIVISA              ║
            ╠═════════════════════════════════════════╣
            ║                                         ║
            ║  ┌─────────────────────────────────┐    ║
            ║  │ A. INPUT + VALIDAZIONE           │    ║
            ║  │    Descrizione → validation gate  │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ B. AI ARTIFACTS (gpt-4o-mini)    │    ║
            ║  │    Understanding → ImpactMap      │    ║
            ║  │    → Blueprint (cascading)         │    ║
            ║  │    [Wizard: review | Quick: auto]  │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ C. DECISIONE ASK/SKIP            │    ║
            ║  │    Interview Planner (gpt-4o-mini)│    ║
            ║  │    [Wizard: domande | Quick: skip] │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ D. PROPOSTA AI (GPT-4o)          │    ║
            ║  │    attività + driver + rischi      │    ║
            ║  │    (proposta, NON decisione)       │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ E. OVERRIDE UMANO                │    ║
            ║  │    [Wizard: manuale | Quick: auto] │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ F. CALCOLO DETERMINISTICO        │    ║
            ║  │    computeEstimation()            │    ║
            ║  │    base × driver × risk = total   │    ║
            ║  └──────────────┬──────────────────┘    ║
            ║                 │                        ║
            ║  ┌──────────────▼──────────────────┐    ║
            ║  │ G. PERSISTENZA AUDITABILE        │    ║
            ║  │    [Wizard: save dentro pipeline]  │    ║
            ║  │    orchestrateDomainSave()          │    ║
            ║  │    → save_estimation_atomic()       │    ║
            ║  │    → finalizeSnapshot()             │    ║
            ║  │    [Quick: restituisce risultato     │    ║
            ║  │     al chiamante, che persiste]      │    ║
            ║  └─────────────────────────────────┘    ║
            ║                                         ║
            ╚═════════════════════════════════════════╝
                               │
                    ┌──────────▼──────────────────┐
                    │  Risultato persistito         │
                    │  estimations = SoT operativa  │
                    │  snapshots = audit trail       │
                    └─────────────────────────────┘
```

---

## 16. Audit Tecnico: Debito Strutturale

Questa sezione documenta il debito architetturale **verificato nel codice** a aprile 2026.
Ogni punto è stato confermato tramite ispezione diretta dei file referenziati.

### 16.0 Il problema strutturale unico

I debiti elencati sotto **non sono 6 problemi separati**. Sono sintomi di un'unica
mancanza architetturale:

> **Manca un contratto di dominio unico tra AI → decisione → calcolo.**

Oggi il sistema funziona così:

```
AI → ragiona su testo (artifacts come prompt)
      ↓
Ranking → ragiona su keyword (solo blueprint ha mapping strutturale)
      ↓
Engine → calcola su activity codes (deterministico, ignora la provenienza)
      ↓
DB → salva una versione "flattened" senza traccia del perché
```

**La distorsione critica**: il sistema appare multi-artifact (Understanding, ImpactMap,
Blueprint), ma in realtà è **blueprint-centric**. Solo il Blueprint entra nel dominio
come dato strutturale; Understanding e ImpactMap sono decorazione testuale per il prompt.
Questo crea:

- **Qualità instabile**: la selezione attività dipende dalla capacità dell'LLM di estrarre
  informazioni dal testo, non da mapping deterministico
- **Decisioni non spiegabili**: non è possibile ricostruire *perché* un'attività è stata
  selezionata (nessuna provenance obbligatoria)
- **Mismatch AI vs engine**: l'AI "vede" tutti gli artefatti; il ranking engine "vede"
  solo il Blueprint + keyword

**Punto di leva**: la candidate generation con provenance obbligatoria è l'unica correzione
che rende tutti gli altri debiti risolvibili meccanicamente. Se non si chiude questo,
il resto è cosmetica.

### 16.0.1 I 3 rischi di esecuzione

Anche con la direzione corretta, l'implementazione può fallire in tre modi specifici:

#### Rischio 1 — CandidateBuilder "finto" (wrapper senza logica nuova)

Se `buildCandidateSet()` internamente chiama `selectTopActivities()` senza cambiare nulla,
**non è un nuovo sistema — è un rename**. Il contratto è soddisfatto solo se:
- la logica di scoring è nuova (non wrapping dell'esistente)
- le strutture dati sono nuove (`CandidateActivity` con provenance, non `Activity`)
- l'output è diverso (scored + sourced, non solo top-N)

> **Test**: se rimuovi `buildCandidateSet` e rimetti `selectTopActivities`, il risultato
> cambia? Se no, hai solo aggiunto un layer di indirezione.

#### Rischio 2 — Understanding/ImpactMap ancora "testo" nel dominio

I tipi sono già strutturati (vedi §16.0.2). Il rischio è che il CandidateBuilder li riceva
come parametri tipizzati ma li usi come stringhe serializzate. Se `functionalPerimeter[]`
viene `join(', ')` e passato a un keyword matcher generico, **il problema è ricreato**.

La differenza tra "decorativo" e "strutturale" è questa:
- ❌ Decorativo: `understanding.functionalPerimeter.join(', ')` → keyword matching
- ✅ Strutturale: `understanding.functionalPerimeter.forEach(p => matchActivityBySemanticGroup(p))`
- ❌ Decorativo: `impactMap.impacts.map(i => i.layer)` → log line
- ✅ Strutturale: `impactMap.impacts.forEach(i => LAYER_TECH_PATTERNS[techCode][i.layer] → activity codes)`

> **Domanda litmus**: "questa cosa entra davvero nel dominio... o è solo contesto per l'AI?"
> Se la risposta è "contesto", stai ricreando il problema.

#### Rischio 3 — Provenance "scritta ma inutile"

Se `sources: ['blueprint', 'keyword']` è scritto nell'oggetto ma poi:
- non viene persistito nel `candidate_sets`
- non viene mostrato in UI (debug, audit, RequirementDetail)
- non influenza il ranking (cioè il punteggio è calcolato senza pesare le sources)

allora è **logging, non dominio**. La provenance diventa dominio quando è:
1. **Persistita**: nel `candidate_sets` con score per source
2. **Usabile**: visibile in debug/UI/audit
3. **Determinante**: influenza il ranking (sources diverse hanno pesi diversi)

### 16.0.2 Insight: gli artefatti sono già strutturati — il problema è che nessuno li legge

I tipi AI artifact contengono già dati strutturati sufficienti per mapping deterministico.
Il problema non è la forma degli artefatti. È che **il dominio non li consuma**.

**RequirementUnderstanding** (`src/types/requirement-understanding.ts`):
```typescript
{
    businessObjective: string;           // → keyword extraction per ambito
    functionalPerimeter: string[];       // → mapping su gruppi attività (1-8 items)
    exclusions: string[];                // → esclusione attività
    actors: RequirementActor[];          // → boost attività di interfaccia/portale se >1 attore
    preconditions: string[];             // → boost attività di integrazione/configurazione
    complexityAssessment: {
        level: 'LOW' | 'MEDIUM' | 'HIGH';  // → routing varianti _SM/_LG
        rationale: string;
    };
}
```

**ImpactMap** (`src/types/impact-map.ts`):
```typescript
{
    impacts: ImpactItem[];               // array strutturato, non testo
    //   layer: ImpactLayer;             // ← STESSA tassonomia di BlueprintLayer
    //          'frontend' | 'logic' | 'data' | 'integration' |
    //          'automation' | 'configuration' | 'ai_pipeline'
    //   action: ImpactAction;           // read | modify | create | configure
    //   components: string[];           // ← componenti architetturali, non task
    //   confidence: number;             // ← peso del segnale
}
```

**Fatto critico**: `ImpactLayer` e `BlueprintLayer` condividono la stessa tassonomia.
Questo significa che `LAYER_TECH_PATTERNS[techCode][impact.layer]` è **già possibile oggi**
senza cambiare né l'AI né lo schema. L'unica cosa che manca è il codice che lo fa.

### 16.1 Debito #1 — Technology: modello canonico non ancora chiuso

**Stato**: La FK `technology_id` è il percorso canonico, ma l'API surface è ancora legacy-shaped.

| Punto | File | Evidenza |
|-------|------|----------|
| API interview hook | `src/hooks/useRequirementInterview.ts` L70-71, L84-85, L154-155, L253-254 | Passa `techPresetId` e `techCategory` come parametri espliciti in 6 call sites |
| API interview client | `src/lib/requirement-interview-api.ts` | Body POST usa `techPresetId` e `techCategory`, non `technologyId` |
| Server-side fetch | `netlify/functions/lib/activities.ts` L173 | `fetchActivitiesServerSide(techCategory, techPresetId, ...)` — la signature è legacy, anche se internamente risolve via FK |
| Wizard state shape | `src/hooks/useWizardState.ts` | Campi nello state: `techPresetId`, `techCategory`, non `technologyId` |
| Dialog wrapper | `src/components/requirements/CreateRequirementDialog.tsx` | Passa `defaultTechPresetId` al wizard, non `defaultTechnologyId` |
| Guard allowlist | `scripts/guard-legacy-patterns.mjs` L23-56 | 25 file nella allowlist, commento: "to be cleaned in STEP 4" |

**Meccanismo attuale**: `fetchActivitiesServerSide` riceve `techPresetId` →
chiama `resolveTechnology(supabase, techPresetId)` che fa un lookup `WHERE id = techPresetId`
sulla tabella `technologies` → usa il `technology.id` risultante per filtrare
`WHERE technology_id = ...` sulla tabella `activities`. La risoluzione è corretta,
ma il naming della signature e di tutto il call stack soprastante è ancora `techPresetId`.

**Rollback di emergenza**: env var `FORCE_LEGACY_ACTIVITY_FETCH=true` → fallback a
`tech_category` string matching (nessun deploy necessario).

### 16.2 Debito #2 — Understanding e ImpactMap non entrano nel ranking attività

**Stato**: Questi artefatti esistono nella pipeline, ma il loro contributo al
ranking attività è esclusivamente testuale (prompt), non strutturale.

| Componente | Understanding | ImpactMap | Blueprint |
|------------|:------------:|:---------:|:---------:|
| **`selectTopActivities()`** (keyword ranking) | ❌ non ricevuto | ❌ non ricevuto | ✅ keyword boost +2 |
| **`mapBlueprintToActivities()`** (blueprint mapper) | ❌ non ricevuto | ❌ non ricevuto | ✅ mapping primario |
| **`AgentInput`** (agent orchestrator) | ❌ non nel tipo | ❌ non nel tipo | ❌ non nel tipo |
| **`ai-requirement-interview.ts`** (prompt) | ✅ `formatUnderstandingBlock()` | ✅ `formatImpactMapBlock()` | ✅ `formatBlueprintBlock()` |
| **`ai-estimate-from-interview.ts`** (prompt) | ✅ `formatUnderstandingBlock()` | ✅ `formatImpactMapBlock()` | ✅ `formatBlueprintBlock()` |
| **`save-orchestrator.ts`** (domain save) | ✅ crea `requirement_analyses` | ✅ crea `impact_maps` (domain) | ✅ `blueprintId` FK |

**Conseguenza**: L'Understanding identifica funzionalità, vincoli e dipendenze.
L'ImpactMap identifica layer e componenti impattati. Ma nessuno dei due entra come
dato strutturato nella candidate generation. Il Blueprint è l'unico artefatto
che influenza strutturalmente il ranking (tramite `LAYER_TECH_PATTERNS` e keyword boost).
Gli altri due influenzano solo il prompt AI, il che significa che la qualità della
selezione attività dipende dalla capacità dell'LLM di estrarre le informazioni dal
testo del prompt, non da un mapping deterministico.

### 16.3 Debito #3 — Agent Orchestrator non riceve artefatti strutturati

**Stato**: `AgentInput` (in `agent-types.ts` L103-133) contiene:

```typescript
interface AgentInput {
    description: string;
    answers?: Record<string, any>;
    activities: AgentActivity[];
    validActivityCodes: string[];
    techCategory: string;                // ← legacy name
    projectContext?: ProjectContext;
    technologyName?: string;
    userId?: string;
    flags?: Partial<AgentFlags>;
    // ❌ MISSING: requirementUnderstanding, impactMap, estimationBlueprint
}
```

L'agent orchestrator riceve il catalogo attività e il contesto progetto,
ma **non riceve gli artefatti AI**. L'unica informazione sugli artefatti che
arriva all'agent è quella iniettata nei prompt dal chiamante a monte.

### 16.4 Debito #4 — `search_catalog` scopre attività non selezionabili

**Stato**: L'agent orchestrator (`agent-orchestrator.ts` L343, L440-463) mantiene
un set `validActivityCodes` che viene espanso quando `search_catalog` trova nuove
attività (fix B1). Ma questa espansione avviene **solo durante la sessione agentica**.
Se un'attività scoperta dall'agent non era nel candidate set iniziale costruito da
`selectTopActivities()`, essa viene aggiunta al set valido dell'agent ma non ha
provenance nel candidate set del domain layer.

### 16.5 Debito #5 — Nessun Completion Service unificato

**Stato**: Non esiste un contratto `CompletionService` o `EstimationCompletionInput`
nel codebase. I due flussi (wizard e quick) convergono sullo stesso engine
(`computeEstimation`) ma divergono sul save path:

- **Wizard**: `RequirementWizard.handleSave()` → `orchestrateWizardDomainSave()` → `saveEstimation()`
- **Quick**: `useQuickEstimationV2` → restituisce risultato → il chiamante invoca il save
- **Manual edit**: `RequirementDetail.confirmSaveEstimation()` → `orchestrateWizardDomainSave()` → `saveEstimationByIds()`

Tre path, nessun contratto condiviso.

### 16.6 Debito #6 — Provenance non obbligatoria

**Stato**: La provenance è disponibile solo dal Blueprint Mapper (`MappedActivity.provenance`).
Le attività selezionate da `selectTopActivities()` non portano provenance: il ranking
score non viene persistito, e nel `candidate_sets` del domain layer non è registrato
*perché* ciascuna attività è stata inclusa.

---

## 17. Piano di Transizione Architetturale

Strategia: **strangler progressivo**, non big bang.
Regola guida: **prima chiudi il contratto decisionale (candidate generation),
poi collega tutto, poi pulisci**.

L'ordine è cruciale: se si pulisce la nomenclatura prima di chiudere il contratto
decisionale, si ottiene codice più pulito che prende decisioni ancora incoerenti.

### Fase 1 — CandidateBuilder Canonico + Provenance (subito, non negoziabile)

> **Questo è il punto di leva.** Se si fa solo una cosa, è questa.

Obiettivo: creare l'**unico punto dove nasce la decisione** sulle attività candidate,
con provenance obbligatoria su ogni attività.

#### 1.1 CandidateBuilder: contratto

```typescript
interface CandidateBuilderInput {
    technologyId: string;
    technologyCode: string;             // derivato, per LAYER_TECH_PATTERNS
    description: string;
    answers?: Record<string, InterviewAnswer>;
    // Tutti gli artefatti strutturati (non solo blueprint)
    requirementUnderstanding?: RequirementUnderstanding;
    impactMap?: ImpactMap;
    estimationBlueprint?: EstimationBlueprint;
    projectContext?: ProjectContext;
}

interface CandidateActivity {
    code: string;
    name: string;
    base_hours: number;
    // Provenance (OBBLIGATORIO — non opzionale)
    score: number;
    sources: ('blueprint' | 'understanding' | 'impactMap' | 'keyword'
            | 'agent-search' | 'context-rule')[];
    contributions: {
        blueprint?: number;
        understanding?: number;
        impactMap?: number;
        keyword?: number;
        projectContext?: number;
    };
    provenance: string[];                 // human-readable trace
}

interface CandidateBuilderResult {
    candidates: CandidateActivity[];     // con provenance obbligatoria
    coverage: CoverageReport;
    warnings: CoverageWarning[];
    strategies: string[];                // quali strategie hanno contribuito
}

// Un solo entry point
function buildCandidateSet(input: CandidateBuilderInput): CandidateBuilderResult
```

#### 1.2 Architettura interna: tre layer separati

Il CandidateBuilder **non è un singolo algoritmo**. È composto da tre layer separabili,
ognuno testabile e migliorabile indipendentemente:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    buildCandidateSet()                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: SIGNAL EXTRACTION                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Estrae segnali strutturati dagli artefatti.                  │   │
│  │ Input: artifact tipizzati. Output: Signal[].                 │   │
│  │ Nessun contatto col catalogo attività.                       │   │
│  │                                                              │   │
│  │ ▸ BlueprintSignalExtractor                                   │   │
│  │   components[].layer + complexity → LayerSignal[]             │   │
│  │   integrations[].target → IntegrationSignal[]                │   │
│  │                                                              │   │
│  │ ▸ ImpactMapSignalExtractor (NUOVO)                           │   │
│  │   impacts[].layer → LayerSignal[]                            │   │
│  │   impacts[].components → ComponentSignal[]                   │   │
│  │   impacts[].action × confidence → peso del segnale           │   │
│  │                                                              │   │
│  │ ▸ UnderstandingSignalExtractor (NUOVO)                       │   │
│  │   functionalPerimeter[] → FunctionalSignal[]                 │   │
│  │   actors[] → ActorSignal[] (>1 → boost portale/interfaccia)  │   │
│  │   preconditions[] → IntegrationSignal[]                      │   │
│  │   complexityAssessment.level → VariantSignal (SM/LG routing) │   │
│  │                                                              │   │
│  │ ▸ KeywordSignalExtractor                                     │   │
│  │   description + answers → KeywordSignal[]                    │   │
│  │                                                              │   │
│  │ ▸ ProjectContextSignalExtractor                              │   │
│  │   evaluateProjectContextRules() → BiasSignal[]               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│     │                                                               │
│     ▼ Signal[]                                                      │
│                                                                     │
│  LAYER 2: SCORING                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Incrocia i segnali estratti col catalogo attività.           │   │
│  │ Input: Signal[] + Activity[]. Output: ScoredActivity[].      │   │
│  │                                                              │   │
│  │ Per ogni attività nel catalogo:                              │   │
│  │   score = 0                                                  │   │
│  │   sources = []                                               │   │
│  │   contributions = {}                                         │   │
│  │                                                              │   │
│  │   ▸ Blueprint signals:                                       │   │
│  │     LAYER_TECH_PATTERNS[techCode][layer] match → +3.0        │   │
│  │     complexity routing → variant selection (_SIMPLE/_COMPLEX) │   │
│  │     fonte: 'blueprint'                                       │   │
│  │                                                              │   │
│  │   ▸ ImpactMap signals:                                       │   │
│  │     LAYER_TECH_PATTERNS[techCode][impact.layer] match → +2.0 │   │
│  │     components keyword match → +1.5                          │   │
│  │     peso modulato da impact.confidence                       │   │
│  │     fonte: 'impactMap'                                       │   │
│  │                                                              │   │
│  │   ▸ Understanding signals:                                   │   │
│  │     functionalPerimeter keyword match → +1.5                 │   │
│  │     actors >1 → +1.0 su attività portale/interfaccia         │   │
│  │     preconditions keyword match → +1.0 su integrazione/test  │   │
│  │     fonte: 'understanding'                                   │   │
│  │                                                              │   │
│  │   ▸ Keyword signals (gap-fill):                              │   │
│  │     token match su description + answers → +1.0              │   │
│  │     fonte: 'keyword'                                         │   │
│  │                                                              │   │
│  │   ▸ Project Context bias:                                    │   │
│  │     additivo, mai esclusivo → +0.5                           │   │
│  │     varianti _LG/_SM da scope/team size                      │   │
│  │     fonte: 'context-rule'                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│     │                                                               │
│     ▼ ScoredActivity[]                                              │
│                                                                     │
│  LAYER 3: SELECTION                                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Da ScoredActivity[] → CandidateActivity[] finale.            │   │
│  │                                                              │   │
│  │ 1. Ordina per score decrescente                              │   │
│  │ 2. Dedup (stesso codice base con varianti → prendi più alto) │   │
│  │ 3. Merge per gruppo: assicura almeno 1 attività per gruppo   │   │
│  │    impattato dagli artefatti                                 │   │
│  │ 4. Top-N con floor (default: 20, minimo: attività con        │   │
│  │    score > 0 da artefatti strutturati)                        │   │
│  │ 5. Assegna provenance finale su ogni CandidateActivity       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│     │                                                               │
│     ▼ CandidateBuilderResult                                        │
│       { candidates, coverage, warnings, strategies }                │
└─────────────────────────────────────────────────────────────────────┘
```

**Perché tre layer separati (non uno solo)?**

- Si può **migliorare** ogni layer indipendentemente (es. aggiungere un nuovo extractor senza toccare scoring)
- Si può **testare** ogni layer in isolamento (signal extraction pura, scoring senza IO, selection deterministica)
- Si può **spiegare** il risultato: "questa attività ha score 7.5 perché blueprint +3.0, impactMap +2.0, understanding +1.5, keyword +1.0"

**Regola**: nessuna attività entra nel candidate set senza almeno un source.
Il `candidate_sets` del domain layer persiste score + sources + contributions per ogni attività.

#### 1.2.1 Fatto critico: l'ImpactMap è già mappabile deterministicamente

`ImpactLayer` e `BlueprintLayer` condividono la stessa tassonomia:
```
'frontend' | 'logic' | 'data' | 'integration' | 'automation' | 'configuration' | 'ai_pipeline'
```

Questo significa che `LAYER_TECH_PATTERNS[techCode][impact.layer]` è **già possibile oggi**
senza cambiare né l'output AI né lo schema. L'unica cosa che manca è il codice nel Layer 2
che fa: `for (const impact of impactMap.impacts) → lookup LAYER_TECH_PATTERNS`.

#### 1.3 Differenza critica rispetto a oggi

| Aspetto | Oggi | Dopo Fase 1 |
|---------|------|-------------|
| Understanding nel ranking | ❌ solo prompt text | ✅ keyword extraction strutturale |
| ImpactMap nel ranking | ❌ solo prompt text | ✅ layer mapping deterministico |
| Blueprint nel ranking | ✅ mapping + keyword boost | ✅ invariato |
| Provenance | ❌ opzionale (solo BlueprintMapper) | ✅ obbligatoria su tutti |
| Score persistito | ❌ non salvato | ✅ nel candidate_set domain |
| Entry point | 2 strategie separate + agent | 1 `buildCandidateSet()` |

#### 1.4 File da creare

| File | Responsabilità |
|------|---------------|
| `netlify/functions/lib/domain/estimation/candidate-builder.ts` | Implementazione `buildCandidateSet()` |
| `netlify/functions/lib/domain/types/candidate.ts` | Tipi `CandidateActivity`, `CandidateBuilderInput`, `CandidateBuilderResult` |

#### 1.5 File da modificare

| File | Modifica |
|------|---------|
| `netlify/functions/lib/activities.ts` | `selectTopActivities` diventa strategia interna del CandidateBuilder, non più chiamato direttamente |
| `netlify/functions/lib/blueprint-activity-mapper.ts` | Diventa strategia interna del CandidateBuilder |
| `netlify/functions/ai-requirement-interview.ts` | Chiama `buildCandidateSet()` invece di `selectTopActivities()` direttamente |
| `netlify/functions/ai-estimate-from-interview.ts` | Idem |
| `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | Chiama `buildCandidateSet()` |
| `netlify/functions/lib/domain/estimation/save-orchestrator.ts` | Persiste `CandidateActivity[]` nel `candidate_sets` con provenance |

### Fase 2 — Collegamento (tutti i consumatori usano CandidateBuilder)

Obiettivo: tutti i path della pipeline convergono sul CandidateBuilder.

#### 2.1 Wizard → CandidateBuilder

`WizardStepInterview.tsx` passa tutti gli artefatti confermati al backend;
il backend usa `buildCandidateSet()` per la proposta AI.

#### 2.2 Quick Mode → CandidateBuilder

`useQuickEstimationV2.ts` passa gli artefatti auto-confermati; stesso `buildCandidateSet()`.

#### 2.3 Agent → CandidateBuilder

Estendere `AgentInput` con artefatti strutturati:

```typescript
interface AgentInput {
    // ... campi esistenti ...
    technologyId: string;                                 // sostituisce techCategory
    technologyCode: string;                               // derivato
    requirementUnderstanding?: RequirementUnderstanding;   // NUOVO
    impactMap?: ImpactMap;                                 // NUOVO
    estimationBlueprint?: EstimationBlueprint;             // NUOVO
}
```

L'agent usa `buildCandidateSet()` come base iniziale e `search_catalog` per esplorare
oltre il candidate set — ma le attività scoperte devono comunque ricevere provenance
(`source: 'agent-search'`).

#### 2.4 CompletionService unificato

Una volta che la candidate generation è chiusa, si può unificare il save path:

```typescript
interface EstimationCompletionInput {
    requirementId: string;
    userId: string;
    description: string;
    candidates: CandidateActivity[];          // dal CandidateBuilder, con provenance
    selectedActivities: SelectedActivity[];   // dopo override umano
    selectedDrivers: SelectedDriver[];
    selectedRisks: SelectedRisk[];
    analysisId?: string;
    blueprintId?: string;
    aiReasoning?: string;
}

interface EstimationCompletionResult {
    estimation: EstimationResult;
    analysisId: string;
    decisionId: string;
    estimationId?: string;                    // presente solo se persist=true
}

async function completeEstimation(
    input: EstimationCompletionInput,
    options: { persist: boolean }
): Promise<EstimationCompletionResult>
```

**Uso**:
- Wizard: `completeEstimation(input, { persist: true })`
- Quick Mode: `completeEstimation(input, { persist: false })` → il chiamante persiste dopo
- Manual Edit: `completeEstimation(input, { persist: true })`

> **Nota**: il CompletionService viene *dopo* il CandidateBuilder perché unificare il save
> prima di chiudere la candidate generation significa salvare decisioni incoerenti
> in modo più ordinato. Prima si corregge cosa si salva, poi come.

#### 2.5 TechnologyContext canonico

Adapter stabile che isola il debito legacy in un solo punto:

```typescript
interface TechnologyContext {
    technologyId: string;            // l'unico primitivo business-first
    technologyCode: string;          // derivato, usato per LAYER_TECH_PATTERNS
}

// Adapter legacy (un solo file, transitional)
function resolveTechnologyContext(
    techPresetId: string              // input legacy (accettato solo dall'adapter)
): Promise<TechnologyContext>         // output canonico
```

**Dopo**: wizard, quick mode, interview API, agent — tutti ricevono `TechnologyContext`,
non `techPresetId`/`techCategory` separati.

### Fase 3 — Cutover (pulizia)

Obiettivo: rimuovere i path legacy. Si arriva qui **solo** quando Fase 1 e 2 sono
stabili e testate.

| Azione | Precondizione | File principali |
|--------|--------------|-----------------|
| Rinominare `techPresetId` → `technologyId` nello state | TechnologyContext adapter stabile | `useWizardState.ts`, `WizardStepInterview.tsx` |
| Rinominare `defaultTechPresetId` → `defaultTechnologyId` | `CreateRequirementDialog` migrato | `CreateRequirementDialog.tsx` |
| Ridurre guard allowlist a ≤5 file | File migrati a `TechnologyContext` | `guard-legacy-patterns.mjs` |
| Rimuovere `FORCE_LEGACY_ACTIVITY_FETCH` | Almeno 30 giorni senza attivazione | `activities.ts` |
| Declassare `api.ts` a puro compatibility layer | Repository pattern consolidato | `src/lib/api.ts` |
| Eliminare `selectTopActivities` come API pubblica | Tutti i consumatori usano `buildCandidateSet()` | `activities.ts` |

### Sequenza di Implementazione

```
Fase 1 — CandidateBuilder (PRIORITÀ MASSIMA)
│
├── 1.1 Tipi: CandidateActivity, CandidateBuilderInput/Result
├── 1.2 Implementazione buildCandidateSet()
│   ├── Blueprint Mapper (esistente, wrappato)
│   ├── ImpactMap Mapper (NUOVO)
│   ├── Understanding Extractor (NUOVO)
│   ├── Keyword Ranking (esistente, wrappato)
│   └── Project Context Biases (esistente)
├── 1.3 Provenance obbligatoria nel domain save
└── 1.4 Test: baseline coverage su 5 requisiti reali
│
Fase 2 — Collegamento
│
├── 2.1 ai-requirement-interview → buildCandidateSet()
├── 2.2 ai-estimate-from-interview → buildCandidateSet()
├── 2.3 agent-orchestrator → buildCandidateSet() + AgentInput esteso
├── 2.4 CompletionService unificato (feature flag)
├── 2.5 TechnologyContext adapter
└── 2.6 Guard: allowlist ridotta (25 → ≤15)
│
Fase 3 — Cutover
│
├── Rename state fields (techPresetId → technologyId)
├── Rename dialog props (defaultTechPresetId → defaultTechnologyId)
├── Guard: allowlist finale (≤5)  
├── Rimozione FORCE_LEGACY_ACTIVITY_FETCH
└── api.ts → pure compatibility layer
```

---

## 18. Criteri di Uscita dalla Transizione

La transizione è **chiusa** quando tutti questi criteri sono verificati.
Ordinati per fase: i criteri di Fase 1 sono precondizione per Fase 2, ecc.

### Il test definitivo (litmus test)

> **Puoi spiegare _perché_ una attività è stata scelta?**

Se puoi dire:
> "BE_API_COMPLEX è entrata perché: blueprint +3.0 (component 'approval service', layer logic,
> complexity HIGH), impactMap +2.0 (layer logic, action create, confidence 0.85),
> understanding +1.5 (functionalPerimeter 'gestione approvazioni'), keyword +1.0
> (match 'API' in description). Score totale: 7.5"

allora il CandidateBuilder funziona.

Se puoi solo dire:
> "BE_API_COMPLEX è nel top-20 perché ha matchato qualche keyword"

allora il sistema è ancora opaco. La transizione non è chiusa.

### Fase 1 — Gate di uscita (CandidateBuilder)

| # | Criterio | Verifica |
|---|----------|----------|
| 1 | `buildCandidateSet()` esiste ed è l'unico entry point per candidate generation | Nessun chiamante diretto di `selectTopActivities()` o `mapBlueprintToActivities()` fuori dal CandidateBuilder |
| 2 | Understanding entra nel ranking come dato strutturale | `functionalPerimeter[]`, `actors[]`, `preconditions[]`, `complexityAssessment.level` sono letti come campi tipizzati, non serializzati a stringa |
| 3 | ImpactMap entra nel ranking come dato strutturale | `impacts[].layer` è usato per lookup `LAYER_TECH_PATTERNS[techCode][layer]` — stessa logica del Blueprint Mapper |
| 4 | Ogni `CandidateActivity` ha provenance obbligatoria | `sources[]`, `score`, `contributions{}` sono campi required nel tipo, non optional |
| 5 | Provenance persistita nel domain layer | `candidate_sets` contiene `sources[]` + `score` + `contributions` per ogni attività candidata |
| 6 | Architettura a 3 layer | Signal Extraction, Scoring, Selection sono separabili e testabili indipendentemente |

### Fase 2 — Gate di uscita (Collegamento)

| # | Criterio | Verifica |
|---|----------|----------|
| 6 | Wizard, Quick e Agent usano `buildCandidateSet()` | 0 path che bypassano il CandidateBuilder |
| 7 | Agent riceve artefatti strutturati | `AgentInput` include `requirementUnderstanding`, `impactMap`, `estimationBlueprint` |
| 8 | CompletionService unificato | Wizard, Quick e Manual Edit chiamano `completeEstimation()` |
| 9 | `TechnologyContext` adapter in uso | Tutti i consumatori ricevono `TechnologyContext`, non `techPresetId`/`techCategory` separati |

### Fase 3 — Gate di uscita (Cutover)

| # | Criterio | Verifica |
|---|----------|----------|
| 10 | Nessuna decisione architetturale su `techPresetId` o `techCategory` | Guard script: 0 violazioni, allowlist ≤5 file (solo admin/config) |
| 11 | State shape aggiornato | `useWizardState` usa `technologyId`, non `techPresetId` |
| 12 | Save path testato end-to-end | Test di integrazione: wizard save, quick → manual save, edit save — tutti passano |

### Vincolo di non-regressione

> La Fase 2 **non può iniziare** finché tutti i gate di Fase 1 non sono verdi.
> La Fase 3 **non può iniziare** finché tutti i gate di Fase 2 non sono verdi.
> Se durante Fase 2 un gate di Fase 1 regredisce, **si torna a Fase 1**.

---

---

## Note Tecniche

### Cosa NON rientra nella transizione

- Rinominare la tabella `impact_map` AI vs `impact_maps` domain (naming confusionario ma funzionalmente stabile)
- Rimuovere la colonna `tech_preset_id` dalla tabella `projects` (legacy compatibility, zero impatto operativo)
- Riscrivere la chiave localStorage del wizard (debito cosmetico)
- Unificare i formati prompt `formatUnderstandingBlock` / `formatImpactMapBlock` (funzionali, non strutturali)

### Backward Compatibility
- Tutti i campi contesto progetto sono **nullable** nel DB
- La pipeline funziona anche senza contesto progetto (rules engine neutro)
- La tecnologia è opzionale (nullable FK)
- Gli AI artifacts sono skippabili (non bloccanti)
- Legacy fields nello wizard state (`techPresetId`, `techCategory`) non ancora rinominati
- Colonna DB `tech_preset_id` deprecata, mantenuta per compatibilità

### Modelli AI Utilizzati
- **GPT-4o-mini**: validazione, artefatti (understanding, impact-map, blueprint, interview planner) — ~100-2000 tokens
- **GPT-4o**: stima finale (`ai-estimate-from-interview`) — modello più potente per decisioni critiche

### Persistenza State
- `localStorage` per pipeline state (sopravvive refresh browser)
- Chiave: `estimation_wizard_data`
- Reset automatico al completamento o annullamento
