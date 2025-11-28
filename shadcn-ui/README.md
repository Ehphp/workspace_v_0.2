# Requirements Estimation System

Enterprise-grade requirements estimation with AI-assisted activity selection, a deterministic calculation engine, and full auditability through estimation history and comparisons.

## Core Capabilities
- Public 5-step estimation wizard (no login) plus authenticated workspace with projects, requirements, and scenarios.
- Deterministic engine with activities, drivers, risks, contingency, and real-time summaries.
- AI-assisted activity suggestions via OpenAI (temperature 0 for consistent outputs) proxied through Netlify Functions.
- Multi-technology presets (Power Platform, Backend API, Frontend React, Multi-stack).
- Import/export: Excel/CSV imports with auto-mapping and AI title generation; PDF/Excel exports.
- Estimation history: named scenarios, timeline, and comparisons.
- Security: Supabase Auth with Row Level Security on user data; caching and input sanitization around AI calls.
- Custom activities: authenticated users can add/edit their own activities (with weights) and toggle availability; system activities remain read-only.
  - Override/fork: è possibile duplicare un’attività OOTB in una custom collegata tramite `base_activity_id` per personalizzare peso/nome senza toccare il catalogo di sistema.

## Navigazione UI (stato attuale)
- Header autenticato: Home `/`, Lists `/lists`, Admin `/admin`, Presets `/presets`, guida `/how-it-works`; dropdown account con Profile `/profile` e sign out.
- Stato attivo copre sottorotte: `/admin/activities` e `/presets` restano evidenziate; `/lists/:id/requirements[...]` resta sotto Lists con breadcrumb dinamico.
- Flussi di ritorno: da Custom Activities e Presets i CTA riportano alla dashboard Admin (`/admin`) per evitare deviazioni verso le liste.

## Quick Start
1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Database**
   - In Supabase SQL Editor run `supabase_schema.sql`, then `supabase_seed.sql`.
   - Optional performance add-ons: `estimation_history_optimizations.sql`.
3. **Environment**
   Create `.env` in the project root:
   ```env
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   OPENAI_API_KEY=sk-<your-openai-key>   # server-side only
   ```
4. **Run**
   ```bash
   pnpm run dev
   # or with Netlify functions locally
   pnpm run dev:netlify
   ```

## Custom activities panel
- Route: `/admin/activities` (visible once logged in).
- Access: all authenticated users can create/edit only their `is_custom=true` activities; others remain view-only.
- DB prerequisites (if your DB was created before this feature):
  ```sql
  alter table activities add column if not exists is_custom boolean default false;
  alter table activities add column if not exists created_by uuid references auth.users(id);
  alter table activities add column if not exists base_activity_id uuid references activities(id);
  create index if not exists idx_activities_is_custom on activities(is_custom);
  create index if not exists idx_activities_created_by on activities(created_by);
  create index if not exists idx_activities_base_activity on activities(base_activity_id);
  create policy "Users can insert custom activities" on activities
    for insert with check (auth.role() = 'authenticated' and is_custom = true and (created_by = auth.uid() or created_by is null));
  create policy "Users can update their custom activities" on activities
    for update using (auth.role() = 'authenticated' and is_custom = true and created_by = auth.uid())
    with check (auth.role() = 'authenticated' and is_custom = true and created_by = auth.uid());
  ```

## Useful Scripts
- `pnpm run dev` — Vite dev server.
- `pnpm run dev:netlify` — Netlify dev server with functions.
- `pnpm run lint` — lint checks.
- `pnpm run build` / `pnpm run preview` — production build and local preview.

## Project Structure
- `src/` — React app (pages, components, hooks, lib, types).
- `netlify/functions/` — serverless functions (OpenAI proxy and helpers).
- `public/` — static assets.
- `docs/` — organized documentation (see below).
- `supabase_*.sql` — schema, seed, and optimization scripts.

## Documentation
- Start with `docs/README.md` for the full map of guides.
- Setup: `docs/setup/setup-guide.md`
- Deployment: `docs/deployment/deployment.md`
- Estimation history: `docs/architecture/estimation-history.md`
- **AI System** (see `docs/ai/README.md` for complete index):
  - `docs/ai/ai-system-overview.md` — ⭐ Come funziona il sistema AI (inizia da qui)
  - `docs/ai/ai-input-validation.md` — Validazione e sanitizzazione (4 livelli)
  - `docs/ai/ai-variance-testing.md` — Test di consistenza AI
- Testing: `docs/testing/testing-guide.md`

## Deployment
- Preferred hosts: Vercel or Netlify.
- Follow `docs/deployment/deployment.md` for environment variables, history rollout checks, and monitoring.

## Troubleshooting
Ensure `OPENAI_API_KEY` is server-side only. See `docs/ai/KEY_POLICY.md` for migration guidance.
Note: This repository includes a GitHub Action that scans for obvious secrets (e.g., `sk-` tokens) and patterns such as `VITE_OPENAI_API_KEY` or `dangerouslyAllowBrowser` to prevent accidental key leakage.
- Use `pnpm run dev:netlify` if AI suggestions fail locally; check Netlify function logs for errors.
