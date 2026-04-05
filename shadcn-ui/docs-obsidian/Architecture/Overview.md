# Architecture Overview

High-level architecture of the Syntero estimation platform.

## Type

Data Reference

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + shadcn/ui + Tailwind |
| Backend | Netlify Functions (serverless) |
| Database | Supabase (PostgreSQL + RLS) |
| AI | OpenAI API (gpt-4o, gpt-4o-mini) |

## Core Flows

- [[Estimation Pipeline]] — end-to-end requirement-to-estimation flow
- [[Wizard Flow]] — UI orchestration of the pipeline
- [[AI/Endpoints]] — serverless AI functions

## Constraints

See [[Architecture/Constraints]] for determinism, backward compatibility, RLS, and validation rules.

## Data

See [[Data Model/Schema]] for entity relationships and table structure.

## Represented in code

- `docs/architecture.md` (technical reference)

## Stability

High

## Source of truth

Mixed

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/components/requirements/RequirementWizard.tsx` — React + wizard pattern confirmed
  - `netlify/functions/` — serverless functions confirmed
  - `supabase_schema.sql` — PostgreSQL schema confirmed
  - `netlify/functions/ai-*.ts` — OpenAI integration confirmed (gpt-4o, gpt-4o-mini)
