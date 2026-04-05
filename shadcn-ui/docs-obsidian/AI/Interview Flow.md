# Interview Flow

2-round AI interview strategy within the [[Estimation Pipeline]]. Bridges the AI-generated artifacts to user-validated activity selection.

## Type

Domain Flow

## Round 0 — Information-Gain Planner

**Endpoint**: `ai-requirement-interview` (see [[AI/Endpoints]])

**Input**: requirement description + all available artifacts ([[Requirement Understanding]], [[Impact Map]], [[Estimation Blueprint]])

**Decision logic**:
- If AI confidence ≥ 0.90 AND estimated range ≤ 16h → **SKIP** (no questions needed)
- Otherwise → **ASK** (1–3 targeted questions)

**Output**:
- `preEstimate` (minHours, maxHours, confidence)
- `questions[]` (if ASK decision)
- `estimatedComplexity`
- `suggestedActivities`

## Round 1 — Activity Selection

**Endpoint**: `ai-estimate-from-interview` (see [[AI/Endpoints]])

**Input**: description + user answers + artifacts

**Process**: Uses [[Candidate Set]] builder (3-layer signal extraction) to select activities

**Output**:
- `selectedActivities[]` with provenance per activity
- `suggestedDrivers`, `suggestedRisks`
- `aiAnalysis` text
- `confidenceScore`

The user then reviews suggestions and makes final selection → [[Estimation Decision]].

## Produced by

- **Round 0 Endpoint**: `ai-requirement-interview` — ASK/SKIP decision + question generation
- **Round 1 Endpoint**: `ai-estimate-from-interview` — activity selection via [[Candidate Set]]
- **UI**: `WizardStepInterview.tsx` — manages both rounds
- **API helpers**: `generateInterviewQuestions()`, `generateEstimateFromInterview()` in `src/lib/requirement-interview-api.ts`
- **State hook**: `useRequirementInterview.ts`

## Consumed by

- [[Candidate Set]] — built during round 1
- [[Estimation Decision]] — user selects from interview suggestions
- [[Wizard Flow]] step 4 — interview UI

## Depends on

- [[Requirement Understanding]] — context for questions
- [[Impact Map]] — context for questions
- [[Estimation Blueprint]] — primary signal source for [[Candidate Set]]

## Constraints

- Uses gpt-4o (more capable model) vs gpt-4o-mini for artifacts
- Italian-language prompts for determinism
- See [[Architecture/Constraints]]

## Represented in code

- `netlify/functions/ai-requirement-interview.ts`
- `netlify/functions/ai-estimate-from-interview.ts`
- `netlify/functions/lib/ai/prompts/interview-planner.ts`
- `netlify/functions/lib/ai/prompts/estimate-from-interview.ts`
- `src/components/requirements/wizard/WizardStepInterview.tsx`
- `src/lib/requirement-interview-api.ts`
- `src/hooks/useRequirementInterview.ts`

## Stability

Medium

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `netlify/functions/ai-requirement-interview.ts` — SKIP_CONFIDENCE_THRESHOLD = 0.90 (line 50), SKIP_MAX_RANGE_HOURS = 16 (line 54), model: gpt-4o (line 622), ASK/SKIP decision logic (line 123-126)
  - `netlify/functions/ai-estimate-from-interview.ts` — model: gpt-4o (AI_MODEL default, line 47)
- **notes**:
  - Additional SKIP condition exists: RAG_AUTO_SKIP_SIMILARITY = 0.85 (force SKIP on very close historical match) — not documented in original note
  - Thresholds are configurable via env vars: `AI_INTERVIEW_SKIP_CONFIDENCE`, `AI_INTERVIEW_SKIP_RANGE`, `AI_INTERVIEW_RAG_SKIP_SIMILARITY`
