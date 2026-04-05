# Estimation Decision

User decision artifact in the [[Estimation Pipeline]]. Records the user's final selection of activities, drivers, and risks — creating an audit trail.

## Type

Domain Artifact

## Role

Captures the human decision that links the [[Candidate Set]] to the deterministic [[Engine]] calculation. Provides traceability from estimation result back to decision rationale.

## Shape

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| candidate_set_id | FK | Link to source [[Candidate Set]] |
| selected_activity_ids | uuid[] | Activities chosen by user |
| excluded_activity_ids | uuid[] | Activities explicitly excluded by user |
| driver_values | JSONB | `{ driver_id, selected_value }[]` |
| risk_ids | uuid[] | Selected risk factors |
| warnings | string[] | Quality/coverage warnings from candidate builder |
| assumptions | string[] | Assumptions recorded at decision time |
| decision_confidence | number \| null | User's confidence in the decision |
| created_by | uuid | User who made the decision |
| created_at | timestamp | When the decision was made |

## Depends on

- [[Candidate Set]] — provides the candidates to select from
- [[Interview Flow]] — round 1 suggests activities, drivers, risks

## Produced by

- **Function**: `createEstimationDecision()` → `netlify/functions/lib/domain/estimation/decision.service.ts`
- **Caller**: `save-orchestrator.ts` → `orchestrateWizardDomainSave()`
- **Input**: Selected activity IDs + excluded IDs + driver values + risk IDs
- **Persistence**: `estimation_decisions` table

## Consumed by

- [[Engine]] — consumes the decision as input for calculation
- `estimations.decision_id` FK — links estimation result to this decision
- `estimation_snapshots` — immutable audit record

## Persistence

- Table: `estimation_decisions`
- Migration: `supabase/migrations/20260321_domain_model_tables.sql`
- See [[Data Model/Schema]]

## Data shape

See `src/types/domain-model.ts` — `EstimationDecisionRow`, `CreateEstimationDecisionInput`

## Represented in code

- `src/types/domain-model.ts` — EstimationDecisionRow, CreateEstimationDecisionInput
- `netlify/functions/lib/domain/estimation/decision.service.ts` — createEstimationDecision
- `netlify/functions/lib/domain/estimation/save-orchestrator.ts` — caller

## Stability

Medium

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/types/domain-model.ts` — EstimationDecisionRow interface (all fields verified)
- **corrections applied**:
  - Added missing fields: `excluded_activity_ids`, `warnings`, `assumptions`, `decision_confidence`, `created_by`, `created_at`
  - `driver_values` was described as generic JSONB → corrected to `{ driver_id, selected_value }[]`
