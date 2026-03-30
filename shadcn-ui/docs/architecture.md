# Architecture

> **Last Updated**: 2026-03-22

## System Overview

Syntero is a requirements estimation system with four distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│   React SPA (Vite + TypeScript + Tailwind + shadcn/ui)          │
│   - 8-step Requirement Wizard                                   │
│   - Quick Estimate V2 (automated AI pipeline)                   │
│   - Dashboard, Admin, Configuration panels                      │
│   - Client-side calculation preview                             │
│   - Calls Netlify Functions for AI                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVERLESS LAYER                             │
│   Netlify Functions                                              │
│   - AI artifact generation (understanding, impact-map, blueprint)│
│   - Interview planner + estimation from interview               │
│   - Consultant analysis, embeddings, health checks              │
│   - ai-suggest.ts (legacy V1 path)                              │
│   - Validates input, enforces rate limits (Redis-backed)        │
│   - Never exposes API keys to client                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN SERVICE LAYER                         │
│   netlify/functions/lib/domain/estimation/                       │
│   - save-orchestrator.ts: transactional multi-table save        │
│   - analysis.service.ts, impact-map.service.ts                  │
│   - candidate-set.service.ts, decision.service.ts               │
│   - snapshot.service.ts, estimation-engine.ts                   │
│   - Ensures: Analysis → ImpactMap → CandidateSet → Decision    │
│              → Estimation → Snapshot traceability                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER                            │
│   Supabase (PostgreSQL + Auth + RLS + pgvector)                 │
│   - Catalog tables: activities, drivers, risks, technologies    │
│   - User data: projects, requirements, estimations               │
│   - AI artifacts: requirement_understanding, impact_map,        │
│     estimation_blueprint                                        │
│   - Domain model: requirement_analyses, impact_maps,            │
│     candidate_sets, estimation_decisions, estimation_snapshots   │
│   - Row Level Security enforces data isolation                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Frontend (`src/`)

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| **Requirement Wizard** | 7-step estimation flow | `src/components/requirements/RequirementWizard.tsx` |
| **WizardStep1** | Requirement description + metadata | `src/components/requirements/wizard/WizardStep1.tsx` |
| **WizardStepUnderstanding** | AI Requirement Understanding review | `src/components/requirements/wizard/WizardStepUnderstanding.tsx` |
| **WizardStepImpactMap** | AI Impact Map review | `src/components/requirements/wizard/WizardStepImpactMap.tsx` |
| **WizardStepBlueprint** | AI Estimation Blueprint review | `src/components/requirements/wizard/WizardStepBlueprint.tsx` |
| **WizardStepInterview** | Interview planner + Q&A + estimation | `src/components/requirements/wizard/WizardStepInterview.tsx` |
| **WizardStep4** | Driver & Risk selection | `src/components/requirements/wizard/WizardStep4.tsx` |
| **WizardStep5** | Results summary + Save | `src/components/requirements/wizard/WizardStep5.tsx` |
| **Quick Estimate V2** | Automated AI pipeline (no user review) | `src/hooks/useQuickEstimationV2.ts`, `src/components/estimation/QuickEstimate.tsx` |
| **Interview** | Single-requirement interview flow | `src/components/estimation/interview/` |
| **PresetWizard** | AI-assisted preset creation | `src/components/configuration/presets/ai-wizard/` |
| **Estimation Engine** | Deterministic calculation | `src/lib/estimationEngine.ts` |
| **Dashboard** | Project management | `src/pages/Dashboard.tsx` |
| **Admin** | Activity/preset management | `src/pages/AdminActivities.tsx`, `src/pages/Presets.tsx` |

### Serverless Functions (`netlify/functions/`)

| Function | Responsibility | Context |
|----------|----------------|---------|
| `ai-requirement-understanding.ts` | Generate structured understanding artifact | Wizard step 3, Quick Estimate V2 |
| `ai-impact-map.ts` | Generate architectural impact analysis | Wizard step 4, Quick Estimate V2 |
| `ai-estimation-blueprint.ts` | Generate technical estimation blueprint | Wizard step 5, Quick Estimate V2 |
| `ai-requirement-interview.ts` | Interview planner (ASK/SKIP + questions) | Wizard step 6, Quick Estimate V2 |
| `ai-estimate-from-interview.ts` | Select activities from interview answers | Wizard step 6, Quick Estimate V2 |
| `ai-consultant.ts` | Senior consultant post-estimation analysis | Post-estimation review |
| `ai-suggest.ts` | Activity suggestions, title, normalization | Legacy V1 Quick Estimate |
| `ai-bulk-interview.ts` | Aggregated questions for N requirements | Bulk estimation |
| `ai-bulk-estimate-with-answers.ts` | Batch activity selection | Bulk estimation |
| `ai-generate-questions.ts` | Stage 1: preset wizard questions | Custom preset creation |
| `ai-generate-preset.ts` | Stage 2: generate preset from answers | Custom preset creation |
| `ai-check-duplicates.ts` | Semantic activity deduplication | AI Technology Wizard |
| `ai-health.ts` | Health check (circuit breaker, Redis, DB, RAG) | Monitoring |

