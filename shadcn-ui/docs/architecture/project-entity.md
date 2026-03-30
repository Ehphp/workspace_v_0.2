# Entità Progetto (Project / `projects`)

> Ultimo aggiornamento: 2026-03-30  
> Stato: Documentazione completa post Project Context Enrichment + List→Project domain rename

---

## 1. Identità dell'entità

L'entità **Progetto** è persistita nella tabella `projects`. La tabella agisce come container principale per i requisiti e come radice dell'intera catena di stima.

**Tabella DB**: `projects`  
**Interfaccia TypeScript**: `Project` ([src/types/database.ts](../src/types/database.ts))  
**Repository**: [src/lib/projects/project-repository.ts](../../src/lib/projects/project-repository.ts)  
**UI gestione**: [CreateProjectDialog.tsx](../../src/components/projects/CreateProjectDialog.tsx), [EditProjectDialog.tsx](../../src/components/projects/EditProjectDialog.tsx)

---

## 2. Schema completo

### 2.1 Colonne strutturali

| Colonna | Tipo | Vincoli | Scopo |
|---------|------|---------|-------|
| `id` | UUID | PK | Identificativo univoco |
| `user_id` | UUID | FK → auth.users, CASCADE | Proprietario/creatore |
| `organization_id` | UUID | FK → organizations, nullable | Scope organizzativo (multitenancy) |
| `name` | VARCHAR(255) | NOT NULL | Nome progetto |
| `description` | TEXT | nullable | Descrizione breve |
| `owner` | VARCHAR(255) | nullable | Nome del responsabile |
| `technology_id` | UUID | FK → technologies | Tecnologia default per tutti i requisiti |
| `status` | VARCHAR(20) | CHECK, DEFAULT 'DRAFT' | DRAFT \| ACTIVE \| ARCHIVED |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Data creazione |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Ultima modifica |

### 2.2 Colonne Project Context (migration `20260329`)

Tutte nullable per backward compatibility.

| Colonna | Tipo | Valori ammessi | Scopo |
|---------|------|----------------|-------|
| `project_type` | VARCHAR(30) | NEW_DEVELOPMENT, MAINTENANCE, MIGRATION, INTEGRATION, REFACTORING | Tipo di progetto |
| `domain` | VARCHAR(50) | HR, FINANCE, ECOMMERCE, HEALTHCARE, LOGISTICS, MANUFACTURING, EDUCATION, GOVERNMENT, TELECOM (o libero) | Dominio di business |
| `scope` | VARCHAR(20) | SMALL, MEDIUM, LARGE, ENTERPRISE | Dimensione/portata |
| `team_size` | INTEGER | 1–100 (CHECK constraint) | Dimensione team |
| `deadline_pressure` | VARCHAR(20) | RELAXED, NORMAL, TIGHT, CRITICAL | Pressione temporale |
| `methodology` | VARCHAR(20) | AGILE, WATERFALL, HYBRID | Metodologia di sviluppo |

### 2.3 Colonne deprecate

| Colonna | Stato | Sostituzione |
|---------|-------|--------------|
| `tech_preset_id` | @deprecated | `technology_id` (migration 20260228) |

---

## 3. Interfaccia TypeScript

```typescript
// src/types/database.ts
export interface Project {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description: string;
  owner: string;
  technology_id: string | null;       // Default per i requisiti
  tech_preset_id?: string | null;     // @deprecated
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  // Project Context (enrichment):
  project_type?: ProjectType | null;
  domain?: string | null;
  scope?: ProjectScope | null;
  team_size?: number | null;
  deadline_pressure?: DeadlinePressure | null;
  methodology?: Methodology | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Project instead */
export type List = Project;
```

Enumerazioni correlate:
```typescript
export type ProjectType = 'NEW_DEVELOPMENT' | 'MAINTENANCE' | 'MIGRATION' | 'INTEGRATION' | 'REFACTORING';
export type ProjectScope = 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
export type DeadlinePressure = 'RELAXED' | 'NORMAL' | 'TIGHT' | 'CRITICAL';
export type Methodology = 'AGILE' | 'WATERFALL' | 'HYBRID';
```

---

## 4. Relazioni con le altre entità

