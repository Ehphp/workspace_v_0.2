# Syntero Architectural Audit

**Date**: 2026-03-11  
**Scope**: Full-stack architecture — wizard, AI pipeline, estimation engine, persistence, technology model  
**Method**: Code-level trace of every file in the critical path; schema analysis of all migrations; runtime behavior analysis from server logs

---

## 1. Executive Summary

Syntero is a **multi-step AI-assisted estimation system** that guides users from requirement description to a final effort estimate in days. The system works, is backward-compatible, and has zero compile errors. However, the architecture contains **three structural disconnections** that limit the value of recent AI artifact investments (Milestone 1: Requirement Understanding, Milestone 2: Impact Map):

| # | Disconnection | Severity |
|---|---|---|
| **S1** | AI artifacts (Understanding, Impact Map) **do not structurally influence** the final numeric estimate — they are prompt text only | **High** |
| **S2** | Technology model is **partially migrated** — `supabase_schema.sql` still has `tech_preset_id` columns; migration `20260228` renamed them to `technology_id`, but runtime code sends both names and backend ignores `techPresetId` entirely in AI endpoints | **Medium** |
| **S3** | Estimation records have **no foreign key** to the Understanding or Impact Map that informed them — there is no audit trail linking artifacts to estimation output | **Medium** |

The system's **real estimation formula** is:

$$\text{totalDays} = (\text{baseDays} \times \text{driverMultiplier}) \times (1 + \text{contingency\%})$$

Where `baseDays = Σ(activity.base_hours) / 8`, `driverMultiplier = Π(driver.multiplier)`, and `contingency%` is a step function of `riskScore = Σ(risk.weight)`.

Every input to this formula comes from **activity/driver/risk selections** — never from Understanding or Impact Map artifacts. The artifacts influence the AI's _reasoning_ about _which_ activities to propose, but this influence is soft (prompt injection) not structural (validated coverage).

---

## 2. Current Architecture

### 2.1 Wizard Flow (7 Steps)

| Step | Component | Input | Output stored in WizardData |
|---|---|---|---|
| 0 | `WizardStep1.tsx` | Description, priority, state, owner | `description`, `priority`, `state`, `business_owner` |
| 1 | `WizardStep2.tsx` | Technology selection | `techPresetId` (UUID from `technologies.id`), `techCategory` (code string) |
| 2 | `WizardStepUnderstanding.tsx` | AI-generated understanding | `requirementUnderstanding`, `requirementUnderstandingConfirmed` |
| 3 | `WizardStepImpactMap.tsx` | AI-generated impact map | `impactMap`, `impactMapConfirmed` |
| 4 | `WizardStepInterview.tsx` | AI interview → estimation | `interviewQuestions`, `interviewAnswers`, `activityBreakdown`, `aiSuggestedActivityCodes`, `selectedActivityCodes`, `suggestedDrivers`, `confidenceScore`, `title` |
| 5 | `WizardStep4.tsx` | Driver/risk tuning | `selectedDriverValues`, `selectedRiskCodes` |
| 6 | `WizardStep5.tsx` | Review + save | triggers `handleSave()` |

**State persistence**: All fields stored in `localStorage` under key `ESTIMATION_WIZARD_DATA` via `useWizardState.ts`. No server-side draft persistence.

**Create-only design**: The wizard is for new requirements only. Editing happens on the `RequirementDetail` page via separate tabs.

### 2.2 AI Pipeline (Two Rounds + Optional Reflection)

**Round 0 — Information-Gain Planner** (`ai-requirement-interview.ts`):
1. Fetch activities by `techCategory` (string match)
2. Rank top 20 by keyword overlap with description (`selectTopActivities`)
3. RAG: search similar historical requirements
4. LLM call (gpt-4o-mini): pre-estimate + ASK/SKIP decision + 1–3 questions
5. Return: `{decision, preEstimate, questions[], reasoning, suggestedActivities[]}`

**Round 1 — Estimation** (`ai-estimate-from-interview.ts`):
1. Fetch + rank activities (same method)
2. Build prompt: description + answers + Understanding block (optional) + Impact Map block (optional)
3. Linear path (single LLM call) or Agentic path (DRAFT→REFLECT→REFINE→VALIDATE)
4. Return: `{generatedTitle, activities[], totalBaseDays, reasoning, suggestedDrivers[], suggestedRisks[]}`

