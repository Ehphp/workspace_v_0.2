# Syntero — Requirements Estimation System

A requirements estimation platform combining AI-generated artifacts with a deterministic calculation engine.

## What It Does

1. **Collects** requirement descriptions from users (wizard or quick estimate)
2. **Generates** structured AI artifacts: Understanding → Impact Map → Blueprint
3. **Proposes** relevant activities via AI interview planner
4. **Calculates** estimates using a deterministic formula
5. **Stores** estimation history with full traceability for audit and comparison

## What It Does NOT Do

- AI does not calculate estimates — the deterministic engine does
- AI does not set final driver/risk values — the user confirms all selections
- AI does not make final decisions — the user always reviews and confirms

---

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Supabase account
- OpenAI API key

### 1. Database Setup
```bash
# In Supabase SQL Editor:
1. Run supabase_schema.sql
2. Run supabase_seed.sql
3. Run migrations in supabase/migrations/ (in order)
```

### 2. Environment Variables
Create `.env` in project root:
```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
OPENAI_API_KEY=sk-<your-key>  # Server-side only
```

### 3. Install and Run
```bash
pnpm install
pnpm run dev:netlify  # Includes serverless functions
```

Visit `http://localhost:5173`

---

## Key Features

| Feature | Description |
|---------|-------------|
| 8-Step Wizard | AI-assisted estimation with review gates at each artifact |
| Quick Estimate V2 | Automated AI pipeline (same artifacts, no user review) |
| Deterministic Engine | Activities + drivers + risks → total days |
| AI Artifacts | Understanding, Impact Map, Blueprint — cascading context |
| Technology Presets | Pre-configured stacks (Power Platform, Backend, Frontend, Multi) |
| Domain Traceability | Analysis → ImpactMap → CandidateSet → Decision → Snapshot |
| Import/Export | Excel/CSV import with auto-mapping |

---

## Estimation Formula

```
Total Days = Subtotal × (1 + Contingency%)

Where:
  Subtotal = Base Days × Driver Multiplier
  Base Days = Σ(activity.base_hours) / 8
  Driver Multiplier = Π(driver.multiplier)
  Contingency% = f(Risk Score)
```

See [docs/estimation-engine.md](docs/estimation-engine.md) for details.

---

## Project Structure

```
src/
├── components/
│   ├── requirements/wizard/  # 8-step estimation wizard
│   ├── estimation/           # QuickEstimate, comparison, interview
│   └── configuration/        # Presets, admin panels
├── hooks/                    # useQuickEstimationV2, useWizardState, etc.
├── lib/
│   ├── estimationEngine.ts   # Deterministic calculations
│   ├── estimation-utils.ts   # Shared finalization logic
│   └── supabase.ts           # Database client
├── pages/                    # Route components
└── types/                    # TypeScript definitions

netlify/functions/
├── ai-requirement-understanding.ts  # Milestone 1
├── ai-impact-map.ts                 # Milestone 2
├── ai-estimation-blueprint.ts       # Milestone 3
├── ai-requirement-interview.ts      # Interview planner
├── ai-estimate-from-interview.ts    # Activity selection
├── ai-suggest.ts                    # Legacy V1
└── lib/
    ├── ai/         # Actions, prompts, cache, RAG
    ├── domain/     # Domain service layer (save-orchestrator)
    ├── handler/    # Netlify function factory
    └── security/   # Redis, CORS, rate limiter

docs/                   # Documentation (see docs/START_HERE.md)
supabase/migrations/    # Database migrations
```

---

## Documentation

Start here: [docs/START_HERE.md](docs/START_HERE.md)

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System architecture, 8-step wizard, estimation flows |
| [docs/estimation-engine.md](docs/estimation-engine.md) | Deterministic calculation model |
| [docs/ai-integration.md](docs/ai-integration.md) | AI artifact pipeline, scope, limits |
| [docs/data-model.md](docs/data-model.md) | Database schema, domain model |
| [docs/technology-presets.md](docs/technology-presets.md) | Preset configuration |
| [docs/api/ai-endpoints.md](docs/api/ai-endpoints.md) | AI endpoint reference |
| [docs/setup/setup-guide.md](docs/setup/setup-guide.md) | Installation guide |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Vite dev server |
| `pnpm run dev:netlify` | Dev with serverless functions |
| `pnpm run build` | Production build |
| `pnpm run lint` | ESLint check |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AI suggestions fail | Check `OPENAI_API_KEY` in server environment |
| Empty dropdowns | Run `supabase_seed.sql` |
| RLS errors | Verify `supabase_schema.sql` executed |
| Local AI not working | Use `pnpm run dev:netlify` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| Serverless | Netlify Functions (Node.js) |
| AI | OpenAI GPT-4o-mini (artifacts), GPT-4o (estimation) |
| Database | Supabase (PostgreSQL 15 + pgvector) |
| Auth | Supabase Auth |
| Caching | Redis (AI response cache, rate limiting) |
