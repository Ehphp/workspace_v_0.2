# Syntero — Requirements Estimation System

A requirements estimation platform combining AI-assisted activity suggestions with a deterministic calculation engine.

## What It Does

1. **Collects** requirement descriptions from users
2. **Proposes** relevant activities via AI (user reviews and confirms)
3. **Calculates** estimates using a deterministic formula
4. **Stores** estimation history for audit and comparison

## What It Does NOT Do

- AI does not calculate estimates — the engine does
- AI does not set final driver/risk values — the user confirms all selections
- AI does not make final decisions — the user always confirms

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
3. (Optional) Run estimation_history_optimizations.sql
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
| Public Wizard | 5-step estimation without login |
| Authenticated Workspace | Projects, requirements, history |
| Deterministic Engine | Activities + drivers + risks → total days |
| AI Suggestions | GPT-4o-mini proposes activities (temperature=0) |
| Technology Presets | Pre-configured stacks (Power Platform, Backend, Frontend, Multi) |
| Import/Export | Excel/CSV import with auto-mapping |
| Custom Activities | Users create and manage own activities |

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
├── components/         # React components
│   ├── wizard/         # 5-step estimation wizard
│   └── estimation/     # QuickEstimate, comparison
├── lib/
│   ├── estimationEngine.ts  # Deterministic calculations
│   ├── openai.ts            # AI client wrapper
│   └── supabase.ts          # Database client
├── pages/              # Route components
└── types/              # TypeScript definitions

netlify/functions/
├── ai-suggest.ts       # AI proxy entry point
└── lib/ai/             # AI logic modules

docs/                   # Documentation
supabase_*.sql          # Database scripts
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/estimation-engine.md](docs/estimation-engine.md) | Calculation logic |
| [docs/ai-integration.md](docs/ai-integration.md) | AI scope and limits |
| [docs/data-model.md](docs/data-model.md) | Database schema |
| [docs/technology-presets.md](docs/technology-presets.md) | Preset configuration |
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
| Frontend | React, TypeScript, Vite, Tailwind, shadcn/ui |
| Serverless | Netlify Functions |
| AI | OpenAI GPT-4o-mini |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