**Agentic Pipeline** (`agent-orchestrator.ts`, when `AI_AGENTIC=true`):
- Tool-use: `search_catalog`, `query_history`, `validate_estimation`, `get_activity_details`
- Reflection pass: consultant persona reviews coverage/proportionality/coherence
- Max 2 refinement iterations

### 2.3 Deterministic Engine

**File**: `src/lib/sdk/EstimationEngine.ts`

**Inputs**: `{activities: SelectedActivity[], drivers: SelectedDriver[], risks: SelectedRisk[]}`

The engine has **zero knowledge** of requirements, descriptions, understanding artifacts, impact maps, or AI reasoning. It is a pure numeric calculator.

### 2.4 Persistence (Save Path)

`RequirementWizard.handleSave()` persists to **4 tables** in sequence:

1. `requirements` — requirement record with `technology_id`
2. `requirement_understanding` — JSONB artifact (if `requirementUnderstandingConfirmed`)
3. `impact_map` — JSONB artifact (if `impactMapConfirmed`)
4. `estimations` + junction tables (`estimation_activities`, `estimation_drivers`, `estimation_risks`)

**Critical gap**: Step 4 has no FK reference to steps 2 or 3. The estimation row does not record _which version_ of the Understanding or Impact Map was active when it was produced.

### 2.5 Data Discarded at Save

The following WizardData fields are **never persisted**:

| Field | Description | Lost information |
|---|---|---|
| `normalizationResult` | AI-normalized description | Original AI rewrite |
| `interviewQuestions` | Questions generated by Round 0 | Which questions were asked |
| `interviewAnswers` | User answers to interview | Raw interview data |
| `projectContext` | Additional context | Context enrichment |
| `activityBreakdown` | AI reasoning per activity | Justification per selection |
| `preEstimate` | Round 0 pre-estimate | Initial estimate before interview |
| `plannerDecision` | ASK/SKIP decision | Whether interview was skipped |

This means **no post-hoc audit** can determine why specific activities were chosen.

---

## 3. Historical Legacy Layer

The codebase shows a clear migration story from **technology_presets** (template-based) to **technologies** (catalog-based):

### 3.1 Migration Timeline

| Migration | Date | Change |
|---|---|---|
| `supabase_schema.sql` | Original | `technology_presets` table with `default_driver_values`, `default_risks`, `default_activity_codes` (JSONB templates) |
| `supabase_technologies.sql` | Pre-migration | Created separate `technologies` table. Added TEXT FK: `activities.tech_category → technologies.code` |
| `20260228_simplify_presets_to_technologies.sql` | 2026-02-28 | **Renamed** `technology_presets` → `technologies`. Dropped template columns. Consolidated 9 preset rows into 3 technology rows. Renamed `tech_preset_id` → `technology_id` in `lists` and `requirements` |
| `20260301_canonical_technology_model.sql` | 2026-03-01 | Added `activities.technology_id` UUID FK. Backfilled from `tech_category` string. Created sync trigger |

### 3.2 Ghost Artifacts Still Present

| Location | Legacy artifact | Status |
|---|---|---|
| `supabase_schema.sql` | `technology_presets` table name, `tech_preset_id` columns | **Not updated** — the base schema file still uses old names |
| `supabase_seed.sql` | Seeds reference `technology_presets` | **Not updated** |
| `src/types/database.ts` | `TechnologyPreset` type alias, `tech_preset_id?` deprecated fields | Deprecated but present |
| `src/lib/api.ts` `CreateRequirementInput` | Both `tech_preset_id` and `technology_id` accepted | Dual-path (sends both) |
| `src/hooks/useWizardState.ts` | `techPresetId` field name | **Misleading**: actually holds `technologies.id`, not a preset ID |
| Backend endpoints | `techPresetId` in `RequestBody` interfaces | Accepted but **never used** |
| `netlify/functions/lib/activities.ts` | `techPresetId` parameter | Accepted but **never queried** |

