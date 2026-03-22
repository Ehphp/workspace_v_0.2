# Sprint 1: Patch Plan — Fix Contradictions & Improve Observability

> **Date**: 2026-03-10  
> **Status**: Execution-ready  
> **Scope**: B1, B2, B5, B4 (assessment only)  
> **Parent**: [candidate-set-builder-implementation-plan.md](candidate-set-builder-implementation-plan.md)

---

## 0. File-by-File Implementation Blueprint

### 0.1 Final File List

| File | Why touched | Sprint 1 item |
|------|-------------|---------------|
| `netlify/functions/lib/activities.ts` | New types (`RankedActivity`, `ArtifactMatch`), new signature for `selectTopActivities`, new keyword extraction for Understanding + ImpactMap, per-source scoring, return `RankedActivity[]` | **B2, B5** |
| `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | Mutable `validActivityCodes` in `llmWithTools`, merge discovered codes from `search_catalog`, update 2 post-filters, update validCodes ref in refine path | **B1** |
| `netlify/functions/ai-estimate-from-interview.ts` | (1) Pass `body.requirementUnderstanding` + `body.impactMap` to `selectTopActivities` call site. (2) Unwrap `RankedActivity[]` → `Activity[]`. (3) Log provenance. Same for linear path `activitiesToUse` derivation. | **B2, B5** |
| `netlify/functions/ai-requirement-interview.ts` | Same as above: pass artifacts, unwrap return type, log provenance | **B2, B5** |
| `netlify/functions/lib/activities.ts` | Add B4 diagnostic to `fetchActivitiesServerSide` (one-time `technology_id IS NULL` count log) | **B4** |

5 files total. No new files created. No database changes.

### 0.2 Patch Blueprint per File

**File: `netlify/functions/lib/activities.ts`**

| Section / function | Change to make | Why | Risk |
|-------------------|---------------|-----|------|
| Types (top of file, after `ActivityFetchResult`) | Add `export interface ArtifactMatch { source: 'description' \| 'answers' \| 'understanding' \| 'impactMap' \| 'blueprint'; matchCount: number; }` and `export interface RankedActivity { activity: Activity; score: number; matchedSources: ArtifactMatch[]; }` | B5: new return type | None — additive |
| `selectTopActivities` signature (L113) | Add `understanding?: Record<string, unknown>`, `impactMap?: Record<string, unknown>` as 6th/7th optional params | B2: accept artifacts | None — optional trailing params |
| `selectTopActivities` early return (L119) | Change from `return activities;` to `return activities.map(a => ({ activity: a, score: 0, matchedSources: [] }));` | B5: return type alignment for short-circuit path | Low — additive wrapping |
| `selectTopActivities` body: after blueprintKeywords block (~L170) | Add new block: extract `understandingKeywords` set from Understanding fields. Add new block: extract `impactMapKeywords` set from ImpactMap fields. | B2: keyword extraction | Low — new code block, no existing code modified |
| `selectTopActivities` scoring loop (~L185–195) | Add per-source counters (`descCount`, `ansCount`, `underCount`, `impactCount`, `bpCount`). Change scoring to track which source contributed. Add `if (understandingKeywords.has(word)) score += 1.5; underCount++;`. Same for `impactMapKeywords`. | B2 + B5: artifact weighting + provenance | Low — modifies inner loop |
| `selectTopActivities` return (~L200−203) | Change `scored.slice(0, topN).map(s => s.activity)` to `scored.slice(0, topN).map(s => ({ activity: s.activity, score: s.score, matchedSources: buildMatchedSources(s) }))`. | B5: return provenance | Low |
| `selectTopActivities` log line (~L202) | Update log to show provenance counts | Observability | None |
| `fetchActivitiesServerSide` (~L80–84, after successful DB fetch) | Add diagnostic: count activities where `technology_id` would be NULL. Log warning if any. Query `SELECT count(*) ... WHERE technology_id IS NULL AND active = true`. | B4: diagnostic only | None — read-only, no behavior change |

**File: `netlify/functions/lib/ai/agent/agent-orchestrator.ts`**

| Section / function | Change to make | Why | Risk |
|-------------------|---------------|-----|------|
| `llmWithTools` signature (L334) | Rename param `validActivityCodes` to `initialValidCodes`. Add `let validActivityCodes = [...initialValidCodes];` as first line of function body. | B1: make codes mutable | None — behavioral no-op until expansion happens |
| Tool-call loop, after `executeTool` (inside `for` loop, ~L445) | After each tool call, check if `toolName === 'search_catalog'` AND `result.activities` is an array. If so, extract new codes (`result.activities.map(a => a.code).filter(c => !validActivityCodes.includes(c))`), push them onto `validActivityCodes`. Also merge the full activity objects into `toolCtx.activitiesCatalog` (converting shape and deduplicating by code). Log expansion count. | B1: merge discovered codes + activities | Low — additive. Only fires when search_catalog returns new codes. |
| `buildResponseSchema(validActivityCodes)` calls (L389 final-answer, L470 recovery, L517 exhausted-iterations) | Already read the local `validActivityCodes` variable. **No change needed** — the mutable `let` binding ensures they see the expanded set. | B1: verify — no code change | None |
| Post-draft filter (L758) | Change `const validCodes = new Set(input.validActivityCodes)` → `const validCodes = new Set(validActivityCodes)`. **But wait** — this code is in `runAgentPipeline`, outside `llmWithTools`. The expanded set only exists inside `llmWithTools`. **Solution**: `llmWithTools` must return the expanded `validActivityCodes` alongside the draft. Then `runAgentPipeline` uses the returned set for the filter. | B1: propagate expansion | Low — return shape change is internal |
| `llmWithTools` return type | Add `expandedCodes: string[]` to the return: `Promise<{ draft: DraftEstimation; toolCalls: ToolCallRecord[]; expandedCodes: string[] }>`. Return `validActivityCodes` at each return point. | B1: propagate expansion | Low |
| `runAgentPipeline` — after `llmWithTools` call (~L745) | Destructure `expandedCodes` from result. Use `new Set(expandedCodes)` for `validCodes` instead of `new Set(input.validActivityCodes)`. | B1: use expanded set in post-filter | Low |
| `runAgentPipeline` — REFINE path (~L839) | Same: pass `expandedCodes` to the second `llmWithTools` call and use its returned `expandedCodes` for the post-refine filter at ~L850. | B1: refine also gets expansion | Low |

**File: `netlify/functions/ai-estimate-from-interview.ts`**

| Section / function | Change to make | Why | Risk |
|-------------------|---------------|-----|------|
| Import (L23) | Add `RankedActivity` to import from `./lib/activities` | B5 | None |
| `selectTopActivities` call site (L447–452) | Add `body.requirementUnderstanding, body.impactMap` as 6th and 7th args | B2 | None |
| After `selectTopActivities` call (L453+) | `const rankedResults = selectTopActivities(…)` → unwrap: `const rankedActivities = rankedResults.map(r => r.activity);` | B5 | None |
| After unwrap | Log provenance: `console.log('[ranking] Provenance:', JSON.stringify(rankedResults.slice(0,5).map(r => ({ code: r.activity.code, score: r.score, sources: r.matchedSources }))))` and add `metrics.rankingProvenance = rankedResults.map(...)` | B5 | None |
| Agentic path: `rankedActivities` usage (L468+) | No change needed — `rankedActivities` is already `Activity[]` after unwrap | — | — |
| Linear path: `activitiesToUse` init (L571) | `let activitiesToUse: Activity[] = rankedActivities;` — already correct after unwrap | — | — |

**File: `netlify/functions/ai-requirement-interview.ts`**

| Section / function | Change to make | Why | Risk |
|-------------------|---------------|-----|------|
| Import (L30) | Add `RankedActivity` to import | B5 | None |
| `selectTopActivities` call site (L453–458) | Add `body.requirementUnderstanding, body.impactMap` as 6th and 7th args | B2 | None |
| After call | Unwrap: `const rankedResults = selectTopActivities(…)` → `const rankedActivities = rankedResults.map(r => r.activity);` | B5 | None |
| After unwrap | Log provenance | B5 | None |
| `formatActivitiesSummary(rankedActivities)` (L462) | Already correct — receives `Activity[]` after unwrap | — | — |

### 0.3 Type Changes

| Type | File | Change |
|------|------|--------|
| `ArtifactMatch` (new) | `activities.ts` | `{ source: 'description' \| 'answers' \| 'understanding' \| 'impactMap' \| 'blueprint'; matchCount: number }` |
| `RankedActivity` (new) | `activities.ts` | `{ activity: Activity; score: number; matchedSources: ArtifactMatch[] }` |
| `selectTopActivities` return type | `activities.ts` | `Activity[]` → `RankedActivity[]` |
| `selectTopActivities` signature | `activities.ts` | Add optional params: `understanding?: Record<string, unknown>`, `impactMap?: Record<string, unknown>` |
| `llmWithTools` return type | `agent-orchestrator.ts` | `{ draft; toolCalls }` → `{ draft; toolCalls; expandedCodes: string[] }` |
| No changes to | `AgentInput`, `AgentOutput`, `AgentActivity`, `ToolExecutionContext`, `RequestBody` | — |

### 0.4 B1 Detailed Patch Order

| Step | File | Change |
|------|------|--------|
| 1 | `agent-orchestrator.ts` L330–338 | In `llmWithTools`, rename param `validActivityCodes` → `initialValidCodes`. Add `let validActivityCodes = [...initialValidCodes];` as first body line. |
| 2 | `agent-orchestrator.ts` L330 return type | Change return type to `Promise<{ draft: DraftEstimation; toolCalls: ToolCallRecord[]; expandedCodes: string[] }>` |
| 3 | `agent-orchestrator.ts` ~L445 (inside tool-call loop, after `executeTool`) | Add: `if (toolName === 'search_catalog' && result?.activities && Array.isArray(result.activities)) { const existingCodes = new Set(validActivityCodes); const newActivities = result.activities.filter((a: any) => a.code && !existingCodes.has(a.code)); if (newActivities.length > 0) { for (const a of newActivities) { validActivityCodes.push(a.code); } const existingCatalogCodes = new Set(toolCtx.activitiesCatalog.map(a => a.code)); for (const a of newActivities) { if (!existingCatalogCodes.has(a.code)) { toolCtx.activitiesCatalog.push({ code: a.code, name: a.name, description: a.description || '', base_hours: a.baseHours ?? a.base_hours ?? 0, group: a.group || 'UNKNOWN', tech_category: a.techCategory || a.tech_category || 'MULTI' }); } } console.log('[agent] search_catalog expansion: +' + newActivities.length + ' codes → validActivityCodes now ' + validActivityCodes.length); } }` |
| 4 | `agent-orchestrator.ts` ~L505 (first return in llmWithTools — after parsing final answer) | Add `expandedCodes: validActivityCodes` to the return object |
| 5 | `agent-orchestrator.ts` ~L517–543 (exhausted-iterations final call + return) | Verify `buildResponseSchema(validActivityCodes)` reads the mutable local (it does). Add `expandedCodes: validActivityCodes` to the return object. |
| 6 | `agent-orchestrator.ts` ~L745 (runAgentPipeline, after `llmWithTools` call in DRAFT) | Change `const result = await llmWithTools(…)` destructure to `const { draft: draftResult, toolCalls: _, expandedCodes } = await llmWithTools(…)`. Assign `draft = draftResult`. |
| 7 | `agent-orchestrator.ts` ~L758 (post-draft filter) | Change `const validCodes = new Set(input.validActivityCodes)` → `const validCodes = new Set(expandedCodes)` |
| 8 | `agent-orchestrator.ts` ~L839 (REFINE path — second `llmWithTools` call) | Same destructure pattern. Use returned `expandedCodes` for the post-refine filter at ~L850: `draft.activities = draft.activities.filter(a => new Set(expandedCodes2).has(a.code))` |
| 9 | Verify | Confirm `llmDirect` is NOT touched (it has no tool loop — no expansion needed). Confirm the linear pipeline in `ai-estimate-from-interview.ts` is NOT touched (no agentic code path). |
| 10 | Test | Write unit test (see Section 0.8) |

### 0.5 B2 Detailed Patch Order

| Step | File | Change |
|------|------|--------|
| 1 | `activities.ts` L113–118 | Add `understanding?: Record<string, unknown>` and `impactMap?: Record<string, unknown>` to function signature as 6th and 7th optional params |
| 2 | `activities.ts` ~L172 (after the blueprint keyword extraction block ends) | Add Understanding keyword extraction block: `const understandingKeywords = new Set<string>(); if (understanding && typeof understanding === 'object') { const uParts: string[] = []; if (understanding.businessObjective) uParts.push(String(understanding.businessObjective)); if (understanding.expectedOutput) uParts.push(String(understanding.expectedOutput)); if (Array.isArray(understanding.functionalPerimeter)) { for (const fp of understanding.functionalPerimeter) uParts.push(String(fp)); } if (Array.isArray(understanding.exclusions)) { for (const ex of understanding.exclusions) uParts.push(String(ex)); } const uText = uParts.join(' ').toLowerCase(); for (const w of uText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2)) { understandingKeywords.add(w); } }` |
| 3 | `activities.ts` ~L173 (immediately after step 2) | Add ImpactMap keyword extraction block: `const impactMapKeywords = new Set<string>(); if (impactMap && typeof impactMap === 'object') { const imParts: string[] = []; if (impactMap.summary) imParts.push(String(impactMap.summary)); if (Array.isArray(impactMap.impacts)) { for (const item of impactMap.impacts) { if (!item \|\| typeof item !== 'object') continue; if (Array.isArray(item.components)) { for (const c of item.components) imParts.push(String(c)); } if (item.layer) imParts.push(String(item.layer)); if (item.action) imParts.push(String(item.action)); } } const imText = imParts.join(' ').toLowerCase(); for (const w of imText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2)) { impactMapKeywords.add(w); } }` |
| 4 | `activities.ts` L185–195 (scoring loop) | Add two lines inside the `for (const word of activityWords)` loop: `if (understandingKeywords.has(word)) score += 1.5;` and `if (impactMapKeywords.has(word)) score += 1.5;` — placed after the existing `blueprintKeywords` check |
| 5 | `ai-estimate-from-interview.ts` L447–452 | Change `selectTopActivities(fetchResult.activities, sanitizedDescription, body.answers, 20, body.estimationBlueprint)` → add `, body.requirementUnderstanding, body.impactMap` as 6th and 7th args |
| 6 | `ai-requirement-interview.ts` L453–458 | Change `selectTopActivities(fetchResult.activities, sanitizedDescription, undefined, 20, body.estimationBlueprint)` → add `, body.requirementUnderstanding, body.impactMap` as 6th and 7th args |
| 7 | Test | Write unit test (see Section 0.8) |

### 0.6 B5 Detailed Patch Order

| Step | File | Change |
|------|------|--------|
| 1 | `activities.ts` ~L35 (after `ActivityFetchResult`) | Add `export interface ArtifactMatch` and `export interface RankedActivity` types (see Section 0.3) |
| 2 | `activities.ts` L119 (early-return path) | Change `if (activities.length <= topN) return activities;` → `if (activities.length <= topN) return activities.map(a => ({ activity: a, score: 0, matchedSources: [] as ArtifactMatch[] }));` |
| 3 | `activities.ts` L185 (internal scored item shape) | Change `return { activity: a, score };` → `return { activity: a, score, descCount, ansCount, underCount, impactCount, bpCount };` (where per-source counters are added in B2 step 4's scoring loop) |
| 4 | `activities.ts` L200–203 (final return) | Change `scored.slice(0, topN).map(s => s.activity)` → `scored.slice(0, topN).map(s => { const ms: ArtifactMatch[] = []; if (s.descCount > 0) ms.push({ source: 'description', matchCount: s.descCount }); if (s.ansCount > 0) ms.push({ source: 'answers', matchCount: s.ansCount }); if (s.underCount > 0) ms.push({ source: 'understanding', matchCount: s.underCount }); if (s.impactCount > 0) ms.push({ source: 'impactMap', matchCount: s.impactCount }); if (s.bpCount > 0) ms.push({ source: 'blueprint', matchCount: s.bpCount }); return { activity: s.activity, score: s.score, matchedSources: ms }; })` |
| 5 | `activities.ts` L202 (log line) | Update: `console.log('[ranking] Selected ${selected.length}/${activities.length} activities (top: ${selected.slice(0,3).map(s => s.activity.code + '=' + s.score.toFixed(1)).join(', ')})')` |
| 6 | `activities.ts` function return type annotation | Change `: Activity[]` → `: RankedActivity[]` |
| 7 | `ai-estimate-from-interview.ts` L447+ (agentic path) | `const rankedResults = selectTopActivities(…);` then `const rankedActivities = rankedResults.map(r => r.activity);` then `console.log('[ranking] Provenance:', JSON.stringify(rankedResults.slice(0,5).map(r => ({c: r.activity.code, s: r.score, src: r.matchedSources}))));` and `metrics.rankingTopScores = rankedResults.slice(0,5).map(r => ({code: r.activity.code, score: r.score}));` |
| 8 | `ai-estimate-from-interview.ts` L571 (linear path) | `activitiesToUse` is already initialized from `rankedActivities` which is now `Activity[]` after unwrap. **No change needed.** |
| 9 | `ai-requirement-interview.ts` L453+ | Same as step 7: unwrap, log provenance |
| 10 | Both consumer imports | Add `RankedActivity` to import (or don't — consumers only use `Activity[]` after unwrap. Import is optional, only needed if type annotation is desired.) |
| 11 | Test | Write unit test (see Section 0.8) |

**Note on B2 + B5 scoring loop merge**: Steps B2-4 and B5-3 both modify the same scoring loop. They must be implemented together. The final loop body becomes:

```typescript
const scored = activities.map(a => {
    const activityText = `${a.code} ${a.name} ${a.description || ''} ${a.group}`.toLowerCase();
    const activityWords = activityText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2);
    let score = 0;
    let descCount = 0, ansCount = 0, underCount = 0, impactCount = 0, bpCount = 0;
    for (const word of activityWords) {
        if (keywordSet.has(word)) { score += 1; descCount++; }
        if (blueprintKeywords.has(word)) { score += 2; bpCount++; }
        if (understandingKeywords.has(word)) { score += 1.5; underCount++; }
        if (impactMapKeywords.has(word)) { score += 1.5; impactCount++; }
    }
    if (a.tech_category === 'MULTI') score += 0.5;
    return { activity: a, score, descCount, ansCount, underCount, impactCount, bpCount };
});
```

**Important**: `descCount` above is technically `descCount + ansCount` because `keywordSet` contains keywords from both description and answers. To properly separate them, we would need two sets. **Pragmatic decision for Sprint 1**: keep `keywordSet` as-is (description + answers combined) and report it as `source: 'description'`. The separation into `description` vs `answers` is a Sprint 2 refinement. For Sprint 1, the counter tracks "description+answers combined."

Revised per-source counters:
- `baseCount` — matches from `keywordSet` (description + answers combined)
- `underCount` — matches from `understandingKeywords`
- `impactCount` — matches from `impactMapKeywords`
- `bpCount` — matches from `blueprintKeywords`

And `matchedSources` reports `source: 'description'` for `baseCount` (combined desc+answers — documented in code comment).

### 0.7 B4 Diagnostic-Only Patch

| File | Diagnostic | Why safe |
|------|-----------|----------|
| `activities.ts` — `fetchActivitiesServerSide`, inside the successful DB fetch block (~L83, after `if (!error && data && data.length > 0)`) | Add a secondary count query: `supabase.from('activities').select('code', { count: 'exact', head: true }).eq('active', true).is('technology_id', null)`. If count > 0, log `[server-fetch] WARNING: ${count} active activities have NULL technology_id — FK filtering not safe yet`. | Read-only `SELECT count(*)` query. Does not modify data. Does not change activity fetch behavior. Runs once per request but is cheap (index scan on `technology_id`). Can be wrapped in try/catch to be fully non-blocking. |

### 0.8 Test File Plan

| Test file | Covers | Type |
|-----------|--------|------|
| `src/test/ranking-provenance.test.ts` (new) | B2: Understanding/ImpactMap keyword influence on ranking. B5: `RankedActivity` return type shape, `.map(r => r.activity)` compatibility, `matchedSources` correctness. B5 early-return: when `activities.length <= topN`, returns `score: 0` and empty `matchedSources`. | Unit (vitest, pure function, no network) |
| `src/test/search-catalog-expansion.test.ts` (new) | B1: After mock `search_catalog` returns new codes, `validActivityCodes` expands. Returned `expandedCodes` includes new entries. `toolCtx.activitiesCatalog` includes new activity objects. | Unit (vitest, mock OpenAI + executeTool) |
| `src/test/ranking-regression.test.ts` (new) | Regression: call `selectTopActivities` with a reference dataset (fixed description, answers, blueprint). Assert output is a superset of the pre-B2 output (new artifact keywords can only ADD relevance). Assert score ordering is stable for top-5 activities. | Unit (vitest, snapshot comparison) |

### 0.9 Final Implementation Sequence

Recommended coding order (code compiles at each step):

1. **`activities.ts` — Add new types** (`ArtifactMatch`, `RankedActivity`). No function changes yet. Code compiles.

2. **`activities.ts` — Change `selectTopActivities` return type** annotation to `RankedActivity[]`. Update early-return path. Update final return to wrap in `RankedActivity`. Update internal scoring to emit per-source counters. Update log line. **Code compiles** but callers now have a type error (expected `Activity[]`, got `RankedActivity[]`).

3. **`ai-estimate-from-interview.ts` — Unwrap** `selectTopActivities` call site. `const rankedResults = selectTopActivities(…); const rankedActivities = rankedResults.map(r => r.activity);` Add provenance log. **Code compiles** — agentic and linear paths both receive `Activity[]` again.

4. **`ai-requirement-interview.ts` — Unwrap** same pattern. **Code compiles.**

5. **`activities.ts` — Add Understanding/ImpactMap params + keyword extraction** (B2). Extend signature, add extraction blocks, modify scoring loop. **Code compiles** — callers don't pass the new optional params yet, so behavior is unchanged.

6. **`ai-estimate-from-interview.ts` — Pass artifacts** to `selectTopActivities` (add 6th + 7th args). **Code compiles, B2 is active in estimation path.**

7. **`ai-requirement-interview.ts` — Pass artifacts** to `selectTopActivities`. **Code compiles, B2 is active in interview path.**

8. **`agent-orchestrator.ts` — B1 changes**: mutable `validActivityCodes`, expanded return type, merge logic after `search_catalog`, propagate `expandedCodes` in `runAgentPipeline`, update both post-filters. **Code compiles, B1 is active.**

9. **`activities.ts` — B4 diagnostic**: add `technology_id IS NULL` count log in `fetchActivitiesServerSide`. **Code compiles.**

10. **Write tests**: `ranking-provenance.test.ts`, `search-catalog-expansion.test.ts`, `ranking-regression.test.ts`.

11. **Run full test suite**: `pnpm test` to verify no regressions.

---

## 1. Sprint 1 Implementation Boundary

| Item | Goal | Include in Sprint 1? | Why |
|------|------|---------------------|-----|
| **B1** | Fix `search_catalog` / `validActivityCodes` contradiction | **Yes** | Structural bug: the agent tool discovers activities it cannot select. The `enum` constraint and post-filter discard anything outside the initial ranked set. This is broken behavior in the agentic pipeline. |
| **B2** | Include Understanding + ImpactMap in candidate ranking inputs | **Yes** | Two structured artifacts (wizard steps 3–4) are already available on the request body but are never passed to `selectTopActivities`. This is a missing-wiring fix, not a new architecture. |
| **B5** | Return scoring/provenance metadata from candidate ranking | **Yes** | Currently impossible to audit why an activity entered the candidate set. Adding metadata is additive and non-breaking — it prepares the ground for the Sprint 3 CSB without being the CSB. |
| **B4** | Use `technology_id` FK in `fetchActivitiesServerSide` | **Assessment only** | Requires a data-readiness check first. See Section 6. |

---

## 2. Patch Plan by Item

| Item | Files to modify | Exact change type | Risk | Needs feature flag? | Test needed |
|------|----------------|-------------------|------|---------------------|-------------|
| **B1** | `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | Mutate `validActivityCodes` array in `llmWithTools` when `search_catalog` discovers new codes; rebuild response schema with updated codes before final structured-output call; update post-filter `validCodes` set to include discovered codes | Low — agentic pipeline only, behind existing `AI_AGENTIC=true` flag | No — already gated by `AI_AGENTIC` env var | Yes — unit test for enum expansion |
| **B2** | `netlify/functions/lib/activities.ts` (signature + scoring), `netlify/functions/ai-estimate-from-interview.ts` (call site ~L447), `netlify/functions/ai-requirement-interview.ts` (call site ~L453) | Add two optional params to `selectTopActivities`; extract keywords from Understanding + ImpactMap with weight +1.5; pass artifacts at both call sites | Low — additive keyword sources, same output type | No — additive, scoring order may change but that is the intended fix | Yes — unit test for keyword extraction + regression snapshot |
| **B5** | `netlify/functions/lib/activities.ts` (return type + new type export), `netlify/functions/ai-estimate-from-interview.ts` (consumer), `netlify/functions/ai-requirement-interview.ts` (consumer) | New `RankedActivity` type; `selectTopActivities` returns `RankedActivity[]` instead of `Activity[]`; consumers unwrap `.activity` or spread. Log scores in metrics. | Low — type change is additive; downstream consumers extract the `Activity` shape | No | Yes — type compatibility test |
| **B4** | None (assessment only) | N/A | N/A | N/A | N/A |