**Shared Libraries:**

| Path | Responsibility |
|------|----------------|
| `lib/ai/actions/` | AI action implementations (generate-understanding, generate-impact-map, generate-estimation-blueprint, suggest-activities, generate-title, etc.) |
| `lib/ai/prompts/` | System prompts + JSON schemas for each AI action |
| `lib/ai/ai-cache.ts` | Redis-backed AI response cache |
| `lib/ai/prompt-registry.ts` | Centralized prompt versioning + A/B testing |
| `lib/ai/prompt-feedback.ts` | LLM feedback loop |
| `lib/ai/rag.ts` | RAG retrieval for historical examples |
| `lib/ai/vector-search.ts` | pgvector semantic search |
| `lib/blueprint-activity-mapper.ts` | Deterministic blueprint → activity mapping |
| `lib/provenance-map.ts` | Deterministic provenance re-attachment |
| `lib/domain/estimation/` | Domain services (see Domain Service Layer below) |
| `lib/handler/create-ai-handler.ts` | Standardized Netlify function factory |
| `lib/security/` | Redis client, CORS, rate limiter |
| `lib/auth/auth-validator.ts` | Auth token validation |

### Domain Service Layer (`netlify/functions/lib/domain/estimation/`)

| Service | Responsibility |
|---------|----------------|
| `save-orchestrator.ts` | Orchestrate full domain chain: Analysis → ImpactMap → CandidateSet → Decision → Calculation → Snapshot |
| `analysis.service.ts` | Create/retrieve RequirementAnalysis records |
| `impact-map.service.ts` | Create/retrieve ImpactMap records (domain-level) |
| `candidate-set.service.ts` | Build and persist ranked activity candidate sets |
| `decision.service.ts` | Persist EstimationDecision (selected/excluded activities + rationale) |
| `snapshot.service.ts` | Create immutable estimation snapshots for audit |
| `estimation-engine.ts` | Pure deterministic estimation formula (ENGINE_VERSION tracked) |

### Database

See [data-model.md](data-model.md) for full schema reference. Key table groups:

| Group | Tables |
|-------|--------|
| **Catalog** | `activities`, `drivers`, `risks`, `technologies`, `technology_activities` |
| **User Data** | `projects`, `requirements`, `estimations`, `estimation_activities/drivers/risks` |
| **AI Artifacts** | `requirement_understanding`, `impact_map`, `estimation_blueprint` |
| **Domain Model** | `requirement_analyses`, `impact_maps`, `candidate_sets`, `estimation_decisions`, `estimation_snapshots` |
| **Observability** | `consultant_analyses`, `agent_execution_log`, `ai_prompts` |

---

## Estimation Flows

Syntero has two primary estimation paths that share the same AI artifact pipeline but differ in user interaction.

### Flow A: Requirement Wizard (8 Steps)

The wizard provides user-reviewed, step-by-step estimation with confirmation gates at each AI artifact.

```
Step 1: Requirement Description + Metadata
    ↓
Step 2: Technology Selection
    ↓
Step 3: AI Requirement Understanding → user reviews, confirms/regenerates
    ↓
Step 4: AI Impact Map → user reviews, confirms/regenerates
    ↓
Step 5: AI Estimation Blueprint → user reviews, confirms/regenerates
    ↓
Step 6: Interview Planner → ASK (show questions) or SKIP → AI Estimation
    ↓
Step 7: Drivers & Risks selection (AI-suggested values pre-filled)
    ↓
Step 8: Results Review → Save
```

