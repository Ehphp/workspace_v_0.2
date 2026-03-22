# Candidate-Set Builder: Implementation Decision Document

> **Date**: 2026-03-10  
> **Status**: Final plan — ready for sprint planning  
> **Scope**: Candidate preparation layer for AI estimation pipeline  
> **Prerequisite reading**: Corrected architectural review (conversation record)

---

## 1. Immediate Contradictions / Bugs to Fix Now

These are broken behaviors or architectural contradictions in current production code. They should be fixed regardless of any future CSB work.

| # | Issue | Why it is a bug or contradiction | Files / modules | Priority |
|---|-------|----------------------------------|-----------------|----------|
| B1 | **`search_catalog` discovers activities that cannot become selectable** | The agentic tool performs pgvector search and returns new activities. But `validActivityCodes` (set at agent init from `selectTopActivities` output) is used as an `enum` constraint in the OpenAI response schema (`agent-orchestrator.ts:281`) and as a post-generation filter (`agent-orchestrator.ts:760`). Any activity found by `search_catalog` but not in the initial ranked set is structurally impossible to select. The tool is architecturally inert. | `netlify/functions/lib/ai/agent/agent-orchestrator.ts` (L281, L760), `netlify/functions/ai-estimate-from-interview.ts` (L478) | **P0** |
| B2 | **Understanding and ImpactMap are absent from candidate generation** | `selectTopActivities` accepts `description`, `answers`, and `blueprint` — but not `requirementUnderstanding` or `impactMap`. These two structured artifacts, produced in wizard steps 3–4, have zero influence on which activities enter the candidate set. Only Blueprint keywords contribute (+2 boost). | `netlify/functions/lib/activities.ts` (`selectTopActivities` signature, L113) | **P0** |
| B3 | **`AgentInput` carries no structured artifact data** | The `AgentInput` interface passed to the agentic orchestrator contains only: `description`, `answers`, `activities`, `validActivityCodes`, `techCategory`, `projectContext`, `technologyName`, `userId`, `flags`. Understanding, ImpactMap, and Blueprint exist only as prompt text injected upstream — the agent has no programmatic access to artifact structure. | `netlify/functions/lib/ai/agent/agent-types.ts` (L103–145), `netlify/functions/ai-estimate-from-interview.ts` (L462–495) | **P1** |
| B4 | **`fetchActivitiesServerSide` ignores `techPresetId` parameter** | The function accepts `techPresetId` but never includes it in any Supabase query. Filtering is done exclusively via `tech_category` string match. The `technology_id` FK on the `activities` table (added in migration `20260228`) is unused. | `netlify/functions/lib/activities.ts` (`fetchActivitiesServerSide`) | **P1** |
| B5 | **No provenance metadata on candidate activities** | `selectTopActivities` returns a plain `Activity[]` — no match score, no source attribution (which artifact matched), no keyword overlap record. It is impossible to audit why a specific activity entered the candidate set. | `netlify/functions/lib/activities.ts` (L200: returns `scored.slice(0, topN).map(s => s.activity)`) | **P1** |

---

## 2. Low-Risk Improvements to Implement Now

These are not bugs but safe, high-value structural additions that improve observability, correctness, and future extensibility.

| # | Improvement | Why it helps | Files / modules | Risk | Order |
|---|-------------|-------------|-----------------|------|-------|
| I1 | **Scoring metadata on ranked activities** | Enables auditing, debugging, and future provenance tracing. Return `{ activity, score, matchedKeywords, sourceArtifact[] }` from `selectTopActivities` instead of plain `Activity[]`. | `netlify/functions/lib/activities.ts`, `netlify/functions/ai-estimate-from-interview.ts` (consumer) | Low — additive, no behavioral change | 1st |
| I2 | **Deterministic Blueprint coverage validator** | After activity selection (post-AI), verify that each Blueprint component has ≥1 mapped activity. Emit warnings for uncovered components. This is a pure check — it does not modify the AI output. | New: `netlify/functions/lib/validation/coverage-validator.ts`. Consumer: `ai-estimate-from-interview.ts` (after AI response, before persisting) | Low — read-only post-check | 2nd |
| I3 | **Populate `breakdown.byGroup`** | `EstimationEngine.ts` initializes `byGroup: {}` and `byTech: {}` but never fills them. Populating `byGroup` from selected activities is trivial and provides useful breakdown data for the UI. | `src/lib/sdk/EstimationEngine.ts` (L68–69) | Low — additive computation | 3rd |
| I4 | **Expansion rules config** | A static JSON map: `{ componentType → activityGroup[] }` (e.g., `"integration" → ["INT_*"]`). Applied during candidate preparation to ensure structurally required activity groups are never excluded by keyword ranking alone. | New: `netlify/functions/lib/expansion-rules.json` + consumer in `selectTopActivities` or future CSB | Low — deterministic, overrideable | 4th |

---

## 3. Candidate-Set Builder: Minimal Realistic Version

