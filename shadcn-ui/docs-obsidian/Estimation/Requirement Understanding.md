# Requirement Understanding

First AI artifact in the [[Estimation Pipeline]]. Produces a structured decomposition of the user's raw requirement.

## Type

Domain Artifact

## Role

Transforms free-text requirement into a structured understanding that downstream artifacts ([[Impact Map]], [[Estimation Blueprint]]) can consume.

## Data shape

| Field | Type | Description |
|---|---|---|
| businessObjective | string | What the requirement aims to achieve |
| expectedOutput | string | Concrete deliverable description |
| functionalPerimeter | string[] | Boundaries of the requirement scope (1-8 items) |
| exclusions | string[] | What is NOT in scope (0-5 items) |
| actors | RequirementActor[] | Users/systems involved (1-5, each with role + interaction) |
| stateTransition | StateTransition | Before/after state (initialState, finalState) |
| preconditions | string[] | Preconditions/triggers (0-5 items) |
| assumptions | string[] | Working assumptions (0-5 items) |
| complexityAssessment | ComplexityAssessment | level (LOW/MEDIUM/HIGH) + rationale |
| confidence | number | AI confidence score (0-1) |
| metadata | UnderstandingMetadata | generatedAt, model, techCategory, inputDescriptionLength |

## Depends on

- Raw requirement description (user input from wizard step 1)

## Produced by

- **Endpoint**: `POST /.netlify/functions/ai-requirement-understanding`
- **Action**: `generateRequirementUnderstanding()` → `netlify/functions/lib/ai/actions/generate-understanding.ts`
- **UI trigger**: [[Wizard Flow]] step 1 (WizardStepUnderstanding)
- **Persistence**: `saveRequirementUnderstanding()` → `src/lib/api.ts`

## Consumed by

- [[Impact Map]] — uses understanding to identify affected system layers
- [[Estimation Blueprint]] — uses understanding for technical anatomy
- [[Candidate Set]] — signal extraction (weight=1.5)
- [[Interview Flow]] — passed to `buildCandidateSet()` in `ai-requirement-interview`
- `WizardStepImpactMap.tsx` — passes as input to `generateImpactMap()`

## Persistence

- Table: `requirement_understanding` (JSONB artifact)
- Migration: `supabase/migrations/20260306_requirement_understanding.sql`
- See [[Data Model/Schema]]

## Endpoint

- `POST /.netlify/functions/ai-requirement-understanding`
- Model: gpt-4o-mini
- See [[AI/Endpoints]]

## Represented in code

- `src/types/requirement-understanding.ts` — type definitions
- `netlify/functions/ai-requirement-understanding.ts` — endpoint
- `netlify/functions/lib/ai/actions/generate-understanding.ts` — AI action
- `src/components/requirements/wizard/WizardStepUnderstanding.tsx` — UI step

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/types/requirement-understanding.ts` — RequirementUnderstanding interface (all fields verified)
  - `netlify/functions/ai-requirement-understanding.ts` — model confirmed gpt-4o-mini (lines 97, 105)
  - `netlify/functions/lib/candidate-builder.ts` — WEIGHTS.understanding = 1.5
- **corrections applied**:
  - `assumptions` was listed as `string` → corrected to `string[]`
  - Added missing fields: `exclusions: string[]`, `preconditions: string[]`, `metadata: UnderstandingMetadata`
  - `stateTransition` was listed as `object` → corrected to `StateTransition { initialState, finalState }`
  - `complexityAssessment` was listed as `object` → corrected to `ComplexityAssessment { level: LOW|MEDIUM|HIGH, rationale }`
  - Removed "Cache: 24h" claim — no caching configuration found in the endpoint file
