# Estimation Blueprint

Third AI artifact in the [[Estimation Pipeline]]. Produces a technical anatomy of the requirement and deterministically maps it to candidate activities.

## Type

Domain Artifact

## Role

Decomposes the requirement into concrete technical components, integrations, data entities, and testing scope. Then a deterministic mapper translates these into activity candidates.

## Data shape

| Field | Type | Description |
|---|---|---|
| summary | string | Technical summary |
| components | BlueprintComponent[] | Technical components (layer, techCategory, complexity) |
| integrations | BlueprintIntegration[] | External integrations |
| dataEntities | BlueprintDataEntity[] | Data model changes |
| testingScope | BlueprintTestingScope[] | Required testing |
| assumptions | string[] | Technical assumptions |
| exclusions | string[] | Explicitly excluded scope |
| uncertainties | string[] | Unknowns requiring clarification |
| overallConfidence | number | AI confidence score |

## Deterministic Mapping

Blueprint components are mapped to activities via `LAYER_TECH_PATTERNS`:
- Lookup: `layer × techCategory → activity pattern`
- Complexity routing: `LOW/MEDIUM → _SM`, `HIGH → _LG`
- File: `netlify/functions/lib/blueprint-activity-mapper.ts`

This mapping is **deterministic** — same blueprint always produces same candidates. See [[Architecture/Constraints]].

## Depends on

- [[Requirement Understanding]] — understanding context
- [[Impact Map]] — impact analysis across layers

## Produced by

- **Endpoint**: `POST /.netlify/functions/ai-estimation-blueprint`
- **Action**: `generateEstimationBlueprint()` → `netlify/functions/lib/ai/actions/generate-estimation-blueprint.ts`
- **UI trigger**: [[Wizard Flow]] step 3 (WizardStepBlueprint)
- **Persistence**: `saveEstimationBlueprint()` → `src/lib/api.ts`

## Consumed by

- [[Candidate Set]] — primary signal source via deterministic mapping (weight=3.0)
- [[Interview Flow]] — blueprint context feeds interview questions
- `WizardStepInterview.tsx` — passed to `generateQuestions()`
- `blueprint-activity-mapper.ts` — `mapBlueprintToActivities()` extracts component→activity mapping

## Persistence

- Table: `estimation_blueprint` (JSONB artifact)
- Migration: `supabase/migrations/20260311_estimation_blueprint.sql`
- See [[Data Model/Schema]]

## Endpoint

- `POST /.netlify/functions/ai-estimation-blueprint`
- Model: gpt-4o-mini
- See [[AI/Endpoints]]

## Represented in code

- `src/types/estimation-blueprint.ts` — type definitions
- `netlify/functions/ai-estimation-blueprint.ts` — endpoint
- `netlify/functions/lib/ai/actions/generate-estimation-blueprint.ts` — AI action
- `netlify/functions/lib/blueprint-activity-mapper.ts` — deterministic mapper
- `src/components/requirements/wizard/WizardStepBlueprint.tsx` — UI step

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/types/estimation-blueprint.ts` — EstimationBlueprint interface, BlueprintComponent (layer, techCategory/InterventionType, complexity), BlueprintIntegration, BlueprintDataEntity, BlueprintTestingScope
  - `netlify/functions/ai-estimation-blueprint.ts` — model: gpt-4o-mini (lines 96, 105)
  - `netlify/functions/lib/blueprint-activity-mapper.ts` — LAYER_TECH_PATTERNS, complexity routing (LOW/MEDIUM vs HIGH)
  - `netlify/functions/lib/candidate-builder.ts` — WEIGHTS.blueprint = 3.0
- **corrections applied**:
  - Removed "Cache: 12h" claim — no caching configuration found in the endpoint file
  - Complexity routing detail confirmed: patterns include both `_SIMPLE`/`_COMPLEX` variants (e.g. PP_FLOW_SIMPLE vs PP_FLOW_COMPLEX) rather than `_SM`/`_LG` suffixes — the routing logic is in the mapper, not simple suffix substitution
