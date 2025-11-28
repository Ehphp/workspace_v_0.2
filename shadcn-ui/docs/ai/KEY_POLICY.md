## OpenAI Key Policy & Migration Guide

### Purpose
This document explains how the project manages OpenAI API keys and how to migrate from client-key usage to the server-side approach.

### Policy
- Production keys must never be exposed to the browser. Use `OPENAI_API_KEY` server-side (Netlify/Vercel environment variables, not `VITE_`).
- For local development with Netlify Functions use `netlify/.env` or Netlify Dev environment.
- `VITE_OPENAI_API_KEY` is deprecated for production and should be used only for demo/local scenarios with a placeholder or limited-Key.

### Why server-side only
- Prevents secret leakage to end-users.
- Allows better rate-limiting, monitoring, and caching via serverless functions.
- Ensures centralized billing / GA tracking and better security enforcement.

### Migration steps
1. Search for `VITE_OPENAI_API_KEY` in the repo. Replace usage in code with server calls to `/.netlify/functions/ai-suggest`.
2. Remove any places where OpenAI is initialized in the client with `dangerouslyAllowBrowser: true`.
3. Ensure `openai` SDK initialization is restricted to `netlify/functions/*` (server) and uses `process.env.OPENAI_API_KEY`.
4. Update documentation and `.env.example` to show `OPENAI_API_KEY` is server-only.
5. For local testing, add `OPENAI_API_KEY` into `netlify/.env` (not in `VITE_` variables) and run `pnpm run dev:netlify`.

### Netlify and Vercel guidance
- Netlify: configure `OPENAI_API_KEY` in the site's Build/Runtime environment variables in the Netlify dashboard.
- Vercel: configure `OPENAI_API_KEY` in the Environment Variables section for production/preview.

### Archival / Cleanup
- The repository previously contained a `.storage` folder with generated snapshots and demo files which sometimes referenced `VITE_OPENAI_API_KEY` in text. These files have been archived. Use `scripts/cleanup_storage.ps1` to remove `.storage` artifacts from your local checkout if you want to keep the repository clean.

### Local dev note
- If you must use a client-based demo key for local-only testing, add `VITE_OPENAI_API_KEY=sk-demo-xxx` to `.env` but mark it clearly as non-production and do not commit it.
- For consistent behavior mimic server-side calls in local dev by running `pnpm run dev:netlify` and setting `OPENAI_API_KEY` in `netlify/.env`.

### Automated checks
- CI checks are enforced to reject commits containing `sk-`, `VITE_OPENAI_API_KEY`, or `dangerouslyAllowBrowser: true` in client code. The repository now includes a `secret-scan` GitHub Action (in `.github/workflows/secret-scan.yml`) that fails PRs or pushes when obvious secrets or problematic patterns are found.

---
Maintainer: DevOps / Security Team
Last updated: 2025-11-28
