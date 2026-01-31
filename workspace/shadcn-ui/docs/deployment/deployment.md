# Deployment Guide

This guide covers how to deploy the Requirements Estimation System, including the estimation-history feature. Pick the hosting option that fits your stack, then run the checklists below.

## Prerequisites
- Supabase project ready with `supabase_schema.sql` and `supabase_seed.sql` applied.
- Environment variables available: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENAI_API_KEY` (server-only).
- Node.js 18+ and `pnpm` installed locally.

## Hosting Options
- **Vercel** (recommended for simplicity)
  1. Push the repository to GitHub.
  2. Import the repo in Vercel and set env vars above.
  3. Deploy; verify auth and AI suggestions.
- **Netlify** (serverless functions already configured)
  1. Connect the GitHub repo in Netlify.
  2. Build command `pnpm run build`, publish `dist`, functions `netlify/functions`.
  3. Set env vars and deploy; verify OpenAI calls.
- **Self-hosted**
  1. `pnpm run build`.
  2. Serve `dist/` via your web server (nginx, apache, static host).
  3. Provide server-side access to `OPENAI_API_KEY` if running functions.

## Pre-Deployment Testing
```bash
pnpm run lint
pnpm run build
pnpm run preview
```
All commands should pass without warnings or errors.

## Estimation History Rollout
- **Database optimizations (optional but recommended):** run `estimation_history_optimizations.sql` on Supabase for indexes, views, and helper functions.
- **UI verification:** in staging, save multiple estimations with scenario names, view the History tab, check timeline and comparison, and ensure reloads are fast with >10 records.
- **Fallback plan:** keep the previous build ready; if history UI misbehaves, hide timeline/comparison components temporarily in `RequirementDetail.tsx` until fixed.

## Security Checklist
- [ ] `.env` is ignored by git and env vars are set in the host.
- [ ] Supabase RLS policies enabled and tested.
- [ ] OpenAI API key has spend limits and is only available server-side.
- [ ] CORS configured for your production domain.
- [ ] HTTPS enforced (managed by Vercel/Netlify or your reverse proxy).

## Post-Deployment Verification
- **Anonymous flow:** complete the 5-step wizard and view the result.
- **Auth flow:** sign up, sign in, and access protected routes.
- **Lists & isolation:** create a project as User A, ensure User B cannot see it.
- **AI suggestions:** verify OpenAI calls succeed for imports and wizard flows.
- **Exports:** confirm Excel/PDF outputs if enabled in your build.

## Monitoring Essentials
- Usage: count estimations, AI suggestion rate, user sign-ups.
- Performance: page load times, AI latency, Supabase response times.
- Errors: Supabase logs, Netlify/Vercel function logs, browser console.