### 3.3 Key Insight: The Preset→Technology Migration is Complete in DB, Incomplete in Code

The database migration renamed everything correctly. But the application code still:
- Uses the name `techPresetId` for what is actually `technology.id`
- Sends `techPresetId` to AI endpoints that ignore it
- Maintains a `@deprecated` type alias `TechnologyPreset`
- Has `supabase_schema.sql` (the "source of truth") using the old names

---

## 4. Architectural Inconsistencies

### I1: Naming Mismatch — `techPresetId` is a `technology.id`

**What user selects**: A `Technology` record from the `technologies` table.  
**What WizardData calls it**: `techPresetId`.  
**What the DB column is named** (post-migration): `technology_id`.  
**What TypeScript types say**: `Activity.technology_id` is "canonical FK" but DB column `activities.technology_id` was only added in migration `20260301`.

**Impact**: Confusing for developers. No runtime bug, but maintenance risk.

### I2: Dual FK Pattern — TEXT vs UUID

Activities link to technologies via **two columns**:
- `tech_category` (TEXT) — matches `technologies.code` via TEXT FK
- `technology_id` (UUID) — matches `technologies.id` via UUID FK

Both are kept in sync by trigger `sync_activity_tech_category()`. However:
- Backend activity fetching (`fetchActivitiesServerSide`) queries **only** `tech_category` (string)
- The `technology_id` UUID column is never queried by any runtime code

### I3: Persisted Tech Category is TEXT, Not FK

Both `requirement_understanding` and `impact_map` tables store:
```sql
input_tech_category TEXT  -- plain string, no FK
```
No `technology_id` column exists on these artifact tables. If a technology code is renamed, these records become orphans.

### I4: Base Schema vs Migrations Divergence

`supabase_schema.sql` represents the **original** schema with `technology_presets` and `tech_preset_id`. Applying all migrations transforms it into the current state. But reading `supabase_schema.sql` alone gives a **misleading picture** of the current database.

---

## 5. Technology Model Issues

### T1: `fetchActivitiesServerSide` — techPresetId Is Dead Code