### 4.1 Diagramma relazionale

```
                    ┌──────────────────────┐
                    │   organizations      │
                    │  (id, name, type)     │
                    └──────────┬───────────┘
                               │ org_id
                    ┌──────────▼────────────────┐
                    │   organization_members     │
                    │  (org_id, user_id, role)   │
                    └──────────┬────────────────┘
                               │ user_id
    ┌──────────────────────────▼───────────────────────────────────────┐
    │                        projects (PROGETTO)                      │
    │  id, user_id, organization_id                                   │
    │  name, description, owner, status                               │
    │  technology_id (default) ──────────────┐                        │
    │  project_type, domain, scope,          │                        │
    │  team_size, deadline_pressure,         │                        │
    │  methodology                           │                        │
    └──┬─────────────────────────────────────┼────────────────────────┘
       │ project_id (FK CASCADE)             │ technology_id (FK)
       │                                     │
  ┌────▼──────────────────────┐    ┌─────────▼──────────────────────┐
  │     requirements          │    │       technologies             │
  │  id, project_id, req_id   │    │  id, code, name               │
  │  title, description       │    │  tech_category, color          │
  │  technology_id (override) │    │  is_custom, created_by         │
  │  priority, state, labels  │    └─────────┬──────────────────────┘
  └────┬──────────────────────┘              │ technology_id
       │ requirement_id (FK CASCADE)         │
       │                              ┌──────▼──────────────────────┐
  ┌────▼──────────────────────┐       │    activities (catalogo)    │
  │     estimations           │       │  id, code, base_hours       │
  │  id, requirement_id       │       │  technology_id, group       │
  │  total_days, base_hours   │       │  is_custom, created_by      │
  │  driver_multiplier        │       └─────────────────────────────┘
  │  risk_score               │
  │  analysis_id, decision_id │
  └────┬──────┬──────┬────────┘
       │      │      │
  ┌────▼──┐ ┌─▼────┐ ┌▼──────┐
  │est_   │ │est_  │ │est_   │
  │activ. │ │driv. │ │risks  │
  │(junc.)│ │(junc)│ │(junc.)│
  └───────┘ └──────┘ └───────┘
```

### 4.2 Dettaglio relazioni

#### Progetto → Requisiti (1:N)

| Aspetto | Dettaglio |
|---------|----------|
| FK | `requirements.project_id` → `projects.id` |
| Cascata | ON DELETE CASCADE — eliminare un progetto elimina tutti i requisiti |
| Vincolo | UNIQUE(project_id, req_id) — ID requisito univoco per progetto |
| Cardinalità | 1 progetto → N requisiti |

#### Progetto → Tecnologia (N:1)

| Aspetto | Dettaglio |
|---------|----------|
| FK | `projects.technology_id` → `technologies.id` |
| Nullable | Sì — un progetto può non avere tecnologia default |
| Scopo | Imposta la tecnologia default ereditata da tutti i requisiti |
| Override | Ogni requisito può sovrascrivere via `requirements.technology_id` |

**Logica di risoluzione** (in [api.ts](../../src/lib/api.ts)):
```
technologyId = requirement.technology_id || project.technology_id
```

#### Progetto → Utente (N:1)

| Aspetto | Dettaglio |
|---------|----------|
| FK | `projects.user_id` → `auth.users(id)` |
| Cascata | ON DELETE CASCADE |
| RLS | L'utente vede solo i propri progetti (o quelli della propria organizzazione) |

#### Progetto → Organizzazione (N:1)

| Aspetto | Dettaglio |
|---------|----------|
| FK | `projects.organization_id` → `organizations(id)` |
| Nullable | Sì — progetti legacy possono non avere organizzazione |
| Scopo | Multitenancy — condivisione progetti nel team |
| Ruoli | ADMIN, EDITOR, VIEWER (via `organization_members.role`) |

#### Requisiti → Stime (1:N)

| Aspetto | Dettaglio |
|---------|----------|
| FK | `estimations.requirement_id` → `requirements.id` CASCADE |
| Cardinalità | 1 requisito → N stime (scenari multipli) |
| Catena completa | Progetto → Requisito → Stima |

#### Requisiti → Artefatti AI (1:N ciascuno)

