# Setup Guide

Follow these steps to get the Requirements Estimation System running locally with a seeded Supabase project and working AI suggestions.

## Prerequisites
- Node.js 18+ and `pnpm`
- Supabase account
- OpenAI API key with credits
- Modern browser (Chrome/Firefox/Edge/Safari)

## 1) Prepare Supabase
1. Create a new Supabase project.
2. In **Settings → API**, copy the **Project URL** and **anon public key**.
3. In **SQL Editor**, run `supabase_schema.sql`.
4. Still in **SQL Editor**, run `supabase_seed.sql`.
5. Verify tables and seed rows in **Table Editor** (activities=27, drivers=5, risks=8, presets=4).

Optional performance add-ons: run `estimation_history_optimizations.sql` for indexes, helper views, and functions that speed up the history feature.

## 2) Configure Environment
Create `.env` in the project root (local development):
```env
# Supabase client-side values (browser safe)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>

# OpenAI key: server-side only. Do NOT put the production OpenAI key in any VITE_ variable.
# In production, set `OPENAI_API_KEY` in Netlify/Vercel environment variables.
# For local Netlify dev, set `OPENAI_API_KEY` under `netlify/.env` and run `pnpm run dev:netlify` to ensure serverless functions are used locally.
OPENAI_API_KEY=sk-<your-openai-key>   # server-side only
```
Notes:
- Keep `.env` out of version control (already in `.gitignore`).
- Use the non-VITE `OPENAI_API_KEY` server-side; do not expose it to the browser.
- If you still have a `VITE_OPENAI_API_KEY` for legacy/local demo flow, ensure it uses a limited or placeholder key and never commit it. Prefer running local dev with `netlify dev` and `OPENAI_API_KEY` in `netlify/.env` instead of client-exposed keys.

> ⚠️ Note: Some legacy demo code may check `VITE_OPENAI_API_KEY` to enable demo mode — ensure that this is never a real key and is used only for local demos.

See `workspace/shadcn-ui/docs/ai/KEY_POLICY.md` for full guidance on key usage and migration.

## 3) Install and Run
```bash
pnpm install
pnpm run dev          # or pnpm run dev:netlify to include Netlify Functions locally
```
Visit `http://localhost:5173`.

Optional cleanup: if you want to remove generated snapshots or duplicates from the workspace, run the cleanup script at the repository root:

PowerShell:
```
./scripts/cleanup_storage.ps1
```

## 4) Quick Smoke Tests
- Start the public 5-step wizard and complete a run.
- Sign up, sign in, and create a project/list.
- Add a requirement and request AI suggestions; verify activities are auto-selected.
- Save at least two estimations for a requirement and confirm they appear in the History tab.

## Common Issues
- **Missing env vars:** confirm `.env` exists and names start with `VITE_` for browser-side keys.
- **AI suggestions fail:** ensure `OPENAI_API_KEY` has credit and run `pnpm run dev:netlify` locally.
- **Empty dropdowns:** re-run `supabase_seed.sql` and refresh.
- **RLS errors:** confirm `supabase_schema.sql` executed fully and that you are authenticated.

If issues persist, check Supabase logs, Netlify/Vercel function logs, and the browser console for details.
