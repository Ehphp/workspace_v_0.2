# No Documentation Update Needed

**Change**: Fix stale React state bug in `useRequirementInterview` hook and `WizardStepInterview` component.

**Justification**: This is a pure frontend bug fix. `generateQuestions()` now returns response data directly (instead of just `boolean`) so the calling component reads the planner decision from the return value rather than from stale React state. No API contracts, estimation formulas, data models, or AI behavior changed.
