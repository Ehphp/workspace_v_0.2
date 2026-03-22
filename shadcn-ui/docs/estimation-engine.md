# Estimation Engine

## Overview

The estimation engine is a **deterministic calculation module**. Given the same inputs, it always produces the same outputs. The engine does not use AI; all calculations follow explicit formulas.

**Source file**: [src/lib/estimationEngine.ts](../src/lib/estimationEngine.ts)

---

## Formula

```
Total Days = Subtotal × (1 + Contingency%)

Where:
  Subtotal = Base Days × Driver Multiplier
  Base Days = Σ(activity.base_hours) / 8
  Driver Multiplier = Π(driver.multiplier)
  Contingency% = f(Risk Score)
  Risk Score = Σ(risk.weight)
```

---

## Step-by-Step Calculation

### Step 1: Base Days

Sum all selected activities' `base_hours`, then convert to days (8 hours/day).

```typescript
function calculateBaseDays(activities: SelectedActivity[]): number {
  const totalHours = activities.reduce((sum, a) => sum + a.baseHours, 0);
  return totalHours / 8.0;
}
```

**Example**:
- Activity A: 16 hours
- Activity B: 8 hours
- Activity C: 4 hours
- **Base Days** = (16 + 8 + 4) / 8 = **3.5 days**

---

### Step 2: Driver Multiplier

Multiply all selected driver multipliers together.

```typescript
function calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
  if (drivers.length === 0) return 1.0;
  return drivers.reduce((product, d) => product * d.multiplier, 1.0);
}
```

**Example**:
- Complexity: High (1.5x)
- Integration: Medium (1.2x)
- **Driver Multiplier** = 1.5 × 1.2 = **1.8x**

---

### Step 3: Subtotal

```
Subtotal = Base Days × Driver Multiplier
```

**Example**:
- Base Days: 3.5
- Driver Multiplier: 1.8
- **Subtotal** = 3.5 × 1.8 = **6.3 days**

---

### Step 4: Risk Score

Sum the weights of all selected risks.

```typescript
function calculateRiskScore(risks: { weight: number }[]): number {
  return risks.reduce((sum, r) => sum + r.weight, 0);
}
```

**Example**:
- Risk 1: weight 5
- Risk 2: weight 10
- **Risk Score** = 5 + 10 = **15**

---

### Step 5: Contingency Percentage

Contingency is determined by risk score thresholds:

| Risk Score | Contingency |
|------------|-------------|
| ≤0 | 10% (baseline) |
| 1-10 | 10% |
| 11-20 | 15% |
| 21-30 | 20% |
| 31+ | 25% |

> **Note**: A 10% baseline contingency is always applied, even with zero risks.

```typescript
function calculateContingency(riskScore: number): number {
  // Baseline contingency is always 10%, even with no risks
  if (riskScore <= 0) return 0.10;
  if (riskScore <= 10) return 0.10;
  if (riskScore <= 20) return 0.15;
  if (riskScore <= 30) return 0.20;
  return 0.25;
}
```

**Example**:
- Risk Score: 15
- **Contingency** = **15%**

---

### Step 6: Total Days

```
Total Days = Subtotal × (1 + Contingency%)
```

**Example**:
- Subtotal: 6.3 days
- Contingency: 15%
- **Total Days** = 6.3 × 1.15 = **7.25 days**

---

## Complete Example

| Input | Value |
|-------|-------|
| Activities | A (16h), B (8h), C (4h) |
| Drivers | Complexity=High (1.5x), Integration=Medium (1.2x) |
| Risks | Risk1 (w=5), Risk2 (w=10) |

| Step | Calculation | Result |
|------|-------------|--------|
| Base Days | (16+8+4)/8 | 3.5 |
| Driver Multiplier | 1.5 × 1.2 | 1.8 |
| Subtotal | 3.5 × 1.8 | 6.3 |
| Risk Score | 5 + 10 | 15 |
| Contingency | f(15) | 15% |
| **Total Days** | 6.3 × 1.15 | **7.25** |

