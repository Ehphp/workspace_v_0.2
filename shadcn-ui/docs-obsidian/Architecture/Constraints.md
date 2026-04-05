# Architectural Constraints

Cross-cutting constraints that govern the [[Estimation Pipeline]] and all its artifacts.

## Type

Constraint

## Determinism

The estimation calculation is **fully deterministic** — same inputs always produce same outputs. This is enforced by:

- Versioned [[Engine]] formula (`ENGINE_VERSION` constant)
- Deterministic blueprint mapping (`LAYER_TECH_PATTERNS` in `blueprint-activity-mapper.ts`)
- AI used only for artifact generation, never for final calculation

See [[Engine]] for the formula.

## Backward Compatibility

All artifact steps in the pipeline are **optional**:

- [[Requirement Understanding]], [[Impact Map]], [[Estimation Blueprint]] can each be skipped
- [[Candidate Set]] degrades gracefully — uses keyword fallback if no artifacts available
- Legacy V1 path still supported via `ai-suggest.ts`

## Data Isolation (RLS)

Row-Level Security on all tables:
- Users see only their own projects' requirements and estimations
- Applied via Supabase RLS policies
- See [[Data Model/Schema]]

## AI Validation Pipeline

Server-side validation in `create-ai-handler.ts`:
1. HTTP method validation (POST only)
2. Authentication check (Supabase JWT)
3. Input sanitization (`sanitizePromptInput`)
4. Custom body validation (per-endpoint, optional)

AI response validation via Zod schemas in individual action files.

## Performance

- Deterministic mappings computed server-side (no AI needed)
- No AI calls during final [[Engine]] calculation

## Represented in code

- `netlify/functions/lib/domain/estimation/estimation-engine.ts` — versioned engine
- `netlify/functions/lib/blueprint-activity-mapper.ts` — deterministic mapper
- `netlify/functions/lib/handler/create-ai-handler.ts` — validation pipeline

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: PARTIAL
- **source**:
  - `netlify/functions/lib/domain/estimation/estimation-engine.ts` — ENGINE_VERSION = '2.0.0', deterministic computeEstimation
  - `netlify/functions/lib/blueprint-activity-mapper.ts` — LAYER_TECH_PATTERNS (static lookup)
  - `netlify/functions/lib/handler/create-ai-handler.ts` — sanitizePromptInput import (line 33), auth check (line 146), body validation (line 206)
  - `netlify/functions/ai-suggest.ts` — confirmed exists (legacy V1 path)
- **corrections applied**:
  - "4-level validation" was misleading → replaced with actual pipeline steps from create-ai-handler.ts
  - Removed "AI artifact caching: 24h / 12h" claim — no caching configuration found in any endpoint file
- **partial because**:
  - RLS policies are assumed based on Supabase patterns but not individually verified in migration files