---

## 3. B1 Deep Dive — `search_catalog` Contradiction Fix

### Flow trace

1. **`validActivityCodes` is initialized** at `ai-estimate-from-interview.ts:478`:  
   ```
   validActivityCodes: agentActivities.map(a => a.code)
   ```  
   This is locked to the output of `selectTopActivities` (~20 codes).

2. **`validActivityCodes` is passed** to `llmWithTools` at `agent-orchestrator.ts:745` and to `llmDirect` at `agent-orchestrator.ts:751`.

3. **Inside `llmWithTools`** (`agent-orchestrator.ts:330`), the array is received as a parameter and used in two places:
   - **Response schema enum** at `agent-orchestrator.ts:389` (final structured-output call): `buildResponseSchema(validActivityCodes)` → `code: { type: 'string', enum: validActivityCodes }`. Any code not in this enum is rejected by OpenAI's structured output.
   - **Recovery schema** at `agent-orchestrator.ts:470`: same `buildResponseSchema(validActivityCodes)`.
   
4. **Post-generation filter** at `agent-orchestrator.ts:758–760`:  
   ```ts
   const validCodes = new Set(input.validActivityCodes);
   draft.activities = draft.activities.filter(a => validCodes.has(a.code));
   ```  
   This runs on the initial `input.validActivityCodes`, not any updated set.