| Artefatto | Tabella | FK |
|-----------|---------|---------|
| Understanding | `requirement_understanding` | `requirement_id` → requirements.id (nullable) |
| Impact Map | `impact_map` | `requirement_id` → requirements.id (nullable) |
| Blueprint | `estimation_blueprint` | `requirement_id` → requirements.id (nullable) |

Tutti nullable perché generati prima del salvataggio del requisito; poi associati post-save.

---

## 5. Ciclo di vita

```
CREAZIONE                    OPERATIVO                    ARCHIVIO
───────────────────────────────────────────────────────────────────
  CreateProjectDialog        Requisiti + Stime            Completato
  ↓                          ↓                            ↓
  status = DRAFT     →     status = ACTIVE       →     status = ARCHIVED
  ↓                          ↓
  Campi obbligatori:         Campi opzionali:
  - name                     - project_type
  - (technology_id)           - domain, scope
                              - team_size
                              - deadline_pressure
                              - methodology
```

---

## 6. Flusso dati: dal Progetto alla Stima

### 6.1 Creazione progetto

```
UI: CreateProjectDialog
  ↓ form submit
API: createProject(input: CreateProjectInput)
  ↓ Supabase INSERT
DB: lists row creata
```

### 6.2 Propagazione Project Context nel wizard

```
1. CreateRequirementDialog.tsx
   ├── Legge list (progetto corrente)
   └── Costruisce projectContext:
       {
         name, description, owner,
         defaultTechPresetId: list.technology_id,
         projectType, domain, scope,
         teamSize, deadlinePressure, methodology
       }

2. RequirementWizard.tsx
   ├── Riceve projectContext come prop
   ├── Lo salva in useWizardState()
   └── Auto-eredita tecnologia da defaultTechPresetId

3. WizardStepInterview → API call
   ├── requirement-interview-api.ts
   │   └── POST /ai-requirement-interview
   │       body.projectContext = { name, description, ... }
   └── requirement-estimation-api.ts
       └── POST /ai-estimate-from-interview
           body.projectContext = { name, description, ... }
```

### 6.3 Utilizzo nel backend AI

```
Netlify Function (ai-requirement-interview.ts / ai-estimate-from-interview.ts)
  │
  ├── 1. Costruisce EstimationContext da body.projectContext
  │      { technologyId, techCategory, project: { projectType, scope, ... } }
  │
  ├── 2. evaluateProjectContextRules(estimationCtx)
  │      → activityBiases (variante SM/LG, keyword boost, group boost)
  │      → suggestedDrivers (es. TIMELINE_PRESSURE se deadline=CRITICAL)
  │      → suggestedRisks (es. SINGLE_RESOURCE_RISK se teamSize=1)
  │      → notes (tracciabilità regole attivate)
  │
  ├── 3. formatProjectContextBlock(projectContext)
  │      → Blocco testuale italiano iniettato nel prompt LLM
  │      "CONTESTO PROGETTO:
  │       - Nome: ...
  │       - Tipo progetto: Nuova Implementazione
  │       - Team: N persone ..."
  │
  ├── 4. selectTopActivities(..., activityBiases)
  │      → Bias deterministici applicati allo scoring delle attività
  │
  └── 5. mergeDriverSuggestions / mergeRiskSuggestions
         → Unisce suggerimenti deterministici + AI (AI ha priorità)
         → Provenance: source='project_context_rule', rule='nome_regola'
```

---

## 7. Rules Engine deterministico

Il Project Context alimenta un motore di regole pure ([project-context-rules.ts](../../netlify/functions/lib/domain/estimation/project-context-rules.ts)) che produce decisioni deterministiche senza chiamare l'AI.

### Regole attive