---

## API

### Input Type

```typescript
interface EstimationInput {
  activities: Array<{ baseHours: number }>;
  drivers: Array<{ multiplier: number }>;
  risks: Array<{ weight: number }>;
}
```

### Output Type

```typescript
interface EstimationResult {
  baseDays: number;
  driverMultiplier: number;
  subtotal: number;
  riskScore: number;
  contingencyPercent: number;  // e.g., 15 for 15%
  contingencyDays: number;
  totalDays: number;
  breakdown: {
    byGroup: Record<string, number>;
    byTech: Record<string, number>;
  };
}
```

### Usage

```typescript
import { calculateEstimation } from '@/lib/estimationEngine';

const result = calculateEstimation({
  activities: [{ baseHours: 16 }, { baseHours: 8 }],
  drivers: [{ multiplier: 1.2 }],
  risks: [{ weight: 5 }],
});

console.log(result.totalDays); // Deterministic output
```

---

## Estimation Flows

The system provides three distinct entry points for creating estimations, each using the same deterministic engine but with different levels of automation.

### Flow Comparison

| Aspect | **AI Bulk Estimate** | **Wizard** | **Manual Edit** |
|--------|---------------------|------------|-----------------|
| File | `BulkEstimateDialog.tsx` | `RequirementWizard.tsx` | `RequirementDetail.tsx` |
| Entry Point | "Stima Tutti" button | "Nuovo Requisito" button | Estimation tab |
| AI Endpoint | `ai-suggest` | Interview + `ai-suggest` | `ai-suggest` (optional) |
| Activities | AI-suggested | AI-suggested + manual | Manual + AI optional |
| Drivers | Neutral defaults | User-selected via wizard | User-selected |
| Risks | None (no template) | User-selected via wizard | User-selected |
| `scenario_name` | `"AI Bulk Estimate"` | `"Wizard"` | `"Manual Edit"` |
| User Interaction | Zero (automatic) | 8-step wizard | Full manual control |
| Save Function | `saveEstimationByIds()` | `saveEstimationByIds()` | `saveEstimationByIds()` |
| Domain Chain | No | Yes (orchestrate + snapshot) | Yes (orchestrate + snapshot) |
| Persistence | RPC `save_estimation_atomic` | RPC `save_estimation_atomic` | RPC `save_estimation_atomic` |

### Flow Details

#### 1. AI Bulk Estimate (Stima Tutti)

Fast batch processing for multiple requirements:

1. Pre-loads all catalogs (activities, drivers, risks, technologies) once
2. For each requirement in parallel (max 3):
   - Calls `ai-suggest` to get activity recommendations
   - Falls back to empty activity list if AI returns none
   - Uses neutral driver defaults (no template overrides)
   - Calculates estimation with full formula
   - Saves automatically

**Use case**: Quick initial estimates for imported requirements.

#### 2. Wizard (Nuovo Requisito)

Guided creation with AI artifacts + interview:

1. **Step 1**: Enter requirement description
2. **Step 2**: Select technology
3. **Step 3**: AI Requirement Understanding
4. **Step 4**: AI Impact Map
5. **Step 5**: AI Estimation Blueprint
6. **Step 6**: AI interview (contextual questions)
7. **Step 7**: Review/adjust drivers and risks
8. **Step 8**: Review estimation and save

**Use case**: Creating new requirements with accurate estimates.

#### 3. Manual Edit

Full control over existing requirements:

1. User selects activities, drivers, risks manually
2. Can optionally trigger AI suggestions
3. Real-time calculation updates
4. Explicit save action

**Use case**: Refining estimates or re-estimating requirements.

### Unified Persistence

All three flows now converge on a single save path:

1. **`saveEstimation(input)`** (code-based) — resolves activity/driver/risk codes → UUIDs, then delegates to `saveEstimationByIds()`
2. **`saveEstimationByIds(input)`** (ID-based) — calls `supabase.rpc('save_estimation_atomic')` directly