5. **Post-refine filter** at `agent-orchestrator.ts:848–850` repeats the same pattern using the stale `validCodes` set.

6. **`search_catalog` returns discovered activities** at `agent-tools.ts:227–237`:  
   Returns `{ activities: [...], count, method }` where each activity has `code`, `name`, `baseHours`, etc. These codes may not be in `validActivityCodes`.

7. **The discovered codes are never merged** into `validActivityCodes`.

### Fix plan

| Concern | Required change | File |
|---------|----------------|------|
| `validActivityCodes` is immutable after init | Convert `validActivityCodes` from a function parameter to a **mutable local `let` binding** inside `llmWithTools`. Initialize from `input.validActivityCodes`. | `agent-orchestrator.ts` (L334, variable binding) |
| `search_catalog` results are not captured for enum expansion | After each `search_catalog` tool call result is received, extract the `activities[].code` values from the result and **merge new codes** into the local `validActivityCodes` array (deduplicated). | `agent-orchestrator.ts` (inside the tool-call loop, ~L440–450) |
| Discovered activities must also enter the candidate list, not just the valid-codes enum | When `search_catalog` returns activities, those with codes NOT already in `input.activities` must be **appended to `toolCtx.activitiesCatalog`** with their full `AgentActivity` shape. This ensures the agent's context includes the full record for any activity it discovered. | `agent-orchestrator.ts` (same location) + `agent-tools.ts` (`executeSearchCatalog` return shape already has all needed fields) |
| Response schema must use the **updated** codes at final-answer time | The `buildResponseSchema(validActivityCodes)` call at `agent-orchestrator.ts:389` already reads the variable — if it's a mutable `let`, it will automatically pick up expanded codes. Same for the recovery schema at L470. Verify no stale closure captures. | `agent-orchestrator.ts` (L389, L470) — verify, no code change needed if binding is `let` |
| Post-generation filter uses stale `input.validActivityCodes` | Change `const validCodes = new Set(input.validActivityCodes)` at L758 to use the **local expanded** `validActivityCodes` instead. | `agent-orchestrator.ts` (L758) |
| Post-refine filter uses same stale set | Same fix at L850. | `agent-orchestrator.ts` (L850) |
| `llmDirect` path (non-tool-use) is not affected | `llmDirect` receives `validActivityCodes` and builds one schema — no tool loop. **No change needed**. | None |
| Existing agent loop must not break | The fix is purely additive: more codes may enter the valid set during the tool loop. The AI already has `search_catalog` results in its message context. The only change is that it can now actually *select* those codes in its final response. | N/A |

