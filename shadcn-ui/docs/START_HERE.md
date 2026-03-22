# START HERE

> **Last Updated**: 2026-03-22

Welcome to Syntero, a requirements estimation system for software projects.

## Project Purpose

Syntero helps teams estimate software requirements using a **deterministic calculation engine** combined with **AI-assisted artifact generation**. AI produces structured artifacts (Understanding, Impact Map, Blueprint) and proposes activities; all estimates are computed deterministically from formulas. The system runs on **Supabase** (PostgreSQL + Auth + pgvector) with **Netlify Functions** handling AI calls server-side.

---

## Documentation Structure

### Core Reference (top-level `docs/`)

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | System layers, component responsibilities, estimation flows |
| [estimation-engine.md](estimation-engine.md) | Deterministic calculation formulas |
| [ai-integration.md](ai-integration.md) | AI artifact pipeline, scope, limits |
| [data-model.md](data-model.md) | Database schema, entities, RLS policies, domain model |
| [technology-presets.md](technology-presets.md) | Preset system, custom presets, activity filtering |

### Subdirectories

| Folder | Purpose |
|--------|---------|
| `docs/ai/` | AI validation, variance testing, key policy |
| `docs/api/` | AI endpoint reference |
| `docs/architecture/` | Estimation flows, consistency fixes, activity catalog |
| `docs/components/` | UI component guides (style, interactions) |
| `docs/data/` | Data integrity playbook |
| `docs/deployment/` | Production deployment guide |
| `docs/diagrams/` | ERD, sequence diagrams |
| `docs/plans/` | Implementation plans (not reference — may be stale) |
| `docs/reports/` | Audits and analysis reports (point-in-time snapshots) |
| `docs/setup/` | Local installation, Docker/Redis setup |
| `docs/templates/` | Page layout templates |
| `docs/testing/` | Test plans and guides |
| `docs/archive/` | Historical documents — do not edit |

---

## Canonical Reading Paths

### Frontend Developer

1. [architecture.md](architecture.md) — Four-layer architecture, 8-step wizard flow
2. [estimation-engine.md](estimation-engine.md) — Deterministic calculation formula
3. [ai-integration.md](ai-integration.md) — AI artifacts and user confirmation gates
4. [data-model.md](data-model.md) — Entities you'll fetch/display
5. [setup/setup-guide.md](setup/setup-guide.md) — Local dev setup

### Backend / AI Developer

1. [architecture.md](architecture.md) — Serverless layer, domain service layer
2. [ai-integration.md](ai-integration.md) — AI artifact pipeline, caching, prompt registry
3. [api/ai-endpoints.md](api/ai-endpoints.md) — Complete AI endpoint reference
4. [ai/ai-input-validation.md](ai/ai-input-validation.md) — 4-level validation pipeline
5. [ai/KEY_POLICY.md](ai/KEY_POLICY.md) — API key security rules
6. [data-model.md](data-model.md) — Schema, domain model, RLS constraints
7. [setup/setup-guide.md](setup/setup-guide.md) — Environment variables and Supabase setup

### Data / Presets

1. [data-model.md](data-model.md) — Full schema reference incl. domain model
2. [technology-presets.md](technology-presets.md) — Preset structure and activity linking
3. [data/integrity-playbook.md](data/integrity-playbook.md) — Data validation, troubleshooting
4. [architecture/granular-activities-guide.md](architecture/granular-activities-guide.md) — Activity catalog

---

## Quick Start

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

## Document Categories

| Category | Location | Description |
|----------|----------|-------------|
| **Reference** | `docs/*.md`, `docs/ai/`, `docs/api/`, `docs/architecture/`, `docs/data/`, `docs/setup/`, `docs/deployment/`, `docs/testing/` | Active material — describes current system behavior — keep up-to-date |
| **Plans** | `docs/plans/` | Implementation plans — may be stale after completion |
| **Reports** | `docs/reports/` | Point-in-time audits and analyses — historical accuracy |
| **Archive** | `docs/archive/` | Superseded documents — do not edit |

---

## Key Architectural Principles

1. **Deterministic Estimation**: AI never calculates effort. The engine does. Same inputs → same outputs.
2. **AI Artifacts are Advisory**: AI generates structured artifacts; user reviews and confirms each one.
3. **Server-Side AI**: OpenAI API key stays on the server (Netlify Functions). No client-side AI calls in production.
4. **RLS Data Isolation**: Users see only their own lists, requirements, estimations. Catalog tables are public-read.
5. **Domain Model Traceability**: Every estimation traces through Analysis → ImpactMap → CandidateSet → Decision → Snapshot.
