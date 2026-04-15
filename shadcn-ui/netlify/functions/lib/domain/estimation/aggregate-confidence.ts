/**
 * aggregate-confidence.ts — Hot-path confidence computation
 *
 * Pure function, no I/O, no Supabase.
 * Called on EVERY estimation run by ai-estimate-from-interview and
 * ai-requirement-interview to determine candidate pool size and agent
 * reflection thresholds.
 *
 * The remaining canonical-profile logic (buildCanonicalProfile,
 * detectConflicts, etc.) lives in canonical-profile.service.ts and
 * runs only post-save as a non-fatal traceability step.
 */

/**
 * Compute a weighted confidence score from the three estimation artifacts.
 *
 * Weights reflect informational hierarchy toward estimation:
 *   blueprint    (0.45) — describes WHAT to build, highest signal
 *   impact_map   (0.35) — describes WHERE it impacts
 *   understanding (0.20) — describes WHY it's needed, lightest for estimation
 *
 * Missing artifacts reduce the denominator (not penalized as zero).
 * A staleness flag applies a 15% penalty — informational only, not a gate.
 *
 * Returns a value in [0.0, 1.0].
 */
export function computeAggregateConfidence(
    understanding: Record<string, unknown> | null,
    impactMap: Record<string, unknown> | null,
    blueprint: Record<string, unknown>,
    isStale: boolean,
): number {
    const WEIGHTS = { blueprint: 0.45, impactMap: 0.35, understanding: 0.20 };

    const bpConf = (blueprint['overallConfidence'] as number) ?? 0;
    let score = bpConf * WEIGHTS.blueprint;
    let weightUsed = WEIGHTS.blueprint;

    const imConf = (impactMap?.['overallConfidence'] as number) ?? null;
    if (imConf !== null) {
        score += imConf * WEIGHTS.impactMap;
        weightUsed += WEIGHTS.impactMap;
    }

    const uConf = (understanding?.['confidence'] as number) ?? null;
    if (uConf !== null) {
        score += uConf * WEIGHTS.understanding;
        weightUsed += WEIGHTS.understanding;
    }

    const normalized = score / weightUsed;
    return isStale
        ? Math.round(normalized * 0.85 * 100) / 100
        : Math.round(normalized * 100) / 100;
}