```
File: netlify/functions/lib/activities.ts
Signature: fetchActivitiesServerSide(techCategory: string, techPresetId: string, ...)
Actual query: .or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`)
```

The `techPresetId` parameter is **never referenced** in the function body. All activity filtering is done purely by `tech_category` string match.

**Risk**: Developers may assume `techPresetId` is being used for preset-specific activity filtering. It is not.

### T2: technology_preset_activities Pivot is Unused at Runtime

The `technology_activities` pivot table (renamed from `technology_preset_activities`) with per-technology overrides (`name_override`, `description_override`, `base_hours_override`) exists in the database but:
- `WizardStep2.tsx` queries it **only for display** (activity count badge)
- `fetchActivitiesServerSide` queries the `activities` table directly, **never joining** `technology_activities`
- No AI endpoint uses preset-specific overrides

**Impact**: The entire per-technology override system (hours, names, descriptions) defined in the pivot table is **never applied to estimations**.

### T3: Four Technology Rows, Not Three

The `technologies` table has 4 rows: `POWER_PLATFORM`, `BACKEND`, `FRONTEND`, `MULTI`. The migration comment says "collapse 9 presets into 3 technologies" but `MULTI` was added separately (in `20260301_canonical_technology_model.sql`). MULTI acts as a cross-cutting category for shared activities.

### T4: No Technology-Specific Behavior Beyond Activity Filtering

Technology selection affects exactly ONE thing: which activities are included in the prompt's catalog (`tech_category = X OR tech_category = MULTI`). There is no technology-specific:
- Driver weighting
- Risk scoring
- Estimation formula variant
- Confidence threshold
- Interview question pool

The tech-specific prompts in Round 0 (`TECH_SPECIFIC_PROMPTS`) add flavor text but no structural constraints.

---

## 6. AI Workflow Analysis

### A1: Understanding and Impact Map Are Prompt-Injected, Not Structurally Enforced

Both artifacts are formatted as markdown blocks and appended to the estimation prompt:

```
REQUISITO:
{description}
{projectContextSection}
{formatUnderstandingBlock(body.requirementUnderstanding)}   ← Text block
{formatImpactMapBlock(body.impactMap)}                      ← Text block
RISPOSTE INTERVIEW TECNICA:
{interviewAnswers}
```

The AI model may or may not use this information. There is no:
- Validation that selected activities cover all Impact Map layers
- Check that Understanding `functionalPerimeter` maps to activity groups
- Score penalization if an Impact Map layer has no corresponding activity

### A2: Activity Selection is Keyword-Based, Not Layer-Based

`selectTopActivities()` ranks activities by **word overlap** between the description+answers text and the activity's `code + name + description + group`. MULTI-category activities get a +0.5 bonus.

The Impact Map's layer structure (`frontend`, `logic`, `data`, `integration`, etc.) is **never referenced** in the ranking algorithm. A perfectly detailed Impact Map has zero effect on which activities are presented to the LLM.

### A3: Confidence Scores are Independent

Three separate confidence scores exist with no connection:
- `RequirementUnderstanding.confidence` (0.6–1.0) — AI self-assessment of understanding quality
- `ImpactMap.overallConfidence` (0.5–1.0) — AI self-assessment of impact analysis quality
- `Estimation.confidenceScore` (0.0–1.0) — based on answer completeness, not artifact quality

These scores are never combined, compared, or used to gate estimation quality.

### A4: Both Artifacts Are Optional — Estimation Proceeds Without Them

If `requirementUnderstanding` or `impactMap` is `undefined`, the `formatUnderstandingBlock` / `formatImpactMapBlock` functions return empty strings. No warning, no quality degradation flag, no different estimation path.

### A5: No Traceability from AI Output Back to Artifacts

The AI estimation response includes:
```json
{
  "activities": [{ "code": "...", "reason": "...", "fromQuestionId": "..." }],
  "suggestedDrivers": [{ "code": "...", "reason": "...", "fromQuestionId": "..." }]
}
```

The `fromQuestionId` links to interview questions, but there is no `fromUnderstanding` or `fromImpactMap` attribution. Post-hoc, it's impossible to determine which activities were influenced by the artifacts.

---

## 7. Data Model Issues

### D1: No Artifact-to-Estimation Link

```
requirement_understanding.id  ──(no FK)──>  estimations
impact_map.id                  ──(no FK)──>  estimations
```

The `estimations` table has `requirement_id` but no `understanding_version` or `impact_map_version`. If a requirement has multiple understanding versions, there is no way to know which version was active during estimation.

### D2: Artifact Tables Use Nullable requirement_id

Both `requirement_understanding` and `impact_map` have:
```sql
requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE  -- nullable
```

This allows artifacts to be generated before the requirement is saved (wizard flow). However, it also means orphan artifact records can exist with `requirement_id = NULL` if the wizard is abandoned.

### D3: `has_requirement_understanding` is Metadata, Not a Link

The `impact_map` table has:
```sql
has_requirement_understanding BOOLEAN DEFAULT FALSE
```

This records whether an Understanding existed when the Impact Map was generated, but it does not link to a specific understanding record. If the understanding is later regenerated, this boolean becomes stale.

### D4: estimations.ai_reasoning is Unstructured

The `ai_reasoning` column stores the full AI text reasoning as a plain `TEXT` field. There is no structured breakdown by phase (understanding → impact → activity selection → estimation).

### D5: Interview Data is Lost

Interview questions, user answers, pre-estimate, planner decision (ASK/SKIP), and per-activity reasoning are **never persisted** to any database table. They exist only in `localStorage` during the wizard session and are discarded on save.

### D6: Base Schema File is Stale

`supabase_schema.sql` defines `technology_presets`, `tech_preset_id` columns, and `technology_preset_activities`. The actual database state (after 29 migrations) has different table names, column names, and additional tables. This file is misleading as a schema reference.

---

## 8. Structural Risks

### R1: Silent Degradation Risk

If the Understanding or Impact Map AI calls fail during the wizard, the user can skip/confirm empty artifacts. The estimation proceeds identically with or without artifacts. There is no quality gate or warning that says "estimation produced without understanding analysis."

**Impact**: Users may believe the estimation is AI-enhanced when it's running in degraded mode.

### R2: localStorage-only State is Fragile

All wizard state is in `localStorage`. If the user clears browser data, opens a different browser, or hits a browser storage limit, the entire wizard state is lost. There is no server-side draft.

### R3: Activity Keyword Matching is Brittle

`selectTopActivities()` uses simple word overlap. Italian/English mixing in the description vs activity names can cause poor matches. The algorithm has no semantic understanding — "autenticazione utenti" may not match "AUTH_LOGIN" if the activity name uses English abbreviations.

### R4: Estimation Drift Goes Undetected

If the activities catalog changes (base_hours updated, activities deactivated), past estimations reference the old values through `estimation_activities.activity_id`. Reopening an estimation shows current base_hours, not the historical value. There is no snapshot of the activity catalog state at estimation time.

### R5: Orphan Artifacts Accumulate

Every wizard session that generates an Understanding or Impact Map but is abandoned (user closes tab) potentially leaves orphan records with `requirement_id = NULL` in the artifact tables. No cleanup mechanism exists.

### R6: No Concurrency Control on Artifact Versions

Both artifact tables use `version INTEGER` incremented client-side:
```typescript
version = existing[0].version + 1;
```

If two concurrent sessions save for the same requirement, both may compute `version = 2` and create duplicates (the UNIQUE constraint is only on `requirement_id` + auto-UUID, not on `requirement_id` + `version`).

---

## 9. Target Architecture

Based on the analysis, the clean target architecture resolves the three structural disconnections (S1–S3) while preserving the working estimation engine:

### 9.1 Artifact → Estimation Structural Link

```
estimations
  ├─ requirement_id UUID FK → requirements.id           (existing)
  ├─ understanding_id UUID FK → requirement_understanding.id  (NEW)
  └─ impact_map_id UUID FK → impact_map.id                    (NEW)