| Regola | Campo input | Condizione | Effetto |
|--------|-------------|------------|--------|
| **Scope** | `scope` | LARGE / ENTERPRISE | `preferLargeVariants = true` → bias +2 per attività `_LG` |
| | | SMALL | `preferSmallVariants = true` → bias +2 per attività `_SM` |
| **Deadline** | `deadlinePressure` | CRITICAL | Suggerisce driver TIMELINE_PRESSURE + risk TIMELINE_RISK |
| | | TIGHT | Suggerisce risk TIMELINE_RISK |
| **Team Size** | `teamSize` | = 1 | Suggerisce risk SINGLE_RESOURCE_RISK |
| | | ≥ 8 | Suggerisce driver TEAM_COORDINATION |
| **Project Type** | `projectType` | MIGRATION | Boost keyword: migration, data, legacy |
| | | INTEGRATION | Boost keyword: api, integration, interface |
| | | MAINTENANCE | Boost keyword: bug, fix, patch, maintenance |
| | | REFACTORING | Boost keyword: refactor, cleanup, technical_debt |
| **Methodology** | `methodology` | AGILE | Boost keyword: sprint, standup, retrospective |
| | | WATERFALL | Boost keyword: phase, gate, signoff, document |
| **Domain** | `domain` | qualsiasi | Boost keyword: valore del dominio (lowercase) |

### Output type

```typescript
interface ProjectContextRuleResult {
  activityBiases: ActivityBiases;
  suggestedDrivers: SuggestedDriver[];
  suggestedRisks: SuggestedRisk[];
  notes: string[];
}

interface ActivityBiases {
  preferLargeVariants?: boolean;
  preferSmallVariants?: boolean;
  keywordBoosts?: Array<{ keyword: string; boost: number }>;
  groupBoosts?: Array<{ group: string; boost: number }>;
}
```

---

## 8. Persistenza e operazioni CRUD

### Creazione

```typescript
// src/lib/projects/project-repository.ts — createProject()
const payload = {
  name: input.name,
  description: input.description || null,
  owner: input.owner || null,
  technology_id: input.technologyId || null,
  status: input.status || 'DRAFT',
  project_type: input.projectType || null,
  domain: input.domain || null,
  scope: input.scope || null,
  team_size: input.teamSize || null,
  deadline_pressure: input.deadlinePressure || null,
  methodology: input.methodology || null,
};
supabase.from('projects').insert(payload).select().single();
```

### Lettura

```typescript
// src/lib/projects/project-repository.ts — fetchProject()
supabase.from('projects').select('*').eq('id', projectId).single();
```

### Aggiornamento

```typescript
// EditProjectDialog.tsx — via project-repository
supabase.from('projects').update({
  name, description, owner,
  technology_id, status,
  project_type, domain, scope, team_size,
  deadline_pressure, methodology,
  updated_at: new Date().toISOString()
}).eq('id', project.id);
```

### Bundle (per wizard)

```typescript
// src/lib/api.ts — fetchRequirementBundle()
// Restituisce: { project, requirement, preset, driverValues, assignedEstimation }
// Usato dal wizard per avere tutto il contesto in una singola chiamata
```

---

## 9. Sicurezza (RLS)

| Policy | Regola |
|--------|--------|
| SELECT | `user_id = auth.uid()` OPPURE membro dell'organizzazione |
| INSERT | `user_id = auth.uid()` |
| UPDATE | `user_id = auth.uid()` OPPURE ruolo ADMIN/EDITOR nell'org |
| DELETE | `user_id = auth.uid()` OPPURE ruolo ADMIN nell'org |

Helper: `get_user_org_ids()` → UUID[] delle organizzazioni dell'utente autenticato.

---

## 10. Indici

```sql
idx_projects_user_id     -- Lookup rapido per utente
idx_projects_status      -- Filtro per stato (DRAFT/ACTIVE/ARCHIVED)
```

---

## 11. Catena FK completa (dalla radice alle foglie)

```
auth.users
  ↓ user_id
organizations ←──── organization_members
  ↓ organization_id
projects (PROGETTO)
  ├── technology_id → technologies
  │                     ↓ technology_id
  │                   activities (catalogo)
  │                     ↓ activity_id
  │                   technology_activities (override per-tech)
  │
  ↓ project_id
requirements
  ├── technology_id → technologies (override)
  │
  ├── requirement_id → requirement_understanding (AI)
  ├── requirement_id → impact_map (AI)
  ├── requirement_id → estimation_blueprint (AI)
  │
  ├── requirement_id → requirement_driver_values (baseline driver)
  │
  ↓ requirement_id
estimations
  ├── analysis_id → requirement_analyses (domain model)
  ├── decision_id → estimation_decisions (domain model)
  ├── blueprint_id → estimation_blueprint
  │
  ├── estimation_id → estimation_activities (junction → activities)
  ├── estimation_id → estimation_drivers (junction → drivers)
  ├── estimation_id → estimation_risks (junction → risks)
  └── estimation_id → estimation_snapshots (immutable freeze)
```