### Minimal safe fix for B1

Convert `validActivityCodes` from an immutable parameter to a mutable local `let` array inside `llmWithTools`. After each `search_catalog` tool-call result, parse the returned activity codes and merge any new ones into the array (and into `toolCtx.activitiesCatalog`). Update the two post-filter sites (L758, L850) to read the expanded set instead of `input.validActivityCodes`. The response schema builder already reads the variable — making it mutable is sufficient. Log the expansion count. `llmDirect` is untouched. The existing `AI_AGENTIC=true` env flag gates the entire agentic path, so this fix has zero production impact when the flag is off.

---

## 4. B2 Deep Dive — Structured Artifacts into Ranking

### Field extraction plan

| Artifact | Fields to use now | Extraction strategy | Weight | Notes |
|----------|------------------|-------------------|--------|-------|
| **Understanding** | `businessObjective`, `expectedOutput`, `functionalPerimeter[]`, `exclusions[]` | Keyword extraction: concatenate text fields, split on non-alphanumeric, filter words < 3 chars, lowercase, deduplicate into a keyword set. Same approach already used for `description` and `answers`. | **+1.5** per keyword match | Skip `actors`, `stateTransition`, `preconditions`, `assumptions` — these are too generic and add noise ("utente", "sistema", "prima", "dopo"). `complexityAssessment` is a judgment, not a keyword source. |
| **ImpactMap** | `summary`, `impacts[].components[]`, `impacts[].layer`, `impacts[].action` | Same keyword extraction. `components[]` are the highest-value field — they are architecture-oriented nouns like "approval service", "order entity". `layer` values (`frontend`, `logic`, `data`, `integration`, `automation`, `configuration`, `ai_pipeline`) are included as they directly map to activity groups. `action` values (`read`, `modify`, `create`, `configure`) are included at lower weight. | **+1.5** for `components`/`layer` keywords; **+1.0** for `summary`/`action` keywords | `reason` field is a sentence that often echoes the description — skip to avoid double-counting. `confidence` is numeric — skip. |

