# Wizard Flow

UI orchestrator for the [[Estimation Pipeline]]. Guides the user through each pipeline stage as a multi-step wizard.

## Type

Domain Flow

## Steps

The wizard uses a 0-indexed array of 7 steps (displayed as "Step 1/7" to "Step 7/7"):

| Index | Title | Component | Artifact |
|---|---|---|---|
| 0 | Requirement | `WizardStep1.tsx` | — (validation gate) |
| 1 | Understanding | `WizardStepUnderstanding.tsx` | [[Requirement Understanding]] |
| 2 | Impact Map | `WizardStepImpactMap.tsx` | [[Impact Map]] |
| 3 | Blueprint | `WizardStepBlueprint.tsx` | [[Estimation Blueprint]] |
| 4 | Technical Interview | `WizardStepInterview.tsx` | [[Candidate Set]] via [[Interview Flow]] |
| 5 | Drivers & Risks | `WizardStep4.tsx` | [[Estimation Decision]] |
| 6 | Results | `WizardStep5.tsx` | [[Engine]] output |

> Note: `WizardStep3.tsx` exists but is **legacy** (manual activity selection) — NOT imported by RequirementWizard.

## Behavior

- Each artifact step (3–5) allows the user to review, confirm, or regenerate
- Step 6 may be skipped automatically if AI confidence is high enough (≥0.90 + range ≤16h)
- All artifact steps are optional — see [[Architecture/Constraints]]
- State is managed by `useWizardState.ts` hook (`WizardData` type)

## Endpoints Used

- Step 1: [[AI/Endpoints]] — `ai-validate-requirement`
- Step 3: [[AI/Endpoints]] — `ai-requirement-understanding`
- Step 4: [[AI/Endpoints]] — `ai-impact-map`
- Step 5: [[AI/Endpoints]] — `ai-estimation-blueprint`
- Step 6: [[AI/Endpoints]] — `ai-requirement-interview` + `ai-estimate-from-interview`

## Produced by

- **Root**: `RequirementWizard.tsx` — renders steps array
- **State**: `useWizardState.ts` — manages `WizardData` (description + all artifacts + interview answers)

## Consumed by

- [[Estimation Pipeline]] — wizard is the pipeline's UI layer
- Each step component consumes/produces its corresponding artifact
- Save chain: `createRequirement()` → artifact saves → `orchestrateWizardDomainSave()` → `saveEstimation()`

## Represented in code

- `src/components/requirements/RequirementWizard.tsx`
- `src/hooks/useWizardState.ts`
- `src/lib/domain-save.ts` — orchestrateWizardDomainSave

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `src/components/requirements/RequirementWizard.tsx` — steps array (lines 84-91), imports (lines 3-9), currentStep state (line 48)
- **corrections applied**:
  - Step numbering was wrong (1,3,4,5,6,7,8) → corrected to 0-indexed [0-6], matching actual `steps[]` array
  - Total steps was "7 steps" but numbered 1-8 → corrected to exactly 7 steps
  - `WizardStep3.tsx` is legacy, not imported by RequirementWizard — noted