---

## 12. Punti di integrazione AI

Il Project Context del progetto viene iniettato in **tutti** gli endpoint AI:

| Endpoint | File | Campo body | Uso |
|----------|------|------------|-----|
| Interview | `ai-requirement-interview.ts` | `projectContext` | Prompt LLM + Rules Engine |
| Estimation | `ai-estimate-from-interview.ts` | `projectContext` | Prompt LLM + Rules Engine + Driver/Risk merge |
| Understanding | `generate-understanding.ts` | `projectContext` | Prompt LLM |
| Impact Map | `generate-impact-map.ts` | `projectContext` | Prompt LLM |
| Blueprint | `generate-estimation-blueprint.ts` | `projectContext` | Prompt LLM |
| Consultant | `ai-consultant.ts` | `projectContext` | Prompt LLM |

Formato di iniezione (`formatProjectContextBlock`):
```
CONTESTO PROGETTO:
- Nome: [name]
- Descrizione: [description]
- Responsabile: [owner]
- Tipo progetto: [projectType tradotto in italiano]
- Dominio: [domain]
- Dimensione: [scope tradotto]
- Team: [teamSize] persone
- Pressione temporale: [deadlinePressure tradotto]
- Metodologia: [methodology]
```

---

## 13. Vincoli architetturali noti

| Vincolo | Dettaglio | Impatto |
|---------|----------|---------|
| **1 tecnologia per progetto** | `projects.technology_id` è una singola FK, non una junction table N:N | Progetti multi-stack (frontend + backend) richiedono tecnologia "composita" o override per-requisito |
| **Project context non versionato** | I campi context sulla lista sono modificabili in-place; non c'è history | Cambiare scope/methodology dopo una stima non invalida le stime precedenti |
| **Nessuna validazione cross-entity** | Cambiare `technology_id` sul progetto non ricalcola le stime esistenti | Le stime salvate rimangono coerenti con la tecnologia al momento della creazione |
| **organization_id nullable** | Progetti legacy possono non avere organizzazione | `user_id` funziona come fallback per ownership |

---

## 14. Mappa file di riferimento

| Area | File |
|------|------|
| Schema DB | [supabase_schema.sql](../../supabase_schema.sql) |
| Migration context | [supabase/migrations/20260329_project_context_enrichment.sql](../../supabase/migrations/20260329_project_context_enrichment.sql) |
| Migration rename | [supabase/migrations/20260330_rename_lists_to_projects.sql](../../supabase/migrations/20260330_rename_lists_to_projects.sql) |
| Tipi TypeScript | [src/types/database.ts](../../src/types/database.ts) |
| Tipi dominio | [netlify/functions/lib/domain/types/estimation.ts](../../netlify/functions/lib/domain/types/estimation.ts) |
| API CRUD | [src/lib/api.ts](../../src/lib/api.ts) |
| Rules Engine | [netlify/functions/lib/domain/estimation/project-context-rules.ts](../../netlify/functions/lib/domain/estimation/project-context-rules.ts) |
| Integration layer | [netlify/functions/lib/domain/estimation/project-context-integration.ts](../../netlify/functions/lib/domain/estimation/project-context-integration.ts) |
| Prompt builder | [netlify/functions/lib/ai/prompt-builder.ts](../../netlify/functions/lib/ai/prompt-builder.ts) |
| UI creazione | [src/components/projects/CreateProjectDialog.tsx](../../src/components/projects/CreateProjectDialog.tsx) |
| UI modifica | [src/components/projects/EditProjectDialog.tsx](../../src/components/projects/EditProjectDialog.tsx) |
| Wizard bridge | [src/components/requirements/CreateRequirementDialog.tsx](../../src/components/requirements/CreateRequirementDialog.tsx) |
| State management | [src/hooks/useWizardState.ts](../../src/hooks/useWizardState.ts) |