### Noise control

- **Why not +2?** Blueprint already occupies the +2 tier. Understanding and ImpactMap are *earlier* artifacts, generated before the Blueprint, and are less structurally precise. Giving them +1.5 ensures they contribute without overriding Blueprint's structural authority.
- **Why not include all fields?** Fields like `actors[].role`, `assumptions`, and `preconditions` contain common Italian/English words ("utente", "configurazione", "prima") that would match too many activities, diluting the signal. Restrict to fields with domain-specific vocabulary.
- **Same keyword extraction as existing code:** No new algorithm or NLP. Reuse the exact `split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2)` pattern already in `selectTopActivities`.

### Signature change

```typescript
// Current
export function selectTopActivities(
    activities: Activity[],
    description: string,
    answers: Record<string, InterviewAnswerRecord> | undefined,
    topN?: number,
    blueprint?: Record<string, unknown>
): Activity[]

// After B2
export function selectTopActivities(
    activities: Activity[],
    description: string,
    answers: Record<string, InterviewAnswerRecord> | undefined,
    topN?: number,
    blueprint?: Record<string, unknown>,
    understanding?: Record<string, unknown>,
    impactMap?: Record<string, unknown>
): Activity[]  // return type changes in B5, not here
```

New optional params at the end — all existing callers are unaffected.

### Call site changes

| File | Line | Current call | Change |
|------|------|-------------|--------|
| `ai-estimate-from-interview.ts` | ~L447 | `selectTopActivities(fetchResult.activities, sanitizedDescription, body.answers, 20, body.estimationBlueprint)` | Add `, body.requirementUnderstanding, body.impactMap` as 6th and 7th args |
| `ai-requirement-interview.ts` | ~L453 | `selectTopActivities(fetchResult.activities, sanitizedDescription, undefined, 20, body.estimationBlueprint)` | Add `, body.requirementUnderstanding, body.impactMap` as 6th and 7th args |

Both call sites already have `body.requirementUnderstanding` and `body.impactMap` available — confirmed on the `RequestBody` interfaces at `ai-estimate-from-interview.ts:114–116` and `ai-requirement-interview.ts:75–77`.

### Minimal safe fix for B2

Add two optional parameters (`understanding?: Record<string, unknown>`, `impactMap?: Record<string, unknown>`) to the end of `selectTopActivities`. Inside the function, extract keywords from Understanding (`businessObjective`, `expectedOutput`, `functionalPerimeter`, `exclusions`) and ImpactMap (`summary`, `impacts[].components`, `impacts[].layer`, `impacts[].action`) using the same tokenization pattern already in the function. Create two new keyword sets (`understandingKeywords`, `impactMapKeywords`). In the scoring loop, add +1.5 for each Understanding keyword match and +1.5 for each ImpactMap keyword match. Pass the artifacts at both call sites. No new types, no new modules, no behavioral change when artifacts are `undefined`.

---

## 5. B5 Deep Dive — Provenance Metadata

### New type shape

```typescript
/** Scored activity with provenance metadata from candidate ranking */
export interface RankedActivity {
    /** The original activity */
    activity: Activity;
    /** Total score from keyword matching */
    score: number;
    /** Which artifacts contributed to this activity's inclusion */
    matchedSources: ArtifactMatch[];
}

export interface ArtifactMatch {
    /** Which input source contributed */
    source: 'description' | 'answers' | 'understanding' | 'impactMap' | 'blueprint';
    /** Number of keyword matches from this source */
    matchCount: number;
}
```

### What to include now vs defer

| Aspect | Proposal |
|--------|----------|
| **Return type** | `RankedActivity[]` — wraps `Activity` with `score` and `matchedSources`. |
| **`score`** | The total keyword score (same as currently computed but discarded). No cost to expose. |
| **`matchedSources`** | Array of `{ source, matchCount }` — one entry per artifact that contributed ≥1 match. Implemented by tracking per-source scores during the existing scoring loop (5 counters instead of 1). |
| **What NOT to include** | Individual matched keywords (`matchedKeywords: string[]`). Useful for deep debugging but adds array allocation per activity per keyword. Defer to Sprint 2/3 when the CSB formalizes provenance. |
| **What NOT to include** | Expansion-rule attribution. Defer — expansion rules are a Sprint 2 item. |
| **What NOT to include** | Persistence of provenance to database. Sprint 1 logs to console/metrics object only. |

### Consumer unwrapping