Bulk Estimate, Manual Edit, and Bulk Interview all call `saveEstimationByIds()` directly because they already have resolved UUIDs. The Wizard uses `saveEstimation()` which wraps the resolution step.

### AI Suggestion Tracking

All flows track which activities were AI-suggested via `is_ai_suggested` flag:

```typescript
p_activities: selectedActivityIds.map(id => ({
    activity_id: id,
    is_ai_suggested: aiSuggestedIds.includes(id),
    notes: null
}))
```

---

## What the Engine Does NOT Do

| Responsibility | Owner |
|----------------|-------|
| Suggest activities | AI (via `ai-suggest.ts`) |
| Validate requirement text | AI + deterministic rules |
| Select drivers/risks | User |
| Store estimations | `saveEstimationByIds()` → Supabase RPC `save_estimation_atomic` |

---

## Precision and Rounding

All outputs are rounded to 2 decimal places except `driverMultiplier` (3 decimals):

```typescript
baseDays: Number(baseDays.toFixed(2)),
driverMultiplier: Number(driverMultiplier.toFixed(3)),
subtotal: Number(subtotal.toFixed(2)),
totalDays: Number(totalDays.toFixed(2)),
```

---

## Testing

The engine is pure (no side effects) and easy to unit test:

```typescript
test('empty activities returns 0 days', () => {
  const result = calculateEstimation({ activities: [], drivers: [], risks: [] });
  expect(result.totalDays).toBe(0);
});

test('single activity with no drivers/risks', () => {
  const result = calculateEstimation({
    activities: [{ baseHours: 8 }],
    drivers: [],
    risks: [],
  });
  expect(result.baseDays).toBe(1);
  expect(result.totalDays).toBe(1); // No contingency when riskScore=0
});
```

---

## Phase 3: Agentic Pipeline Integration

The agentic pipeline (Phase 3) introduces AI self-reflection and tool use, but the estimation engine invariant is **inviolable**. Every agentic estimation passes through `validateWithEngine()` which replicates the SDK's formulas:

```typescript
// agent-orchestrator.ts → VALIDATE state
function validateWithEngine(draft, input): EngineValidationResult {
    const totalHours = draft.activities.reduce((sum, a) => sum + a.baseHours, 0);
    const baseDays = totalHours / 8.0;
    const subtotal = baseDays * driverMultiplier;
    // ... contingency calculation ...
    const totalDays = subtotal + contingencyDays;
    
    // Correct any AI-reported discrepancy
    if (Math.abs(calculatedBaseDays - draft.totalBaseDays) > 0.5) {
        draft.totalBaseDays = calculatedBaseDays;  // Engine overrides AI
    }
}
```

**Guarantee**: Even when the AI uses tools, reflects, and self-corrects, the final numbers are always deterministically verified. The engine serves as the last guardrail against hallucinated totals.

The `validate_estimation` tool also exposes the engine formula to the AI model during generation, allowing it to self-check before the mandatory validation step.

---

## RAG Feedback Loop (Sprint 4 — S4-1)

When historical estimations include **actual hours** (from the S2 consuntivo fields), the RAG module feeds this data back into the AI prompt. This creates a learning loop:

1. `fetchEstimationHistory()` now includes `actual_hours` in its query
2. `deviationPercent` is calculated inline: `(actualHours/8 - totalDays) / totalDays * 100`
3. Historical examples with actuals are **prioritized** in the sort (before similarity ranking)
4. `buildRAGPromptFragment()` appends an `ACTUAL:` line when consuntivo is available
5. `getRAGSystemPromptAddition()` now instructs the AI to weight examples with actuals more heavily

**Impact on accuracy**: The AI sees both the original estimate and the real outcome, allowing it to calibrate future predictions based on historical over/under-estimation patterns.

**Files**: `netlify/functions/lib/ai/rag.ts` (interface + fetch + sort + prompt), `rag-metrics.ts` (`examplesWithActuals` counter).

