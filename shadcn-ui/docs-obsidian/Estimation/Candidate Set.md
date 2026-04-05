# Candidate Set

Core domain artifact in the [[Estimation Pipeline]]. Merges signals from all upstream artifacts into a scored, ranked set of activity candidates with full provenance.

## Type

Domain Artifact

## Role

Acts as the bridge between AI-generated artifacts and the deterministic [[Engine]]. Implements a 3-layer signal extraction and scoring pipeline.

## 3-Layer Architecture

### Layer 1 — Signal Extraction

Extracts activity signals from each available artifact:

| Source | Weight | Extractor |
|---|---|---|
| [[Estimation Blueprint]] | 3.0 | Deterministic `LAYER_TECH_PATTERNS` lookup (`blueprint-activity-mapper.ts`) |
| [[Impact Map]] | 2.0 | Layer-based signal matching (`impact-map-signal-extractor.ts`) |
| [[Requirement Understanding]] | 1.5 | Perimeter + complexity routing (`understanding-signal-extractor.ts`) |
| Keyword fallback | 1.0 | Text-based matching via `selectTopActivities()` (always runs as baseline) |
| Project context | 0.5 | Activity biases from project rules (optional) |

### Layer 2 — Scoring & Merge

- Per-activity: `totalScore = Σ (source.score × source.weight)` across all sources
- All activity codes from ANY source are considered (union, not max)
- Confidence = `max(source.confidence)` across sources

### Layer 3 — Selection

- Sort by totalScore descending, take top-N (default: 20)
- Each candidate carries: `score`, `sources[]`, `contributions{}`, `provenance[]`, `primarySource`, `confidence`

## Provenance

Each selected activity includes:
- `contributions`: numeric breakdown by source (blueprint, impactMap, understanding, keyword, projectContext)
- `sources[]`: all CandidateSource values that contributed
- `provenance[]`: human-readable trace strings
- `primarySource`: highest contributing source

## Depends on

- [[Estimation Blueprint]] — primary signal source (weight=3.0, highest)
- [[Impact Map]] — secondary signal source (weight=2.0)
- [[Requirement Understanding]] — tertiary signal source (weight=1.5)

## Produced by

- **Function**: `buildCandidateSet(input)` → `netlify/functions/lib/candidate-builder.ts`
- **Callers**:
  - `ai-requirement-interview.ts` — during round 0/1
  - `ai-estimate-from-interview.ts` — during estimate generation
- **Returns**: `CandidateSetResult` with scored candidates + provenance
- **Persistence**: `candidate_sets` table (JSONB candidates, FKs to analysis + impact_map)

## Consumed by

- [[Interview Flow]] — round 1 uses `buildCandidateSet()` for activity selection
- [[Estimation Decision]] — user selects from candidates
- `save-orchestrator.ts` — wraps for domain orchestration

## Persistence

- Table: `candidate_sets` (JSONB candidates, FKs to analysis + impact_map)
- Migration: `supabase/migrations/20260321_domain_model_tables.sql`
- See [[Data Model/Schema]]

## Data shape

See `src/types/domain-model.ts` — `CandidateActivity`, `ScoredCandidate`

## Represented in code

- `netlify/functions/lib/candidate-builder.ts` — 3-layer builder
- `netlify/functions/lib/blueprint-activity-mapper.ts` — blueprint signal extractor
- `netlify/functions/lib/impact-map-signal-extractor.ts` — impact map signal extractor
- `netlify/functions/lib/understanding-signal-extractor.ts` — understanding signal extractor
- `src/types/domain-model.ts` — CandidateActivity, CandidateSetRow types

## Stability

Medium

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `netlify/functions/lib/candidate-builder.ts` — 3-layer architecture, WEIGHTS object (blueprint=3.0, impactMap=2.0, understanding=1.5, keyword=1.0, projectContext=0.5), mergeScores function, selectCandidates function
  - `netlify/functions/lib/blueprint-activity-mapper.ts` — LAYER_TECH_PATTERNS deterministic lookup
  - `netlify/functions/lib/impact-map-signal-extractor.ts` — extractImpactMapSignals
  - `netlify/functions/lib/understanding-signal-extractor.ts` — extractUnderstandingSignals
- **corrections applied**:
  - Blueprint weight was missing → added (3.0, confirmed in WEIGHTS constant)
  - Scoring formula was described as "max + bonus" → corrected to weighted sum (bpContrib + imContrib + unContrib + kwContrib as per mergeScores)
  - Added projectContext as 5th signal source (weight=0.5, confirmed in WEIGHTS)
  - Added signal extractor file paths (all 3 exist)