```typescript
// ai-estimate-from-interview.ts — after calling selectTopActivities
const rankedResults = selectTopActivities(/* ... */);

// Extract Activity[] for downstream (backward-compatible)
const rankedActivities = rankedResults.map(r => r.activity);

// Log provenance for observability
const provenance = rankedResults.map(r => ({
    code: r.activity.code,
    score: r.score,
    sources: r.matchedSources.map(s => `${s.source}(${s.matchCount})`).join(', ')
}));
console.log('[ranking] Provenance:', JSON.stringify(provenance));
```

Same pattern in `ai-requirement-interview.ts`.

### Minimal safe fix for B5

Define `RankedActivity` and `ArtifactMatch` types in `activities.ts`. Change `selectTopActivities` to return `RankedActivity[]` instead of `Activity[]`. Inside the scoring loop, maintain per-source counters alongside the existing total score. After scoring, return `{ activity, score, matchedSources }` instead of just the activity. Update both consumers to unwrap via `.map(r => r.activity)` for downstream compatibility and log the provenance to the metrics/console. When `activities.length <= topN` (the early-return path), return all activities with `score: 0` and empty `matchedSources` — preserving the existing short-circuit behavior.

---

## 6. B4 Readiness Decision

### Data-readiness assessment

| Check | Result | Evidence | Decision impact |
|-------|--------|----------|----------------|
| **`technology_id` column exists on `activities`** | Yes | Migration `20260301_canonical_technology_model.sql`: `ALTER TABLE activities ADD COLUMN IF NOT EXISTS technology_id UUID REFERENCES technologies(id)` | Column is available |
| **Backfill has been applied** | Schema says yes | Migration STEP 2: `UPDATE activities a SET technology_id = t.id FROM technologies t WHERE a.tech_category = t.code AND a.technology_id IS NULL` + MULTI backfill. Migration also warns on orphans. | Data *should* be populated — but depends on whether migration has actually run in production |
| **Can we verify at runtime?** | **No** | There is no runtime check or log that confirms `technology_id IS NOT NULL` for all active activities. The migration has an orphan counter but it runs once at deploy time. | Cannot guarantee production state without querying the live DB |
| **`fetchActivitiesServerSide` select clause includes `technology_id`?** | **No** | Current select: `'code, name, description, base_hours, group, tech_category'`. Does not select `technology_id`. | Even if the column is populated, the current query doesn't read it |
| **`techPresetId` param is used in any query?** | **No** | The param is accepted but never referenced in the Supabase query at `activities.ts:74–78`. | The FK filtering path is entirely unwired |
| **Existing logic depends on `tech_category` string matching** | **Yes** | `.or('tech_category.eq.${techCategory},tech_category.eq.MULTI')` at `activities.ts:78`. Also used in `agent-tools.ts` keyword fallback and throughout prompt formatting. | Switching to FK-based filtering would change the semantic of "which activities are visible" — must be equivalent before switching |
| **Would FK-based filtering change behavior?** | **Unknown** | If any active activity has `technology_id IS NULL` (orphan from backfill), it would be excluded by an FK-based query but included by the current `tech_category` string query. The migration warns about this but doesn't prevent it. | Risk of silently excluding activities if backfill was incomplete |
| **`technology_activities` pivot table has data?** | **No** | `supabase_seed.sql` has no `technology_activities` inserts. The table has override columns but zero rows. | The JOIN path adds nothing today |
| **Sync trigger exists** | Yes | Migration `20260301`: `trg_sync_activity_tech_category` keeps `tech_category` in sync when `technology_id` is updated. | Dual-write is safe — but only in one direction (technology_id → tech_category) |

### Verdict: **Defer**

Introducing `technology_id`-based filtering in Sprint 1 carries a **silent data correctness risk**: if any production activity row has `technology_id IS NULL` (which the migration explicitly warns about), FK-based filtering would silently exclude it while the current string-based query includes it. We cannot verify the production data state from code alone.

The correct sequence is:
1. Add a runtime health check that warns if any active activity has `NULL technology_id` (can be a startup log in `fetchActivitiesServerSide`)
2. Confirm zero orphans in production
3. Then switch to FK-based filtering in Sprint 2, behind a feature flag

**Sprint 1 action**: Add a one-time diagnostic log to `fetchActivitiesServerSide` that counts activities with `technology_id IS NULL`. This is read-only observability, no behavioral change.

---

## 7. Test Plan

| # | Test | Type | What it proves |
|---|------|------|----------------|
| T1 | **B1: search_catalog expansion** — Mock `search_catalog` returning 3 activities not in the initial `validActivityCodes`. Assert that after the tool-call loop, the expanded codes set contains the new codes AND the response schema includes them in the `enum`. | Unit test | That discovered activities become selectable by the AI |
| T2 | **B2: Understanding/ImpactMap keyword influence** — Call `selectTopActivities` with identical `description`/`answers`/`blueprint` but (a) without Understanding/ImpactMap and (b) with Understanding containing keywords that match a specific activity. Assert the target activity ranks higher in case (b). | Unit test | That structured artifacts shift candidate ranking |
| T3 | **B5: Provenance metadata shape** — Call `selectTopActivities` with known inputs. Assert return value is `RankedActivity[]` with valid `score` (≥ 0) and `matchedSources` array. Assert `.map(r => r.activity)` produces the same `Activity[]` as the previous function version would. | Unit test | That the new return type is correct and backward-compatible |
| T4 | **Regression: estimate stability** — Run the full estimation flow (non-agentic linear path) with a reference requirement + answers + blueprint. Capture the generated `validActivityCodes` list and the total estimation output. Assert the activity set is a **superset** of the previous output (Understanding/ImpactMap can only add keywords, never remove them). Assert base-days delta is within ±10% of a known baseline. | Integration test | That B2 + B5 changes don't regress the non-agentic estimation path |

### Testing notes

- **B1 tests** require mocking the OpenAI tool-call loop. The test does not need a live LLM — it verifies the expansion logic around the loop.
- **B2 tests** are pure function tests against `selectTopActivities` — no network, no LLM.
- **B5 tests** are pure function tests — same as B2 but with type assertions.
- **T4** is the critical safety net. It should run against a snapshot of known inputs/outputs to detect if the ranking changes produce materially different estimations.

---

## 8. Sprint 1 Final Recommendation

**Implement now:** Fix `search_catalog` expansion lock (B1) — convert `validActivityCodes` to mutable, merge discovered codes, update post-filters. Pass Understanding + ImpactMap to `selectTopActivities` (B2) — two optional params, keyword extraction with +1.5 weight. Return scoring metadata (B5) — `RankedActivity` type with `score` + `matchedSources`, consumers unwrap `.activity`.

**Defer for now:** `technology_id` FK in `fetchActivitiesServerSide` (B4) — cannot verify production data-readiness from code. Add a diagnostic log instead.

**Do not touch yet:** `AgentInput` restructuring (B3), expansion rules, coverage validator, `breakdown.byGroup`, Candidate-Set Builder module, `technology_activities` JOIN — all Sprint 2+.

---

## 9. Correction Pass (2026-03-11)

This section supersedes conflicting statements in Sections 0–8 above. Where a conflict exists, this section is authoritative.

### 9.1 Corrected File Inventory

**Runtime files (unique):**