---

## Export with Actuals (Sprint 4 — S4-2)

The export system (PDF/Excel/CSV) now includes a **Consuntivo** section when `actuals` data is available on an `ExportableEstimation`:

- **PDF**: Green or red box with actual days, deviation %, dates, and a status badge (UNDER / ON TARGET / OVER)
- **Excel (single)**: New sheet "Consuntivo" with actual hours, deviation, dates, notes
- **Excel (bulk)**: Summary table includes "Ore Reali" and "Scostamento %" columns
- **CSV**: Consuntivo section for single exports; actuals columns in bulk table

**Type**: `ExportableEstimation.actuals?: { actualHours, actualDays, deviationPercent, startDate?, endDate?, notes? }`

---

## Domain Model Layer (2026-03-21)

The estimation system now has a **domain-driven architecture** layer alongside the existing UI-driven flow. This provides traceability without breaking backward compatibility.

### Traceability Chain

```
RequirementAnalysis → ImpactMap → CandidateSet → EstimationDecision → Estimation → EstimationSnapshot
```

Every estimation can optionally be traced back through this chain.

### Domain Engine

A pure-function estimation engine lives at `netlify/functions/lib/domain/estimation/estimation-engine.ts`. It mirrors the SDK calculation logic (`computeEstimation()`) for use in backend domain services.

### Domain Services

Located in `netlify/functions/lib/domain/estimation/`:

| Service | Purpose |
|---------|---------|
| `analysis.service.ts` | Create/retrieve RequirementAnalysis records |
| `impact-map.service.ts` | Create/retrieve domain-level ImpactMaps |
| `candidate-set.service.ts` | Build and persist CandidateSet with source/score metadata |
| `decision.service.ts` | Persist EstimationDecisions (selected/excluded activities, drivers, risks) |
| `estimation-engine.ts` | Pure `computeEstimation()` function (same formula as SDK) |
| `snapshot.service.ts` | Create immutable snapshots for reproducibility |
| `save-orchestrator.ts` | Orchestrates the full domain chain during save |

### Save Flow Integration

The existing `save_estimation_atomic` RPC now accepts optional `p_analysis_id` and `p_decision_id` parameters. The `SaveEstimationInput` and `SaveEstimationByIdsInput` types carry `analysisId` and `decisionId`. The domain layer is **additive** — legacy saves without domain IDs continue to work.

#### Wizard Path (active since 2026-03-21)

The **RequirementWizard** is the first save path wired to the full domain chain via `src/lib/domain-save.ts`:

1. Resolve wizard codes → full domain objects (`resolveWizardActivities`, `resolveWizardDrivers`, `resolveWizardRisks`)
2. `orchestrateWizardDomainSave()` → creates `requirement_analyses`, `impact_maps` (optional), `candidate_sets`, `estimation_decisions`
3. `saveEstimation()` with `analysisId` + `decisionId` → RPC `save_estimation_atomic`
4. `finalizeWizardSnapshot()` → creates `estimation_snapshots`

The domain engine (`calculateEstimation`) is the **canonical calculation source** for wizard saves. The UI-computed result is no longer used for persistence.

#### RequirementDetail Manual Edit Path (active since 2026-03-21)

The **RequirementDetail** `confirmSaveEstimation` now runs the same domain chain as the wizard:

1. Resolve UI selections (IDs) → full domain objects (`resolveActivitiesById`, `resolveDriversById`, `resolveRisksById`)
2. `orchestrateWizardDomainSave()` → creates/reuses `requirement_analyses`, `impact_maps` (optional), `candidate_sets`, `estimation_decisions`
3. `saveEstimationByIds()` with `analysisId` + `decisionId` → RPC `save_estimation_atomic`
4. `finalizeWizardSnapshot()` → creates `estimation_snapshots`

Quick Estimate is automatically covered: it fires AI suggestions → user reviews in Estimation tab → clicks "Salva Stima" → same `confirmSaveEstimation` path.

