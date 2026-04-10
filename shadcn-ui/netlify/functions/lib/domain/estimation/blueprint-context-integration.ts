/**
 * blueprint-context-integration.ts — Wiring between blueprint rules and estimation flow
 *
 * Merges BlueprintRuleResult into ProjectContextRuleResult so the
 * estimation pipeline sees a single unified set of biases.
 *
 * Pure functions. No side effects.
 */

import type { ProjectContextRuleResult, ActivityBiases } from './project-context-rules';
import type { BlueprintRuleResult } from './blueprint-rules';

/**
 * Merge blueprint rules into project context rules.
 *
 * Blueprint rules are additive — they never remove or override
 * project context suggestions. When both suggest the same risk/driver
 * code, the project context version wins (more specific).
 */
export function mergeProjectAndBlueprintRules(
    projectRules: ProjectContextRuleResult,
    blueprintRules: BlueprintRuleResult,
): ProjectContextRuleResult {
    const mergedBiases = mergeBiases(projectRules.activityBiases, blueprintRules.activityBiases);

    // Merge drivers (deduplicate by code, project wins)
    const seenDrivers = new Set(projectRules.suggestedDrivers.map((d) => d.code));
    const mergedDrivers = [
        ...projectRules.suggestedDrivers,
        ...blueprintRules.suggestedDrivers.filter((d) => !seenDrivers.has(d.code)),
    ];

    // Merge risks (deduplicate by code, project wins)
    const seenRisks = new Set(projectRules.suggestedRisks.map((r) => r.code));
    const mergedRisks = [
        ...projectRules.suggestedRisks,
        ...blueprintRules.suggestedRisks.filter((r) => !seenRisks.has(r.code)),
    ];

    // Combine notes (tagged differently so provenance is clear)
    const mergedNotes = [
        ...projectRules.notes,
        ...blueprintRules.notes,
    ];

    return {
        activityBiases: mergedBiases,
        suggestedDrivers: mergedDrivers,
        suggestedRisks: mergedRisks,
        notes: mergedNotes,
    };
}

// ─── Internal: merge bias objects ───────────────────────────────

function mergeBiases(a: ActivityBiases, b: ActivityBiases): ActivityBiases {
    return {
        boostGroups: dedup([...(a.boostGroups ?? []), ...(b.boostGroups ?? [])]),
        boostKeywords: dedup([...(a.boostKeywords ?? []), ...(b.boostKeywords ?? [])]),
    };
}

function dedup(arr: string[]): string[] {
    return [...new Set(arr)];
}
