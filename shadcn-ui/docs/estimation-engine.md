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
| 0 | 0% |
| 1-10 | 10% |
| 11-20 | 15% |
| 21-30 | 20% |
| 31+ | 25% |

```typescript
function calculateContingency(riskScore: number): number {
  if (riskScore <= 0) return 0.0;
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

## What the Engine Does NOT Do

| Responsibility | Owner |
|----------------|-------|
| Suggest activities | AI (via `ai-suggest.ts`) |
| Validate requirement text | AI + deterministic rules |
| Select drivers/risks | User |
| Store estimations | Supabase RPC |

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

**Update this document when**:
- Contingency thresholds change
- New calculation steps are added
- Formula is modified
