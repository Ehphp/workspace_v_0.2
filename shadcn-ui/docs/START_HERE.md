# START HERE

Welcome to Syntero, a requirements estimation system for software projects.

## Project Purpose

Syntero helps teams estimate software requirements using a **deterministic calculation engine** combined with **AI-assisted suggestions**. The AI proposes activities and enriches inputs; all estimates are computed deterministically from formulas. The system runs on **Supabase** (PostgreSQL + Auth) with **Netlify Functions** handling AI calls server-side.

---

## Documentation Structure

| Folder | Purpose |
|--------|---------|
| `docs/ai/` | AI implementation: validation, prompts, testing, key policy |
| `docs/architecture/` | Estimation flows, consistency fixes, history implementation |
| `docs/data/` | Data integrity, troubleshooting, presets |
| `docs/deployment/` | Production deployment guide |
| `docs/setup/` | Local installation and environment configuration |
| `docs/testing/` | Test plans, automation, manual testing guides |
| `docs/archive/` | Historical documents (legacy functional analysis) |

**Core reference documents** (top-level `docs/`):

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | System layers, component responsibilities, data flow |
| [estimation-engine.md](estimation-engine.md) | Deterministic calculation formulas |
| [ai-integration.md](ai-integration.md) | AI scope, limits, endpoints summary |
| [data-model.md](data-model.md) | Database schema, entities, RLS policies |
| [technology-presets.md](technology-presets.md) | Preset system, custom presets, activity filtering |

---

## Canonical Reading Paths

### If you are a Frontend Developer

1. [architecture.md](architecture.md) — Understand the three-tier architecture
2. [estimation-engine.md](estimation-engine.md) — Learn the deterministic calculation formula
3. [ai-integration.md](ai-integration.md) — AI is for suggestions only; UI must show AI outputs for user confirmation
4. [data-model.md](data-model.md) — Entities you'll fetch/display
5. [setup/setup-guide.md](setup/setup-guide.md) — Local dev setup

### If you are a Backend / AI Developer

1. [architecture.md](architecture.md) — Serverless layer and Netlify Functions overview
2. [ai-integration.md](ai-integration.md) — Complete AI pipeline: prompts, validation, caching
3. [api/ai-endpoints.md](api/ai-endpoints.md) — Reference for all AI endpoints
4. [ai/ai-input-validation.md](ai/ai-input-validation.md) — 4-level validation pipeline
5. [ai/KEY_POLICY.md](ai/KEY_POLICY.md) — API key security rules
6. [data-model.md](data-model.md) — Schema and RLS constraints
7. [setup/setup-guide.md](setup/setup-guide.md) — Environment variables and Supabase setup

### If you are working on Data / Presets

1. [data-model.md](data-model.md) — Full schema reference
2. [technology-presets.md](technology-presets.md) — Preset structure and activity linking
3. [data/integrity-playbook.md](data/integrity-playbook.md) — Data validation, troubleshooting, SQL diagnostics
4. [architecture/granular-activities-guide.md](architecture/granular-activities-guide.md) — Activity catalog details

---

## Quick Start

### Local Development

1. **Prerequisites**: Node.js 18+, `pnpm`, Supabase account, OpenAI API key
2. **Setup Supabase**: Create project, copy URL/anon key, run `supabase_schema.sql` then `supabase_seed.sql`
3. **Configure environment**: Create `.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and server-side `OPENAI_API_KEY`
4. **Install and run**:
   ```bash
   pnpm install
   pnpm run dev:netlify  # Includes Netlify Functions locally
   ```

Full guide: [setup/setup-guide.md](setup/setup-guide.md)

### Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase anon/public key |
| `OPENAI_API_KEY` | Server only | OpenAI API key (never expose to browser) |

See [ai/KEY_POLICY.md](ai/KEY_POLICY.md) for key security guidelines.

---

## Reference vs Historical Documents

### Reference Documents (Current)

All documents in `docs/` except `docs/archive/` are **active reference material**. They describe the current system behavior and should be kept up-to-date.

### Historical Documents (Archive)

Documents in [docs/archive/](archive/) are **historical snapshots** from earlier development phases. They provide context but may not reflect current implementation:

- `ANALISI_FUNZIONALE.md` — Original functional analysis
- `DOCUMENTAZIONE_FUNZIONALITA_COMPLETE.md` — Legacy feature documentation

Do not edit archived documents as part of normal updates.

---

## Key Architectural Principles

1. **Deterministic Estimation**: AI never calculates effort. The engine does. Same inputs → same outputs.
2. **AI for Suggestion Only**: AI proposes activities; user confirms. AI output is always validated.
3. **Server-Side AI**: OpenAI API key stays on the server (Netlify Functions). No client-side AI calls in production.
4. **RLS Data Isolation**: Users see only their own lists, requirements, estimations. Catalog tables are public-read.

---

## New Endpoints Reference

For detailed documentation of all AI-related Netlify Functions, see:

- [api/ai-endpoints.md](api/ai-endpoints.md) — Complete AI endpoints reference

For data validation and troubleshooting:

- [data/integrity-playbook.md](data/integrity-playbook.md) — Data integrity checks and recovery

---

**Last Updated**: 2026-02-08  
**Maintainer**: Development Team