| Aspect | Minimal realistic design |
|--------|-------------------------|
| **Module** | New file: `netlify/functions/lib/candidate-set-builder.ts`. Not a refactor of `selectTopActivities` — replaces its call site in `ai-estimate-from-interview.ts`. `selectTopActivities` remains available as a fallback/legacy path. |
| **Inputs** | `description: string`, `answers: Record<string, InterviewAnswerRecord>`, `understanding: RequirementUnderstanding \| null`, `impactMap: ImpactMap \| null`, `blueprint: EstimationBlueprint \| null`, `activities: Activity[]`, `expansionRules: ExpansionRules` |
| **Output** | `CandidateSet`: `{ candidates: ScoredCandidate[], metadata: CandidateSetMetadata }` where `ScoredCandidate = Activity & { score: number, sources: ArtifactSource[], matchedKeywords: string[] }` and `CandidateSetMetadata = { totalScored: number, totalSelected: number, artifactsUsed: string[], expansionRulesApplied: string[], timestamp: string }` |
| **Scoring logic** | Multi-source keyword scoring: description keywords (+1), answer keywords (+1), Understanding keywords (+1.5), ImpactMap area/module keywords (+1.5), Blueprint component/integration/entity keywords (+2). Same bag-of-words approach as today but with all artifacts contributing. |
| **Expansion** | After scoring, apply expansion rules: if Blueprint contains component type X (e.g., integration), ensure at least one activity from group Y is in the set, even if score was below threshold. |
| **Top-N** | Same default (20), but the set is now artifact-informed and expansion-guaranteed. |
| **Provenance** | Each `ScoredCandidate` carries `sources: ArtifactSource[]` where `ArtifactSource = { artifact: 'description' \| 'answers' \| 'understanding' \| 'impactMap' \| 'blueprint' \| 'expansion-rule', matchedTerms: string[] }`. |
| **How it differs from `selectTopActivities`** | (1) Receives all 5 input sources instead of 3. (2) Returns scored candidates with provenance instead of a flat array. (3) Applies expansion rules. (4) Emits metadata for logging/auditing. |
| **Backward compatibility** | The CSB output's `candidates.map(c => c.activity)` is type-compatible with today's `Activity[]`. The linear pipeline can consume it directly. The agentic pipeline receives `validActivityCodes` from the full candidate list. |

**Why this is the right current version of the Candidate-Set Builder:**  
It addresses the three verified structural deficits — artifact blindness, missing provenance, and broken expansion — without introducing graph infrastructure, new database tables, or changes to the AI model contract. It is a deterministic pre-processing module that slot into the existing pipeline at the exact point where `selectTopActivities` is called today. The scoring remains keyword-based (proven, fast, debuggable) but draws from all available artifacts instead of an arbitrary subset. The provenance metadata enables the coverage validator (I2) and future traceability requirements. It is small enough to ship in one sprint and simple enough to delete if a better approach emerges.

---

## 4. What to Defer

| # | Deferred item | Why defer | What should happen before it |
|---|---------------|-----------|------------------------------|
| D1 | **Full activity graph** (weighted edges, traversal algorithms, dependency resolution) | 54 activities across 4 categories do not justify graph infrastructure. The expansion-rules config covers the structural guarantee use case at a fraction of the complexity. | Catalog grows beyond ~150 activities, or cross-category dependency patterns emerge in production |
| D2 | **Rich dependency metadata** (activity A requires activity B) | No evidence of dependency-related estimation errors today. Activity groups are self-contained within tech categories. | Real-world estimation errors traced to missing dependent activities |
| D3 | **Activating `technology_activities` JOIN** | The table exists (migration `20260228`) with `base_hours_override`, `name_override`, `description_override` columns — but has **zero rows** in seed data. Activating the JOIN changes nothing without data. | (1) Decide if per-technology overrides are a real product need, (2) Populate table with real override data for ≥1 technology, then (3) Activate JOIN in `fetchActivitiesServerSide` |
| D4 | **Heavy retrieval orchestration** (multi-step RAG, re-ranking chains, embedding-based candidate filtering) | Current pgvector search works. The bottleneck is not retrieval quality but structural disconnection between artifacts and candidate preparation. Fix the structural issue first. | CSB is in production and producing provenance data; retrieval quality measured as insufficient |
| D5 | **Structured artifact fields on `AgentInput`** beyond prompt injection | Once the CSB produces a properly scored candidate set, the agentic pipeline receives better inputs automatically. Restructuring `AgentInput` to carry full artifact objects is a deeper refactor with limited additional value unless the agent needs to reason over artifact structure at runtime. | Evidence that the agent's reasoning quality is limited by artifact prompt formatting rather than candidate quality |
| D6 | **`breakdown.byTech` population** | Unlike `byGroup` (which maps to activity groups already on each activity), `byTech` requires a technology→activity mapping that doesn't exist in the engine's input today. | `technology_activities` is populated and the engine receives technology context |

---

## 5. Final Implementation Roadmap

### Sprint 1 — Fix Contradictions

