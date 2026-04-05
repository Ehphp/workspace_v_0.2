# Estimation Pipeline

End-to-end flow that transforms a raw requirement description into a deterministic estimation.

## Type

Domain Flow

## Pipeline Steps

```
Requirement Input
    ↓
Validation Gate (gpt-4o-mini)
    ↓
[[Requirement Understanding]] (gpt-4o-mini)
    ↓
[[Impact Map]] (gpt-4o-mini)
    ↓
[[Estimation Blueprint]] (gpt-4o-mini)
    ↓
[[Interview Flow]] (gpt-4o, 2-round)
    ↓  includes [[Candidate Set]] building
[[Estimation Decision]] (user selection)
    ↓
[[Engine]] (deterministic calculation)
    ↓
Results + Save
```

## Orchestration

The pipeline is orchestrated by the [[Wizard Flow]] — each wizard step corresponds to one pipeline stage.

## Produced by

- **Orchestrator**: [[Wizard Flow]] — each wizard step maps to one pipeline stage
- **State**: `useWizardState.ts` hook manages `WizardData` across all steps

## Consumed by

- [[Requirement Understanding]], [[Impact Map]], [[Estimation Blueprint]] — generated at pipeline stages
- [[Candidate Set]] — merges all artifact signals
- [[Estimation Decision]] — user selection
- [[Engine]] — deterministic calculation
- Final result persisted to `estimations` table

## Constraints

- All artifact steps are optional — the pipeline degrades gracefully if skipped
- [[Candidate Set]] merges signals from all available artifacts with provenance tracking
- [[Engine]] is fully deterministic — same inputs always produce same outputs

See also: [[Architecture/Constraints]]

## Represented in code

- `src/components/requirements/RequirementWizard.tsx` — UI orchestrator
- `src/hooks/useWizardState.ts` — state management across steps

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/components/requirements/RequirementWizard.tsx` — steps array confirms: WizardStep1 → WizardStepUnderstanding → WizardStepImpactMap → WizardStepBlueprint → WizardStepInterview → WizardStep4 → WizardStep5 (lines 84-91)
  - Models confirmed via endpoint files (gpt-4o-mini for artifacts, gpt-4o for interview)
  - Validation gate confirmed via `ai-validate-requirement.ts`