```

This allows exact replay: given an estimation, you can retrieve the exact artifacts that informed it.

### 9.2 Layer Coverage Validation (Post-Estimation Check)

After the AI selects activities, a **non-blocking validation** step checks:
- For each Impact Map layer (`frontend`, `logic`, `data`, `integration`, etc.)
- Are there selected activities whose `group` or `tech_category` covers this layer?
- Report uncovered layers as a warning (not a gate)

This would be a metadata field on the estimation, not a modification to the deterministic engine.

### 9.3 Unified Technology Model

- Remove `tech_category` TEXT column from `activities` (after full migration to `technology_id` UUID)
- Remove `techPresetId` parameter name from all frontend and backend code → rename to `technologyId`
- Update `supabase_schema.sql` to reflect post-migration state (single source of truth)
- Remove `@deprecated` type aliases

### 9.4 Interview Data Persistence

New table:
```
estimation_interview
  ├─ estimation_id UUID FK → estimations.id
  ├─ questions JSONB       (full question set)
  ├─ answers JSONB         (user answers)
  ├─ pre_estimate JSONB    (Round 0 output)
  ├─ planner_decision TEXT (ASK/SKIP)
  └─ created_at TIMESTAMP
```

This enables post-hoc analysis of why activities were selected.

### 9.5 Structured AI Reasoning

Replace `estimations.ai_reasoning TEXT` with:
```
estimations.ai_reasoning JSONB
  ├─ rawText: string           (existing text for backward compatibility)
  ├─ activityReasons: [{code, reason, source}]
  ├─ driverReasons: [{code, reason}]
  ├─ riskReasons: [{code, reason}]
  ├─ artifactInfluence: {understandingUsed: boolean, impactMapUsed: boolean}
  └─ layerCoverage: [{layer, coveredByActivities: string[], gap: boolean}]
