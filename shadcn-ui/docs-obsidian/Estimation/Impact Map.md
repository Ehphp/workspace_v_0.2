# Impact Map

Second AI artifact in the [[Estimation Pipeline]]. Maps the requirement to affected system layers and architectural actions.

## Type

Domain Artifact

## Role

Identifies which parts of the system are impacted by the requirement, producing a layer-by-layer impact analysis.

## Data shape

| Field | Type | Description |
|---|---|---|
| summary | string | High-level impact summary |
| impacts | ImpactItem[] | Per-layer impact entries |

Each `ImpactItem`:
| Field | Type | Description |
|---|---|---|
| layer | ImpactLayer | System layer affected |
| action | ImpactAction | Type of change required |
| components | string[] | Specific components affected |
| reason | string | Why this layer is impacted |
| confidence | number | AI confidence for this impact |

### Layers

`frontend` · `logic` · `data` · `integration` · `automation` · `configuration` · `ai_pipeline`

## Depends on

- [[Requirement Understanding]] — understanding feeds the impact analysis

## Produced by

- **Endpoint**: `POST /.netlify/functions/ai-impact-map`
- **Action**: `generateImpactMap()` → `netlify/functions/lib/ai/actions/generate-impact-map.ts`
- **UI trigger**: [[Wizard Flow]] step 2 (WizardStepImpactMap)
- **Persistence**: `saveImpactMap()` → `src/lib/api.ts`

## Consumed by

- [[Estimation Blueprint]] — uses impact data for technical anatomy
- [[Candidate Set]] — signal extraction (weight=2.0)
- [[Interview Flow]] — passed to `buildCandidateSet()` in `ai-requirement-interview`
- `WizardStepBlueprint.tsx` — passes as input to `generateEstimationBlueprint()`

## Persistence

- Table: `impact_map` (JSONB artifact)
- Migration: `supabase/migrations/20260308_impact_map.sql`
- Domain model: `impact_maps` table (standardized, `20260321`)
- See [[Data Model/Schema]]

## Endpoint

- `POST /.netlify/functions/ai-impact-map`
- Model: gpt-4o-mini
- See [[AI/Endpoints]]

## Represented in code

- `src/types/impact-map.ts` — type definitions
- `netlify/functions/ai-impact-map.ts` — endpoint
- `netlify/functions/lib/ai/actions/generate-impact-map.ts` — AI action
- `netlify/functions/lib/impact-map-signal-extractor.ts` — signal extractor for [[Candidate Set]]
- `src/components/requirements/wizard/WizardStepImpactMap.tsx` — UI step

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/types/impact-map.ts` — ImpactMap, ImpactItem, ImpactLayer, ImpactAction (all fields verified)
  - `netlify/functions/ai-impact-map.ts` — model: gpt-4o-mini (lines 95, 103)
  - `netlify/functions/lib/candidate-builder.ts` — WEIGHTS.impactMap = 2.0
  - `netlify/functions/lib/impact-map-signal-extractor.ts` — extractImpactMapSignals exists
- **corrections applied**:
  - Removed "Cache: 24h" claim — no caching configuration found in the endpoint file
