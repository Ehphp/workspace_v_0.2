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

## AI Pipeline Performance Optimizations (Quick Wins v2)

The following optimizations reduce end-to-end latency for the AI estimation pipeline
(both legacy and agentic modes) in `ai-estimate-from-interview`:

### Server-Side Activity Fetch & Ranking

Activities are now fetched **server-side** from Supabase (instead of being sent by the client),
then ranked by keyword relevance and trimmed to the **top 20**. This reduces:
- Request payload size (no more sending 100+ activities from the browser)
- LLM prompt tokens (compact format: code, name, base_hours, truncated description)
- Client-provided activities are used only as a fallback

**Blueprint-boosted ranking** (Milestone 3): When an Estimation Blueprint is available, `selectTopActivities()` extracts keywords from the blueprint's components, integrations, data entities, and testing scope. Each blueprint-derived keyword match receives a **+2 boost** (vs +1 for description keywords), ensuring that structurally relevant activities rank higher. This makes the blueprint an operational artifact — not just prompt decoration — by directly influencing which activities the LLM sees.

**Key functions**: `fetchActivitiesServerSide()`, `selectTopActivities()`, `formatActivitiesCatalog()`

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
