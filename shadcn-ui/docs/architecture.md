# Architecture

## System Overview

Syntero is a requirements estimation system with three distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│   React SPA (Vite + TypeScript + Tailwind + shadcn/ui)          │
│   - Wizard UI, Dashboard, Admin panels                          │
│   - Client-side calculation preview                             │
│   - Calls Netlify Functions for AI                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVERLESS LAYER                             │
│   Netlify Functions                                              │
│   - ai-suggest.ts: activity suggestions, title, normalization   │
│   - ai-*-interview.ts: interview question/estimation flows      │
│   - ai-generate-*.ts: custom preset wizard                      │
│   - Validates input, enforces rate limits (Redis-backed)        │
│   - Never exposes API keys to client                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER                            │
│   Supabase (PostgreSQL + Auth + RLS)                            │
│   - Catalog tables: activities, drivers, risks, presets         │
│   - User data: lists, requirements, estimations                 │
│   - Row Level Security enforces data isolation                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Frontend (`src/`)

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| **Wizard** | 5-step estimation flow | `src/components/wizard/WizardStep*.tsx` |
| **QuickEstimate** | Simplified estimation | `src/components/estimation/QuickEstimate.tsx` |
| **Interview** | Single-requirement interview flow | `src/components/estimation/interview/` |
| **BulkInterview** | Multi-requirement interview | `src/components/requirements/BulkInterviewDialog.tsx` |
| **PresetWizard** | AI-assisted preset creation | `src/components/configuration/presets/ai-wizard/` |
| **Estimation Engine** | Deterministic calculation | `src/lib/estimationEngine.ts` |
| **AI Clients** | Serverless AI proxy calls | `src/lib/openai.ts`, `src/lib/ai-interview-api.ts`, `src/lib/bulk-interview-api.ts` |
| **Dashboard** | Project/list management | `src/pages/Dashboard.tsx`, `src/pages/Lists.tsx` |
| **Admin** | Activity/preset management | `src/pages/AdminActivities.tsx`, `src/pages/Presets.tsx` |

### Serverless Functions (`netlify/functions/`)

| Function | Responsibility | Context |
|----------|----------------|---------|
| `ai-suggest.ts` | Activity suggestions, title generation, normalization | Quick estimation |
| `ai-requirement-interview.ts` | Generate technical questions for single requirement | Interview flow |
| `ai-estimate-from-interview.ts` | Select activities based on interview answers | Interview flow |
| `ai-bulk-interview.ts` | Aggregated questions for multiple requirements | Bulk estimation |
| `ai-bulk-estimate-with-answers.ts` | Batch activity selection from bulk answers | Bulk estimation |
| `ai-generate-questions.ts` | Stage 1: questions for preset wizard | Custom preset creation |
| `ai-generate-preset.ts` | Stage 2: generate preset from answers | Custom preset creation |

**Shared Libraries:**

| File | Responsibility |
|------|----------------|
| `lib/ai/actions/suggest-activities.ts` | Activity suggestion logic |
| `lib/ai/actions/generate-title.ts` | Title generation logic |
| `lib/ai/actions/generate-questions.ts` | Question generation for preset wizard |
| `lib/ai/prompt-builder.ts` | Constructs GPT prompts |
| `lib/ai/ai-cache.ts` | 24h response cache |
| `lib/security/cors.ts` | Origin validation |
| `lib/security/rate-limiter.ts` | Redis-backed request throttling |
| `lib/auth/auth-validator.ts` | Auth token validation |

### Database (`supabase_*.sql`)

| Table | Purpose |
|-------|---------|
| `activities` | Activity catalog (system + custom) |
| `drivers` | Complexity multiplier definitions |
| `risks` | Risk weight definitions |
| `technology_presets` | Pre-configured technology stacks |
| `lists` | User projects/containers |
| `requirements` | Individual requirements within lists |
| `estimations` | Saved estimation snapshots |
| `estimation_activities/drivers/risks` | Junction tables |

---

## Data Flow: Estimation

```
1. User enters requirement description
      │
      ▼
2. [OPTIONAL] User clicks "AI Suggest"
      │
      ├─► Frontend sanitizes input (sanitizePromptInput)
      │
      ├─► POST /.netlify/functions/ai-suggest
      │         │
      │         ├─► Server re-sanitizes (defense in depth)
      │         ├─► Filters activities by tech_category
      │         ├─► Checks cache (24h TTL)
      │         │
      │         └─► [Cache Miss] Calls OpenAI GPT-4o-mini
      │                   │
      │                   ├─► Structured Output with enum constraint
      │                   └─► Returns { activityCodes, isValidRequirement, reasoning }
      │
      └─► Frontend displays suggestions; user accepts/modifies
      │
      ▼
3. User selects activities, drivers, risks
      │
      ▼
4. Frontend calls calculateEstimation() [DETERMINISTIC]
      │
      ├─► baseDays = Σ(activity.base_hours) / 8
      ├─► driverMultiplier = Π(driver.multiplier)
      ├─► subtotal = baseDays × driverMultiplier
      ├─► riskScore = Σ(risk.weight)
      ├─► contingency% = f(riskScore)  [see estimation-engine.md]
      └─► totalDays = subtotal × (1 + contingency%)
      │
      ▼
5. User saves estimation
      │
      └─► supabase.rpc('save_estimation_atomic', ...)
                │
                └─► Transaction inserts: estimation + junction tables
```

---

## Security Model

### Authentication
- Supabase Auth (email/password)
- Session tokens passed to serverless functions

### Authorization
- **Row Level Security (RLS)** on all user data tables
- Users see only their own lists, requirements, estimations
- Catalog tables (activities, drivers, risks) are public-read
- Custom activities/presets editable only by creator

### API Key Protection
- `OPENAI_API_KEY` stored server-side only
- Never exposed to browser
- All AI calls proxied through Netlify Functions

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | React hooks, Supabase realtime |
| Serverless | Netlify Functions (Node.js) |
| AI | OpenAI GPT-4o-mini (structured outputs) |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth |

---

## Key Constraints

1. **AI is advisory only**: AI proposes activity codes; the user confirms.
2. **Calculation is deterministic**: Same inputs always produce the same output.
3. **No admin role in code**: Access control is based on `created_by` field, not roles.
4. **Single-tenant per user**: Each user sees only their data (no team sharing yet).

---

## File References

- Architecture diagram source: This document
- Schema: [supabase_schema.sql](../supabase_schema.sql)
- Estimation engine: [src/lib/estimationEngine.ts](../src/lib/estimationEngine.ts)
- AI integration details: [docs/ai-integration.md](ai-integration.md)
- AI serverless functions: [netlify/functions/](../netlify/functions/)

---

**Update this document when**:
- Adding new serverless functions
- Changing the database schema
- Modifying the security model
