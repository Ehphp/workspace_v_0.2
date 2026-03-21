/**
 * estimation-engine.ts — Pure domain estimation logic
 *
 * This is the canonical domain-layer estimation engine.
 * It delegates to the existing EstimationEngineSDK for calculations
 * but wraps it in a domain-aware interface that accepts an
 * EstimationDecision and returns a fully traced result.
 *
 * ALL calculation logic lives here — no UI concerns.
 */

import type { EstimationInput, EstimationResult } from '../types/estimation';

// ─── Re-export the core math from the SDK ────────────────────────
// The SDK is a pure-function class; we re-expose for domain callers.

/**
 * Core estimation formula (pure function).
 *
 * totalDays = (baseDays × driverMultiplier) × (1 + contingencyPercent)
 *
 * Where:
 *   baseDays         = Σ(activity.baseHours) / 8
 *   driverMultiplier = Π(driver.multiplier)
 *   riskScore        = Σ(risk.weight)
 *   contingency      = f(riskScore) ∈ {10%, 15%, 20%, 25%}
 */
export function computeEstimation(input: EstimationInput): EstimationResult {
    const baseDays = calculateBaseDays(input.activities);
    const driverMultiplier = calculateDriverMultiplier(input.drivers);
    const subtotal = baseDays * driverMultiplier;

    const riskScore = calculateRiskScore(input.risks);
    const contingencyPercent = calculateContingency(riskScore);
    const contingencyDays = subtotal * contingencyPercent;

    const totalDays = subtotal + contingencyDays;

    return {
        baseDays: round2(baseDays),
        driverMultiplier: round3(driverMultiplier),
        subtotal: round2(subtotal),
        riskScore,
        contingencyPercent: round2(contingencyPercent * 100),
        contingencyDays: round2(contingencyDays),
        totalDays: round2(totalDays),
        breakdown: { byGroup: {}, byTech: {} },
    };
}

// ─── Individual calculation steps (exported for testing) ─────────

export function calculateBaseDays(
    activities: { baseHours: number }[],
): number {
    return activities.reduce((sum, a) => sum + a.baseHours, 0) / 8.0;
}

export function calculateDriverMultiplier(
    drivers: { multiplier: number }[],
): number {
    if (drivers.length === 0) return 1.0;
    return drivers.reduce((product, d) => product * d.multiplier, 1.0);
}

export function calculateRiskScore(
    risks: { weight: number }[],
): number {
    return risks.reduce((sum, r) => sum + r.weight, 0);
}

export function calculateContingency(riskScore: number): number {
    if (riskScore <= 0) return 0.10;
    if (riskScore <= 10) return 0.10;
    if (riskScore <= 20) return 0.15;
    if (riskScore <= 30) return 0.20;
    return 0.25;
}

// ─── Engine version string ───────────────────────────────────────

export const ENGINE_VERSION = '2.0.0';

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
    return Number(n.toFixed(2));
}
function round3(n: number): number {
    return Number(n.toFixed(3));
}