If a RequirementUnderstanding artifact exists for the requirement, it is passed into the domain orchestration for analysis reuse.

#### Other Save Paths (not yet wired)

BulkEstimateDialog and BulkInterviewDialog still call `saveEstimationByIds` without domain IDs. These will be wired in subsequent phases.

### Types

All domain entities are defined in `src/types/domain-model.ts`. The `Estimation` row type in `src/types/database.ts` now includes optional `analysis_id` and `decision_id` fields.

---

## AI Pipeline Performance Optimizations (Quick Wins v2)

The following optimizations reduce end-to-end latency for the AI estimation pipeline
(both legacy and agentic modes) in `ai-estimate-from-interview`:

### Server-Side Activity Fetch & Ranking

Activities are fetched **server-side** from Supabase, filtered by `technology_id` FK (canonical), then ranked by keyword relevance and trimmed to the **top 20**. This reduces:
- Request payload size (no more sending 100+ activities from the browser)
- LLM prompt tokens (compact format: code, name, base_hours, truncated description)
- Client-provided activities are used only as a last-resort fallback on DB failure

**Canonical FK filtering (STEP 3)**: `fetchActivitiesServerSide()` resolves `techPresetId` → `technology_id` via the `technologies` table and filters activities using the FK. No `tech_category` string matching in the main path. An unresolvable `techPresetId` or empty candidate set throws a hard error. Emergency rollback: set `FORCE_LEGACY_ACTIVITY_FETCH=true` env var to revert to `tech_category` string matching without a deploy change.

**Architectural guard (STEP 2)**: Client-side activity filtering by `tech_category` is blocked in new code via ESLint (`no-restricted-syntax`) and a CI guard script (`pnpm guard:legacy`). Known legacy files are in an allowlist — to be cleaned in STEP 4.

**Blueprint-first candidate generation** (Milestone 3 v2, consolidated): When a confirmed Estimation Blueprint is available and mappable (`isBlueprintMappable()`), the system uses `mapBlueprintToActivities()` from `blueprint-activity-mapper.ts` to deterministically derive candidate activities from the blueprint's structural components. Each component is mapped via `LAYER_TECH_PATTERNS` (a static lookup table of layer × techCategory → activity code prefixes), with complexity driving variant selection (`_SM` for LOW, `_LG` for HIGH, base for MEDIUM).

**Catalog-validated prefixes**: All entries in `LAYER_TECH_PATTERNS` have been validated against the real activity catalog (102 codes). Codes like `PP_FLOW` and `BE_API` that don't exist as standalone catalog entries have been split into their real variants: `PP_FLOW_SIMPLE`/`PP_FLOW_COMPLEX` and `BE_API_SIMPLE`/`BE_API_COMPLEX`. Complexity-based prefix routing selects the correct variant: SIMPLE for LOW/MEDIUM complexity, COMPLEX for HIGH complexity — avoiding double-mapping.

**Unsupported layers**: Layers without catalog mappings (e.g., `ai_pipeline`, `ml_model`, `iot`, `embedded`) are recognized as unsupported. Components on these layers are added to `unmappedComponents` and generate a `UNSUPPORTED_LAYER` quality warning rather than silently failing.

**Quality warnings** (`CoverageWarning[]`): Non-blocking metadata returned in `BlueprintMappingResult.warnings`:
- `UNSUPPORTED_LAYER` — component layer has no catalog mappings
- `LOW_COVERAGE` — component coverage < 50%
- `HIGH_FALLBACK_RATIO` — fallback activities > 50% of total
- `UNMAPPED_COMPONENTS` — lists components that could not be mapped
- `EMPTY_BLUEPRINT` — no components in blueprint

These warnings are logged server-side and surfaced in `EstimationMetrics.blueprintWarnings` for observability. They never block estimation. The frontend `EstimationResultStep` displays these warnings under a "Mapping Notes" card when present.

