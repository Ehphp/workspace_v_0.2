/**
 * Provenance Map — Deterministic provenance re-attachment
 *
 * Builds a Map<activityCode, provenance> from blueprint mapping results
 * and/or fallback-ranked activities.  After agent execution, this map is
 * used to re-attach provenance to each selected activity — entirely in
 * backend post-processing, never via LLM behavior.
 *
 * Precedence (first entry wins):
 *   blueprint-component > blueprint-integration > blueprint-data >
 *   blueprint-testing > multi-crosscutting > keyword-fallback > agent-discovered
 */

import type { ActivityProvenance, BlueprintMappingResult } from './blueprint-activity-mapper';

// Re-export for consumers
export type { ActivityProvenance };

/** Activity-like shape with at least a `code` field */
interface HasCode { code: string }

/**
 * Build a deterministic provenance map from blueprint mapping results
 * and/or keyword-ranked activities.
 *
 * @param blueprintResult - mapping result when blueprint was used (null if legacy path)
 * @param rankedActivities - fallback-ranked activities (always present)
 * @returns Map of activity code → provenance
 */
export function buildProvenanceMap(
    blueprintResult: BlueprintMappingResult | undefined | null,
    rankedActivities: HasCode[],
): Map<string, ActivityProvenance> {
    const map = new Map<string, ActivityProvenance>();

    if (blueprintResult) {
        // Blueprint activities first (higher precedence)
        for (const ma of blueprintResult.blueprintActivities) {
            if (!map.has(ma.activity.code)) {
                map.set(ma.activity.code, ma.provenance);
            }
        }
        // Then fallback activities
        for (const ma of blueprintResult.fallbackActivities) {
            if (!map.has(ma.activity.code)) {
                map.set(ma.activity.code, ma.provenance);
            }
        }
    } else {
        // No blueprint — all ranked activities are keyword-fallback
        for (const a of rankedActivities) {
            map.set(a.code, 'keyword-fallback');
        }
    }

    return map;
}

/**
 * Re-attach provenance to final selected activities using the provenance map.
 *
 * For each activity:
 *   1. If code exists in provenanceMap → use mapped provenance
 *   2. If code was dynamically discovered by agent (in expandedCodes) → 'agent-discovered'
 *   3. If code is entirely unknown → 'agent-discovered' (safe default)
 *
 * @returns Activities with provenance field attached
 */
export function attachProvenance<T extends HasCode>(
    activities: T[],
    provenanceMap: Map<string, ActivityProvenance>,
    expandedCodes?: string[],
): (T & { provenance: ActivityProvenance })[] {
    const expandedSet = new Set(expandedCodes || []);

    return activities.map(a => ({
        ...a,
        provenance: provenanceMap.get(a.code)
            ?? (expandedSet.has(a.code) ? 'agent-discovered' as const : 'agent-discovered' as const),
    }));
}

/**
 * Compute provenance breakdown counts for observability logging.
 */
export function provenanceBreakdown(
    activities: { provenance: ActivityProvenance }[],
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const a of activities) {
        counts[a.provenance] = (counts[a.provenance] || 0) + 1;
    }
    return counts;
}
