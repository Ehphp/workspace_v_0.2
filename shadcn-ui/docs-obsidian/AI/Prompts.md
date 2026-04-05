# AI Prompts

Prompt engineering for the AI stages of the [[Estimation Pipeline]].

## Type

Infrastructure

## Prompt Files

| File | Prompt | Used by |
|---|---|---|
| `understanding-generation.ts` | `UNDERSTANDING_SYSTEM_PROMPT` | [[Requirement Understanding]] |
| `impact-map-generation.ts` | `IMPACT_MAP_SYSTEM_PROMPT` | [[Impact Map]] |
| `blueprint-generation.ts` | `BLUEPRINT_SYSTEM_PROMPT` | [[Estimation Blueprint]] |
| `question-generation.ts` | `QUESTION_GENERATION_SYSTEM_PROMPT` | [[Interview Flow]] (question generation) |
| `preset-generation.ts` | Preset generation prompt | Technology preset creation |
| `project-from-documentation.ts` | Documentation-based project prompt | Project generation from docs |

## Design Principles

- Structured output via JSON schema constraints
- Enum-bound fields to reduce hallucination
- Italian-language for artifact prompts (Understanding, Impact Map, Blueprint)
- English for question generation prompt
- System prompt + user prompt separation
- See [[Architecture/Constraints]] for validation pipeline

## Produced by

- Manual prompt engineering — static system prompts defined as TypeScript constants

## Consumed by

- [[AI/Endpoints]] — each endpoint imports its respective prompt
- [[Requirement Understanding]] → `UNDERSTANDING_SYSTEM_PROMPT`
- [[Impact Map]] → `IMPACT_MAP_SYSTEM_PROMPT`
- [[Estimation Blueprint]] → `BLUEPRINT_SYSTEM_PROMPT`
- [[Interview Flow]] → `QUESTION_GENERATION_SYSTEM_PROMPT`

## Represented in code

- `netlify/functions/lib/ai/prompts/` — all prompt definitions

## Stability

Medium

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `netlify/functions/lib/ai/prompts/understanding-generation.ts` — UNDERSTANDING_SYSTEM_PROMPT (line 19, Italian)
  - `netlify/functions/lib/ai/prompts/impact-map-generation.ts` — IMPACT_MAP_SYSTEM_PROMPT (line 18, Italian)
  - `netlify/functions/lib/ai/prompts/blueprint-generation.ts` — BLUEPRINT_SYSTEM_PROMPT (line 19, Italian)
  - `netlify/functions/lib/ai/prompts/question-generation.ts` — QUESTION_GENERATION_SYSTEM_PROMPT (line 12, English)
- **corrections applied**:
  - Original note claimed all 3 prompts were in `blueprint-generation.ts` → WRONG. Each has its own file
  - Added `question-generation.ts`, `preset-generation.ts`, `project-from-documentation.ts` (were missing)
  - "Italian-language for estimation prompts (determinism)" → corrected: artifact prompts are Italian, question generation is English