| # | File | Why touched | Sprint 1 item |
|---|------|-------------|---------------|
| 1 | `netlify/functions/lib/activities.ts` | New types (`ArtifactMatch`, `RankedActivity`); new `rankActivitiesWithProvenance` helper; Understanding + ImpactMap keyword extraction in `selectTopActivities`; B4 diagnostic in `fetchActivitiesServerSide` | **B2, B5, B4** |
| 2 | `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | Mutable `validActivityCodes` in `llmWithTools`; merge discovered codes from `search_catalog`; propagate `expandedCodes` return; update 2 post-filters in `runAgentPipeline` | **B1** |
| 3 | `netlify/functions/ai-estimate-from-interview.ts` | Pass `body.requirementUnderstanding` + `body.impactMap` to `selectTopActivities`; log provenance from `rankActivitiesWithProvenance` | **B2, B5** |
| 4 | `netlify/functions/ai-requirement-interview.ts` | Same as above: pass artifacts, log provenance | **B2, B5** |

**4 unique runtime files. No new runtime files created.**

**Test files (new):**

| # | File | Covers |
|---|------|--------|
| T1 | `src/test/ranking-provenance.test.ts` | B2 keyword influence, B5 provenance shape, early-return path |
| T2 | `src/test/search-catalog-expansion.test.ts` | B1 enum expansion + catalog merge |
| T3 | `src/test/ranking-regression.test.ts` | Regression: top-5 stability, score monotonicity |

**3 new test files.**

Previous Section 0.1 listed `activities.ts` twice and stated "5 files total." The corrected count is **4 unique runtime files + 3 test files**.

---

### 9.2 Reclassified B5 — Contract Impact Assessment

| Concern | Revised assessment | Why |
|---------|--------------------|-----|
| Is B5 truly additive? | **No — it is a contract change.** Changing `selectTopActivities(): Activity[]` → `RankedActivity[]` changes the function's public return type. Every consumer must update or it is a type error. | Even though there are only 2 consumers, the change is a **breaking signature modification**, not additive. Using "additive" in Section 0.2 was misleading. |
| Hidden call sites that could break? | **None found.** Exhaustive search confirmed: only `ai-estimate-from-interview.ts` (L447) and `ai-requirement-interview.ts` (L453) import/call `selectTopActivities`. Zero call sites in `src/`. Zero in test files. | The blast radius is small (2 files) but nonzero. |
| Existing tests that would break? | **None.** No test file references `selectTopActivities`. | No test regression from the type change, but also no test coverage to catch regressions if the unwrap is botched. |
| Should B5 stay in Sprint 1? | **Yes — but with a safer shape.** See recommendation below. | The provenance data is needed in Sprint 1 for observability. The risk is in *how* we expose it. |

**Alternatives considered:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A: Change `selectTopActivities` return to `RankedActivity[]` directly | Single function, no new API surface | Contract break; every consumer must unwrap `.activity`; if a third consumer appears pre-merge, it breaks silently | ❌ Rejected |
| B: Keep `selectTopActivities(): Activity[]` unchanged; add new `rankActivitiesWithProvenance(): RankedActivity[]` helper | Zero contract change; existing callers untouched; new callers opt in | Two ranking paths to maintain; ranking logic is duplicated or one calls the other | ⚠️ Partial |
| C: Refactor internals — `selectTopActivities` calls `rankActivitiesWithProvenance` internally, strips to `Activity[]`, returns as before. New callers that want provenance call `rankActivitiesWithProvenance` directly. | Zero contract change; no duplication; provenance available to callers that want it; `selectTopActivities` remains `Activity[]` | Slightly more refactoring than Option A | ✅ **Recommended** |

**Final recommendation for B5:**

1. Extract the scoring loop into a new exported function:
   ```typescript
   export function rankActivitiesWithProvenance(
       activities: Activity[],
       description: string,
       answers: Record<string, InterviewAnswerRecord> | undefined,
       topN: number = 20,
       blueprint?: Record<string, unknown>,
       understanding?: Record<string, unknown>,
       impactMap?: Record<string, unknown>
   ): RankedActivity[]
   ```

2. Keep `selectTopActivities` with its **original signature and return type** (`Activity[]`). Internally it calls `rankActivitiesWithProvenance(…).map(r => r.activity)`.

3. In `ai-estimate-from-interview.ts` and `ai-requirement-interview.ts`, call `rankActivitiesWithProvenance` directly (imported alongside `selectTopActivities`). Use the `RankedActivity[]` result for provenance logging, then extract `Activity[]` via `.map(r => r.activity)` for downstream.

4. **No existing call site changes its contract.** If any future code calls `selectTopActivities`, it still gets `Activity[]`.

This is Option C. It is the safest Sprint 1 shape.

**Impact on Section 0.4–0.6 patch orders:**
- B2 keyword extraction goes into `rankActivitiesWithProvenance` (not `selectTopActivities`).
- B5 types stay in `activities.ts`.
- `selectTopActivities` becomes a thin wrapper.
- Consumer call sites in both endpoint files change from `selectTopActivities(…)` to `rankActivitiesWithProvenance(…)` and extract `.map(r => r.activity)`.

---

### 9.3 B1 Shape Compatibility Verification

The B1 merge block appends discovered activities into `toolCtx.activitiesCatalog` (type `AgentActivity[]`). The source is `search_catalog`'s return (both pgvector and keyword-fallback paths). Here is the verified field-by-field comparison:

| Field | `AgentActivity` (target) | `search_catalog` returned object | Compatible as-is? | Required mapping |
|-------|--------------------------|----------------------------------|--------------------|-----------------|
| `code` | `code: string` | `code: string` | ✅ Yes | None |
| `name` | `name: string` | `name: string` | ✅ Yes | None |
| `description` | `description: string` | `description: string` | ✅ Yes | None |
| `base_hours` | `base_hours: number` | **`baseHours: number`** | ❌ **No** — field name mismatch | `base_hours: a.baseHours` |
| `group` | `group: string` | `group: string` | ✅ Yes | None |
| `tech_category` | `tech_category: string` | **`techCategory: string`** | ❌ **No** — field name mismatch | `tech_category: a.techCategory` |
| `technology_id` | `technology_id?: string \| null` | Not returned | ✅ OK — optional field | Omit or set `undefined` |
| `similarity` | Not in AgentActivity | `similarity: number` | ✅ OK — extra field ignored | Drop (not needed) |

**Verdict:** The previous plan in Section 0.4 Step 3 used `a.baseHours ?? a.base_hours` and `a.techCategory || a.tech_category` — this defensive double-check was correct but imprecise about *which* name is authoritative. The corrected mapping is:

```typescript
// Corrected B1 merge — inside tool-call loop after search_catalog result
if (toolName === 'search_catalog' && result?.activities && Array.isArray(result.activities)) {
    const existingCodes = new Set(validActivityCodes);
    const newCodes = result.activities
        .filter((a: any) => a.code && !existingCodes.has(a.code));
    if (newCodes.length > 0) {
        for (const a of newCodes) {
            validActivityCodes.push(a.code);
        }
        const catalogCodes = new Set(toolCtx.activitiesCatalog.map(x => x.code));
        for (const a of newCodes) {
            if (!catalogCodes.has(a.code)) {
                toolCtx.activitiesCatalog.push({
                    code: a.code,
                    name: a.name,
                    description: a.description || '',
                    base_hours: a.baseHours,       // ← camelCase → snake_case
                    group: a.group || 'UNKNOWN',
                    tech_category: a.techCategory,  // ← camelCase → snake_case
                });
            }
        }
        console.log(`[agent] search_catalog expansion: +${newCodes.length} codes → validActivityCodes now ${validActivityCodes.length}`);
    }
}
```

The previous plan's `a.baseHours ?? a.base_hours ?? 0` fallback chain is replaced with the definitive mapping `a.baseHours` (the only name `search_catalog` returns). The `?? 0` fallback is dropped — `baseHours` is always present in both the pgvector and keyword-fallback return paths (verified at `agent-tools.ts:246` and `agent-tools.ts:281`).

---

### 9.4 B4 Diagnostic Design Fix

The previous plan placed the diagnostic query inside `fetchActivitiesServerSide`, which runs **on every estimation and interview request** — not "one-time." This is wasteful for a diagnostic whose answer changes only when migrations run.

| Option | Recommendation | Why |
|--------|----------------|-----|
| Per-request query (current plan) | ❌ Rejected | Adds a DB round-trip to every request for information that changes only at deploy time. |
| Per-process once (module-level singleton) | ⚠️ Possible | Netlify functions are short-lived (cold start per invocation in many cases), so "per-process" ≈ "per-request" in practice. Not reliably "once." |
| Feature-flagged diagnostic | ⚠️ Over-engineered | Adds env-var plumbing for a temporary diagnostic. |
| **Guarded-once with closure** | ✅ **Recommended** | A module-scoped `let checked = false` guard ensures the diagnostic runs **at most once per function instance**. In Netlify's model, warm instances reuse the module scope — so the check runs once on cold start and is skipped on warm reuse. On cold starts it runs once. Worst case (always cold) it runs once per request — same as the original plan but with a guard. Best case (warm reuse) it runs once across many requests. |

**Revised B4 implementation:**

```typescript
// At module scope in activities.ts
let _techIdDiagnosticDone = false;