```

---

## 10. Priority Refactoring Roadmap

### Phase 1: Low-Risk Cleanup (No Behavioral Change)

| # | Task | Files | Risk |
|---|---|---|---|
| 1.1 | Rename `techPresetId` → `technologyId` across frontend + backend types | ~15 files | Low — mechanical rename |
| 1.2 | Remove dead `techPresetId` parameter from `fetchActivitiesServerSide` | 1 file | None — parameter already unused |
| 1.3 | Update `supabase_schema.sql` to reflect current post-migration state | 1 file | None — documentation only |
| 1.4 | Remove `@deprecated` type aliases (`TechnologyPreset`, `tech_preset_id` fields) | 2 files | Low — find all usages first |

### Phase 2: Artifact-Estimation Link (Schema Extension)

| # | Task | Files | Risk |
|---|---|---|---|
| 2.1 | Add `understanding_id` and `impact_map_id` nullable FK columns to `estimations` | 1 migration | Low — nullable, backward compatible |
| 2.2 | Populate FKs during `handleSave()` after artifacts are persisted | 1 file (`RequirementWizard.tsx`) + `api.ts` | Low — both artifacts saved before estimation |
| 2.3 | Add `estimation_interview` table for interview persistence | 1 migration + `api.ts` | Low — new table, no existing changes |

### Phase 3: Layer Coverage Analysis (New Capability)

| # | Task | Files | Risk |
|---|---|---|---|
| 3.1 | Define layer↔activity group mapping | New mapping file | Medium — requires domain modeling |
| 3.2 | Post-estimation coverage check in `WizardStep5.tsx` | 1 component | Low — display only |
| 3.3 | Add `layer_coverage` metadata to `estimations.ai_reasoning` JSONB | Backend estimation endpoint | Medium — must not break existing parsing |

### Phase 4: Structured Reasoning (AI Output Enhancement)

| # | Task | Files | Risk |
|---|---|---|---|
| 4.1 | Extend estimation response schema to include `fromArtifact` field per activity | Prompt + Zod schema | Medium — LLM output format change |
| 4.2 | Migrate `ai_reasoning` from TEXT to JSONB with backward-compatible reader | Migration + `api.ts` | Medium — must handle both formats |

---

## Appendix A: File-Level Summary

### Tables Affected

| Table | Current State | Target State |
|---|---|---|
| `technologies` | ✅ Canonical (4 rows) | No change |
| `activities` | Dual FK (`tech_category` TEXT + `technology_id` UUID) | Drop `tech_category`, use `technology_id` only |
| `requirements` | `technology_id` (renamed from `tech_preset_id` by migration) | No change |
| `requirement_understanding` | `input_tech_category` TEXT, no FK | Add `technology_id` FK (optional) |
| `impact_map` | `input_tech_category` TEXT, `has_requirement_understanding` BOOLEAN | Add `technology_id` FK, add `understanding_id` FK |
| `estimations` | No artifact FKs, `ai_reasoning` TEXT | Add `understanding_id` FK, `impact_map_id` FK, migrate `ai_reasoning` to JSONB |
| `estimation_interview` | **Does not exist** | New table for interview persistence |

### Code Files with Legacy Debt

| File | Issue | Priority |
|---|---|---|
| `src/hooks/useWizardState.ts` | `techPresetId` naming | P3 |
| `src/lib/api.ts` | Dual `tech_preset_id` + `technology_id` in `CreateRequirementInput` | P2 |
| `src/types/database.ts` | `@deprecated` aliases | P3 |
| `netlify/functions/lib/activities.ts` | Dead `techPresetId` parameter | P1 |
| `netlify/functions/ai-requirement-interview.ts` | `techPresetId` in RequestBody, never used | P2 |
| `netlify/functions/ai-estimate-from-interview.ts` | Same | P2 |
| `netlify/functions/ai-impact-map.ts` | Same | P2 |
| `supabase_schema.sql` | Stale — still shows `technology_presets` | P1 |

### Data Flow Coupling Matrix

| Connection | Current Link | Structural? | Target |
|---|---|---|---|
| Requirement → Understanding | `requirement_id` FK | ✅ | No change |
| Requirement → Impact Map | `requirement_id` FK | ✅ | No change |
| Requirement → Estimation | `requirement_id` FK | ✅ | No change |
| Understanding → Impact Map | `has_requirement_understanding` BOOLEAN | ❌ Metadata only | Add `understanding_id` FK |
| Understanding → Estimation | None | ❌ | Add `understanding_id` FK |
| Impact Map → Estimation | None | ❌ | Add `impact_map_id` FK |
| Impact Map → Activities | None | ❌ | Post-estimation layer coverage check |
| Interview → Estimation | None | ❌ | New `estimation_interview` table |