Integrations, data entities, testing scope, and cross-cutting activities (deploy, governance) are also mapped. Integration mapping uses the same complexity-based prefix routing as component mapping (HIGH → COMPLEX variants, LOW/MEDIUM → SIMPLE variants). Each mapped activity carries provenance metadata (source, confidence). `selectTopActivities()` acts as gap-filler (10 slots) for covered groups missing from the blueprint mapping.

**Frontend surfacing**: `SelectedActivityWithReason` includes an optional `provenance` field (`'blueprint-component' | 'blueprint-integration' | 'blueprint-data' | 'blueprint-testing' | 'keyword-fallback' | 'multi-crosscutting' | 'agent-discovered'`). `EstimationFromInterviewResponse.metrics` includes optional `candidateSource`, `blueprintCoverage`, and `blueprintWarnings`. The `EstimationResultStep` UI renders: (1) per-activity provenance badges with color coding, (2) a Blueprint Coverage card showing coverage %, blueprint vs fallback counts, and unmapped groups, (3) a Mapping Notes card for quality warnings. All fields are optional for backward compatibility with the legacy keyword-ranking path.

When no blueprint is available, the legacy keyword-ranking path runs unchanged: `selectTopActivities()` with 20 slots.

**B1 expansion tracking**: The agentic pipeline's `search_catalog` tool can discover activity codes beyond the initial candidate set. These expanded codes are now tracked in `AgentOutput.expandedActivityCodes` and logged for observability.

**End-to-end provenance propagation**: Provenance is deterministically re-attached to every final selected activity via backend post-processing in `ai-estimate-from-interview.ts`, using `buildProvenanceMap()` and `attachProvenance()` from `provenance-map.ts`. The provenance map is built *before* agent execution from the blueprint mapping result (or keyword-fallback assignments). After the agent returns selected activities, provenance is re-attached by code lookup — never generated by the LLM. Codes discovered dynamically via agent `search_catalog` tool-use receive `'agent-discovered'` provenance. Precedence rule: blueprint-* > multi-crosscutting > keyword-fallback > agent-discovered. Both agentic and legacy pipelines perform re-attachment, ensuring provenance is always present on final output activities.

**Key functions**: `fetchActivitiesServerSide()`, `mapBlueprintToActivities()`, `isBlueprintMappable()`, `selectTopActivities()` (fallback), `formatActivitiesCatalog()`

### Max Tokens Reduction

`maxTokens` reduced from 16 384 → **4 096** (or 8 192 for reasoning models like gpt-5/o-series).
This cuts response generation time proportionally.

### Agentic Pipeline Tuning

| Parameter | Before | After | Impact |
|-----------|--------|-------|--------|
| `MAX_TOOL_ITERATIONS` | 5 | **3** | Fewer LLM round-trips |
| `TOOL_ITERATION_BUDGET_MS` | — | **8 000** | Per-iteration timebox guard |
| `REFINE_TIME_BUDGET_MS` | 18 000 | **12 000** | Shorter refine window |
| Reflection trigger | Always | **Fast-path skip** when confidence ≥ 0.85, all activities valid, ≤ 1 tool call | Skips ~40% of reflections |
| Refine trigger | Medium + High severity | **High severity only** | Fewer unnecessary refines |

### Metrics Instrumentation

Both legacy and agentic pipelines now return a `metrics` object in the response:

```typescript
metrics?: {
  totalMs: number;
  activitiesFetchMs?: number;
  vectorSearchMs?: number;
  ragRetrievalMs?: number;
  draftDurationMs?: number;
  reflectionDurationMs?: number;
  refineDurationMs?: number;
  pipeline: 'legacy' | 'agentic';
  fallbackUsed?: boolean;       // true when agentic → legacy fallback fires
  activitiesRanked?: number;    // total activities before ranking
  activitiesSent?: number;      // activities sent to LLM after ranking
};
```

Use this data to measure actual latencies and decide whether Background Functions are needed.

---

**Update this document when**:
- Contingency thresholds change
- New calculation steps are added
- Formula is modified
- Agentic pipeline validation logic changes
