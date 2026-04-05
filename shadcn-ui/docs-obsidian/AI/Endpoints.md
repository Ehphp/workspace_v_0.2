# AI Endpoints

Netlify Functions that power the AI stages of the [[Estimation Pipeline]].

## Type

Infrastructure

## Artifact Generation Endpoints

| Endpoint | Produces | Model |
|---|---|---|
| `ai-requirement-understanding` | [[Requirement Understanding]] | gpt-4o-mini |
| `ai-impact-map` | [[Impact Map]] | gpt-4o-mini |
| `ai-estimation-blueprint` | [[Estimation Blueprint]] | gpt-4o-mini |

## Interview & Estimation Endpoints

| Endpoint | Role | Model |
|---|---|---|
| `ai-requirement-interview` | Round 0 — information-gain planner (SKIP/ASK decision) | gpt-4o |
| `ai-estimate-from-interview` | Round 1 — activity selection via [[Candidate Set]] builder | gpt-4o |

See [[Interview Flow]] for the 2-round strategy.

## Support Endpoints

| Endpoint | Role |
|---|---|
| `ai-validate-requirement` | Validation gate for [[Wizard Flow]] step 1 |
| `ai-suggest` | Legacy V1 activity suggestion (keyword-based) |
| `ai-consultant` | Post-estimation senior consultant analysis |
| `ai-health` | Circuit breaker + Redis + DB + RAG status check |

## Handler Factory

All endpoints use `create-ai-handler.ts` which provides:
- HTTP method validation
- Authentication check (Supabase JWT)
- Server-side input sanitization (`sanitizePromptInput`)
- Custom body validation (per-endpoint)
- Structured JSON response
- Error handling

## Produced by

- **Factory**: `create-ai-handler.ts` — all endpoints use this handler factory
- **Pattern**: HTTP handler → validation → action function → structured JSON response

## Consumed by

- [[Wizard Flow]] — each step calls its corresponding endpoint
- `src/lib/api.ts` — frontend API helpers
- `src/lib/requirement-interview-api.ts` — interview API helpers

## Represented in code

- `netlify/functions/ai-*.ts` — endpoint definitions
- `netlify/functions/lib/handler/create-ai-handler.ts` — factory
- `netlify/functions/lib/ai/actions/` — action implementations

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `netlify/functions/ai-requirement-understanding.ts` — model: gpt-4o-mini (lines 97, 105)
  - `netlify/functions/ai-impact-map.ts` — model: gpt-4o-mini (lines 95, 103)
  - `netlify/functions/ai-estimation-blueprint.ts` — model: gpt-4o-mini (lines 96, 105)
  - `netlify/functions/ai-requirement-interview.ts` — model: gpt-4o (line 622)
  - `netlify/functions/ai-estimate-from-interview.ts` — model: gpt-4o (line 47)
  - `netlify/functions/lib/handler/create-ai-handler.ts` — sanitizePromptInput import, validation pipeline
- **corrections applied**:
  - Removed "Cache: 24h" and "Cache: 12h" claims — no caching configuration found in any endpoint file (FABRICATED)
  - "4-level input validation" → corrected to actual pipeline: HTTP method → auth → sanitization → custom body validation (confirmed in create-ai-handler.ts but "4-level" was a simplification; actual levels match handler code)
