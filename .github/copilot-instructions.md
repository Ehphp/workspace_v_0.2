# Syntero Repo Policy: Docs are mandatory
You are working inside the Syntero repository.

Task:
Do a repo-aware discovery for implementing Milestone 1 of the new estimation architecture: Requirement Understanding.

IMPORTANT:
Do not write code yet.
Do not modify files yet.
Do not implement anything yet.

Goal:
Produce a precise, file-by-file implementation plan for adding a new Requirement Understanding artifact into the current Syntero requirement estimation flow.

Context:
Syntero already has:
- a multi-step requirement wizard
- raw requirement description entry
- optional AI normalization
- AI interview and estimation flow
- deterministic estimation engine
- Supabase persistence for requirements and estimations
- structured AI outputs in several modules
- consultant analysis / AI review patterns
- existing API and Netlify function patterns

This milestone must introduce:
- a new structured AI artifact called Requirement Understanding
- a new persistence path for this artifact
- a new wizard review step
- backward compatibility with the current estimation flow

You must inspect the current codebase and identify the exact insertion points.

Inspect at least these likely areas:
- src/components/requirements/RequirementWizard.tsx
- src/components/requirements/wizard/WizardStep1.tsx
- src/components/requirements/wizard/WizardStep2.tsx
- src/components/requirements/wizard/WizardStepInterview.tsx
- src/hooks/useWizardState.ts
- src/lib/api.ts
- src/lib/requirement-interview-api.ts
- src/types/requirement-interview.ts
- src/types/database.ts
- netlify/functions/ai-requirement-interview.ts
- netlify/functions/ai-estimate-from-interview.ts
- netlify/functions/ai-suggest.ts
- netlify/functions/lib/handler/create-ai-handler.ts
- netlify/functions/lib/ai/actions/*
- netlify/functions/lib/ai/prompts/*
- relevant Supabase migrations and current schema patterns

Required output:
1. Current end-to-end flow map for the requirement wizard
2. Exact files to create
3. Exact files to update
4. Proposed new data artifact shape
5. Proposed persistence strategy
6. Proposed minimal-risk rollout plan
7. Risks and compatibility concerns
8. Recommendation for the next implementation prompt

Constraints:
- no code changes
- no speculative redesign
- no future phases beyond Requirement Understanding
- keep current wizard and estimation flow intact

Output must be concrete and repo-aware.

When you modify code, you must update canonical documentation under:
- shadcn-ui/docs/

Use this impact guide:
- shadcn-ui/netlify/functions/** -> shadcn-ui/docs/api/ai-endpoints.md (+ shadcn-ui/docs/ai-integration.md if behavior changes)
- shadcn-ui/src/lib/**estimation** -> shadcn-ui/docs/estimation-engine.md
- supabase schema/seed/migrations (*.sql, shadcn-ui/supabase/**) -> shadcn-ui/docs/data-model.md (+ shadcn-ui/docs/data/integrity-playbook.md if presets/activities impacted)
- interview/preset wizard UI or APIs -> shadcn-ui/docs/api/ai-endpoints.md and/or shadcn-ui/docs/ai-integration.md

If you believe no docs are needed, add:
- shadcn-ui/docs/NO_DOCS_NEEDED.md
with a short justification.

Do not edit shadcn-ui/docs/archive/ as part of normal updates (archive is historical only).