| Deliverable | Main files / modules | Breaking? | Risk |
|-------------|---------------------|-----------|------|
| **B1**: Expand `validActivityCodes` when `search_catalog` discovers new activities. After tool execution, merge discovered codes into the valid set before the final structured-output call. | `agent-orchestrator.ts` (L281, L389, L760), `agent-tools.ts` (return shape) | No — additive. Agentic pipeline only. | Low. Requires care with enum rebuilding per-iteration. |
| **B2**: Pass Understanding and ImpactMap to `selectTopActivities` as additional keyword sources. Extract keywords from Understanding (scope, objectives, constraints) and ImpactMap (areas, modules) with +1.5 weight. | `activities.ts` (signature + scoring), `ai-estimate-from-interview.ts` (call site L447), `ai-requirement-interview.ts` (call site) | No — same output type, richer scoring. | Low. Keyword extraction is mechanical. |
| **B4**: Use `technology_id` FK in `fetchActivitiesServerSide` query when available, fallback to `tech_category` string. | `activities.ts` (`fetchActivitiesServerSide`) | No — backward compatible (falls back). | Low. |
| **B5**: Return scoring metadata from `selectTopActivities` — score, matched keywords, source artifact. Update consumers to extract `Activity[]` from the enriched return. | `activities.ts` (return type), `ai-estimate-from-interview.ts` (consumer), `ai-requirement-interview.ts` (consumer) | No — consumers unwrap the new return type. | Low. |

### Sprint 2 — Add Low-Risk Structural Guarantees

| Deliverable | Main files / modules | Breaking? | Risk |
|-------------|---------------------|-----------|------|
| **I1**: Formalize scoring metadata type (`ScoredCandidate`) and persist to estimation metrics/logs. | `activities.ts`, `ai-estimate-from-interview.ts` (metrics object) | No | Low |
| **I2**: Deterministic Blueprint coverage validator — post-AI check that warns on uncovered Blueprint components. | New: `netlify/functions/lib/validation/coverage-validator.ts`. Consumer: `ai-estimate-from-interview.ts` | No — read-only validator, emits warnings. | Low |
| **I3**: Populate `breakdown.byGroup` in `EstimationEngine.ts`. | `src/lib/sdk/EstimationEngine.ts` | No — fills previously-empty field. | Low |
| **I4**: Create expansion-rules config and apply during ranking. | New: `netlify/functions/lib/expansion-rules.json`. Consumer: `activities.ts` | No — additive. | Low |

### Sprint 3 — Introduce Minimal Candidate-Set Builder

| Deliverable | Main files / modules | Breaking? | Risk |
|-------------|---------------------|-----------|------|
| **CSB module**: `candidate-set-builder.ts` — receives all 5 artifact sources, scores with provenance, applies expansion rules, returns `CandidateSet`. | New: `netlify/functions/lib/candidate-set-builder.ts` | No — replaces `selectTopActivities` call site, does not delete it. | Medium — new module, needs integration tests. |
| **Wire CSB into estimation pipeline**: Replace `selectTopActivities` call in `ai-estimate-from-interview.ts` with `buildCandidateSet()`. Pass all wizard artifacts. | `ai-estimate-from-interview.ts` (L447 region) | No — same downstream contract (`Activity[]`-compatible). | Medium — integration point. |
| **Wire CSB into interview pipeline**: Same replacement in `ai-requirement-interview.ts`. | `ai-requirement-interview.ts` | No | Medium |
| **CSB provenance logging**: Log `CandidateSetMetadata` to estimation metrics for observability. | `ai-estimate-from-interview.ts` (metrics) | No | Low |
| **Feature flag**: `AI_CSB_ENABLED` env var. When false, fall back to `selectTopActivities`. | `ai-estimate-from-interview.ts`, `ai-requirement-interview.ts` | No | Low |

### Later — Optional Strategic Evolution

| Deliverable | Main files / modules | Breaking? | Risk |
|-------------|---------------------|-----------|------|
| Activate `technology_activities` JOIN (after populating data) | `activities.ts`, seed SQL | No | Low |
| Populate `breakdown.byTech` | `EstimationEngine.ts` | No | Low |
| Activity dependency metadata | New table or JSONB column | No | Medium |
| Full activity graph with traversal | New module | No | High |
| Structured `AgentInput` with artifact fields | `agent-types.ts`, `agent-orchestrator.ts` | No | Medium |
| Multi-step retrieval orchestration | Agent pipeline | No | High |

---

## 6. Final Recommendation

**Implement now:** Fix `search_catalog` expansion lock (B1), pass Understanding + ImpactMap into ranking (B2), use `technology_id` FK (B4), add scoring metadata to ranked output (B5).

**Implement next:** Coverage validator (I2), expansion rules (I4), `breakdown.byGroup` (I3), then the minimal Candidate-Set Builder as a new module behind a feature flag.

**Defer:** Full activity graph, dependency metadata, `technology_activities` JOIN activation (no data), structured `AgentInput` refactor, heavy retrieval orchestration.
