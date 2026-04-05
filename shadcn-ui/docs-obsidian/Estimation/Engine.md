# Estimation Engine

Deterministic calculation engine — the final stage of the [[Estimation Pipeline]].

## Type

Infrastructure

## Role

Computes the estimation result from user-selected activities, drivers, and risks. Fully deterministic — same inputs always produce same outputs.

## Formula

```
baseDays         = Σ activity.baseHours / 8
driverMultiplier = Π driver.multiplier        (default: 1.0 if none)
subtotal         = baseDays × driverMultiplier

riskScore        = Σ risk.weight
contingencyPct   = stepFunction(riskScore):
                     ≤10 → 10%
                     ≤20 → 15%
                     ≤30 → 20%
                     >30 → 25%
contingencyDays  = subtotal × contingencyPct

totalDays        = subtotal + contingencyDays
```

All outputs rounded to 2 decimals (driverMultiplier to 3).

## Input

- Selected activities (each with `baseHours`) from [[Estimation Decision]]
- Driver multiplier values (`{ multiplier: number }[]`)
- Risk factor weights (`{ weight: number }[]`)

## Output

- `baseDays`, `driverMultiplier`, `subtotal`
- `riskScore`, `contingencyPercent`, `contingencyDays`
- `totalDays`
- `breakdown` (byGroup, byTech)

## Constraints

- No AI involved — purely arithmetic
- Version-tracked via `ENGINE_VERSION = '2.0.0'` for audit trail
- See [[Architecture/Constraints]]

## Produced by

- **Function**: `computeEstimation(input)` → `netlify/functions/lib/domain/estimation/estimation-engine.ts`
- **Caller**: `save-orchestrator.ts` → `orchestrateWizardDomainSave()`
- **Version**: `ENGINE_VERSION = '2.0.0'`

## Consumed by

- Persisted to `estimations` table (total_days, base_hours, driver_multiplier fields)
- Displayed in `WizardStep5.tsx` (Results step)
- `estimation_snapshots` — immutable audit record

## Depends on

- [[Estimation Decision]] — provides selected activities, drivers, risks
- Activity, driver, risk catalogs — see [[Data Model/Schema]]

## Represented in code

- `netlify/functions/lib/domain/estimation/estimation-engine.ts`

## Stability

High

## Source of truth

Code

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - `netlify/functions/lib/domain/estimation/estimation-engine.ts` — `computeEstimation()`, `calculateBaseDays()`, `calculateDriverMultiplier()`, `calculateRiskScore()`, `calculateContingency()`, `ENGINE_VERSION`
- **corrections applied**:
  - Formula was WRONG: old note said `Σ(risk.weight × contingency_pct) × base_days`. Actual code uses a step-function: `contingencyPct = f(Σ risk.weight)` where thresholds are ≤10→10%, ≤20→15%, ≤30→20%, >30→25%, then `contingencyDays = subtotal × contingencyPct`
  - Added `subtotal` as intermediate value (baseDays × driverMultiplier)
  - Added rounding behavior (round2 / round3)
  - Corrected ENGINE_VERSION to '2.0.0'