// Inside fetchActivitiesServerSide, after successful DB fetch:
if (!_techIdDiagnosticDone && supabase) {
    _techIdDiagnosticDone = true;
    try {
        const { count } = await supabase
            .from('activities')
            .select('code', { count: 'exact', head: true })
            .eq('active', true)
            .is('technology_id', null);
        if (count && count > 0) {
            console.warn(`[server-fetch] WARNING: ${count} active activities have NULL technology_id — FK filtering not safe yet`);
        }
    } catch {
        // Non-blocking: diagnostic failure must not affect the main path
    }
}
```

This is the smallest safe design: zero new infrastructure, no env vars, no feature flags, and self-limiting to one execution per function instance.

---

### 9.5 T4 Regression Test Redesign

| Test goal | Old assertion | Problem | Revised assertion |
|-----------|--------------|---------|-------------------|
| Verify B2+B5 changes don't regress the non-agentic estimation path | "The new activity set should be a **superset** of the old activity set" | **False.** `topN=20` is enforced. If new artifact keywords boost previously-unranked activities into the top 20, other activities are pushed out. The set is not a superset — it is a top-N slice of a differently-scored population. A newly correct ranking may legitimately exclude previously included activities. | **Intersection stability**: the top-5 activities (highest-scoring) from the baseline run must **all still appear** in the new top-20. The rationale: high-scoring activities have strong keyword overlap with the description/answers/blueprint; adding Understanding/ImpactMap keywords can only add more match signal, not remove existing signal. So the top-5 should remain in the top-20 even if their exact rank shifts. Additionally: the **total score of the top-20** must be ≥ the baseline total score (monotonic — new keywords can only add, never subtract). |

**Revised T4 test:**

```typescript
describe('T4: Ranking regression', () => {
    const baselineTop5Codes = ['PP_REQ', 'PP_ANAL', 'BE_API', 'BE_DB', 'FE_COMP']; // snapshot
    const baselineTop20TotalScore = 42.5; // snapshot from pre-B2 run

    it('top-5 baseline activities remain in top-20 after B2', () => {
        const ranked = rankActivitiesWithProvenance(
            testActivities,
            testDescription,
            testAnswers,
            20,
            testBlueprint,
            testUnderstanding,
            testImpactMap
        );
        const top20Codes = ranked.map(r => r.activity.code);
        for (const code of baselineTop5Codes) {
            expect(top20Codes).toContain(code);
        }
    });

    it('total score is monotonically non-decreasing', () => {
        const ranked = rankActivitiesWithProvenance(/* same args */);
        const totalScore = ranked.reduce((sum, r) => sum + r.score, 0);
        expect(totalScore).toBeGreaterThanOrEqual(baselineTop20TotalScore);
    });
});
```

**Why this is stable:**
- **Intersection check (top-5 in top-20)** tolerates rank shuffling within the top-20 but catches catastrophic regressions where core activities fall off entirely.
- **Score monotonicity** catches the (impossible-in-theory-but-verify-anyway) case where artifact keywords somehow reduce total relevance.
- **No superset assumption** — acknowledges that lower-ranked activities at positions 16–20 may change.

---

### 9.6 Corrections to Sprint 1 Patch Plan — Summary Table

| Previous plan point | Status | Corrected version |
|---------------------|--------|-------------------|
| "5 files total" — `activities.ts` listed twice | ❌ Wrong | **4 unique runtime files** (activities.ts, agent-orchestrator.ts, ai-estimate-from-interview.ts, ai-requirement-interview.ts) + 3 test files |
| B5 classified as "additive" / "None — additive" risk | ❌ Understated | B5 is a **contract change** (`Activity[]` → `RankedActivity[]`). Mitigated by **Option C**: keep `selectTopActivities(): Activity[]` unchanged; add `rankActivitiesWithProvenance(): RankedActivity[]`; consumers call the new function directly |
| B1 catalog merge uses `a.baseHours ?? a.base_hours ?? 0` and `a.techCategory || a.tech_category || 'MULTI'` | ⚠️ Imprecise | `search_catalog` always returns `baseHours` (camelCase) and `techCategory` (camelCase). Corrected mapping: `base_hours: a.baseHours`, `tech_category: a.techCategory`. No fallback chain needed. |
| B4 diagnostic described as "one-time" but placed per-request | ❌ Wrong | Guarded-once with module-scoped `let _techIdDiagnosticDone = false`. Runs at most once per function instance. |
| T4 asserts "activity set is a superset" | ❌ False under topN | Revised: **top-5 baseline codes must appear in new top-20** + **total score monotonically non-decreasing**. No superset claim. |
| `selectTopActivities` return type changes to `RankedActivity[]` in Section 0.6 Step 6 | ❌ Superseded | `selectTopActivities` **keeps `Activity[]` return type**. It becomes a thin wrapper over `rankActivitiesWithProvenance`. B2 keyword extraction lives in `rankActivitiesWithProvenance`. |
| Section 0.9 implementation sequence Step 2 says "callers now have a type error" | ❌ Superseded | With Option C, callers never see a type error. `selectTopActivities` is never changed externally. Consumers switch to `rankActivitiesWithProvenance` at their own pace. |

**Sprint 1 is ready to implement with these corrections.**
