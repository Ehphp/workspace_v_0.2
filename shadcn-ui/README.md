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
- AI determinism and testing: `docs/ai/ai-determinism-improvement-plan.md`, `docs/ai/ai-variance-testing.md`
- Testing: `docs/testing/testing-guide.md`

## Deployment
- Preferred hosts: Vercel or Netlify.
- Follow `docs/deployment/deployment.md` for environment variables, history rollout checks, and monitoring.

## Troubleshooting
- Verify Supabase tables/seed are applied.
- Ensure `OPENAI_API_KEY` is server-side only.
- Use `pnpm run dev:netlify` if AI suggestions fail locally; check Netlify function logs for errors.