**Save sequence** (RequirementWizard.tsx `handleSave`):
1. `createRequirement()` — persist the requirement record
2. `saveRequirementUnderstanding()` — persist understanding if confirmed
3. `saveImpactMap()` — persist impact map if confirmed
4. `saveEstimationBlueprint()` — persist blueprint if confirmed
5. `orchestrateWizardDomainSave()` — domain layer chain (analysis → decision → snapshot)
6. `saveEstimation()` — RPC `save_estimation_atomic`
7. `finalizeWizardSnapshot()` — non-blocking snapshot finalization

### Flow B: Quick Estimate V2

Automated pipeline that runs all AI steps without user review. Artifacts are auto-confirmed.

```
loadMasterData → Understanding → Impact Map → Blueprint
    → Interview Planner (ASK/SKIP) → Estimation → Finalize
```

- Orchestrated by `useQuickEstimationV2.ts`
- Each step is soft-optional: failure degrades quality but doesn't block
- Escalation policy: confidence < 0.60 → `shouldEscalate = true`
- Domain save via same orchestrator as wizard

### Shared AI Pipeline

Both flows use the same endpoint chain:

1. `POST /ai-requirement-understanding` → Requirement Understanding artifact
2. `POST /ai-impact-map` → Impact Map artifact
3. `POST /ai-estimation-blueprint` → Estimation Blueprint artifact
4. `POST /ai-requirement-interview` → Interview planner (ASK/SKIP decision + questions)
5. `POST /ai-estimate-from-interview` → Activity selection + confidence + suggested drivers/risks

Each artifact feeds into the next as cascading context.

### Deterministic Calculation

After AI selects activities and suggests drivers/risks, the deterministic engine computes the final estimate:

```
baseDays = Σ(activity.base_hours) / 8
driverMultiplier = Π(driver.multiplier)
subtotal = baseDays × driverMultiplier
riskScore = Σ(risk.weight)
contingency% = f(riskScore)
totalDays = subtotal × (1 + contingency%)
```

See [estimation-engine.md](estimation-engine.md) for full formula reference.

---

## Domain Model Traceability

The domain service layer ensures every estimation has a traceable chain of decisions:

```
Requirement
    ↓
RequirementAnalysis (understanding + metadata)
    ↓
ImpactMap (architectural analysis, linked to analysis)
    ↓
CandidateSet (ranked activity candidates, linked to analysis + impact_map)
    ↓
EstimationDecision (selected/excluded activities + rationale)
    ↓
Estimation (deterministic calculation result, FKs: analysis_id, decision_id, blueprint_id)
    ↓
EstimationSnapshot (immutable full input/output record)
```

The `save-orchestrator.ts` manages this chain atomically. Legacy estimations (without domain model records) remain valid and are not retroactively modified.

---

## Security Model

### Authentication
- Supabase Auth (email/password)
- Session tokens passed to serverless functions

### Authorization
- **Row Level Security (RLS)** on all user data tables
- Users see only their own projects, requirements, estimations
- Catalog tables (activities, drivers, risks) are public-read
- Custom activities/presets editable only by creator
- Organization-based policies on junction tables

### API Key Protection
- `OPENAI_API_KEY` stored server-side only
- Never exposed to browser
- All AI calls proxied through Netlify Functions

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | React hooks, localStorage (wizard state), Supabase realtime |
| Serverless | Netlify Functions (Node.js) |
| AI | OpenAI GPT-4o-mini (artifacts), GPT-4o (estimation) |
| Database | Supabase (PostgreSQL 15 + pgvector) |
| Auth | Supabase Auth |
| Caching | Redis (AI response cache, rate limiting) |

---

## Key Constraints

1. **AI is advisory only**: AI proposes activities, drivers, risks; the user confirms.
2. **Calculation is deterministic**: Same inputs always produce the same output. AI never calculates estimates.
3. **Artifact cascade**: Understanding → Impact Map → Blueprint → Interview → Estimation. Each artifact feeds context to the next.
4. **Backward compatibility**: Legacy estimations without domain model records remain valid.
5. **Server-side AI**: All OpenAI calls are server-side via Netlify Functions. No client-side AI in production.

---

## File References

- Schema: [data-model.md](data-model.md) (canonical) / [supabase_schema.sql](../supabase_schema.sql) (legacy baseline)
- Estimation engine: [estimation-engine.md](estimation-engine.md)
- AI integration: [ai-integration.md](ai-integration.md)
- AI endpoints: [api/ai-endpoints.md](api/ai-endpoints.md)
- Technology presets: [technology-presets.md](technology-presets.md)

---

**Update this document when**:
- Adding new serverless functions
- Changing the database schema
- Modifying the security model
- Adding or removing wizard steps
