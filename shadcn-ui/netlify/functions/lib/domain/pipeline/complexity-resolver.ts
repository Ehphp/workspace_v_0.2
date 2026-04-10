/**
 * Complexity Resolver — Single source of truth for complexity-based hour scaling
 *
 * Replaces three redundant mechanisms:
 *   1. blueprint-activity-mapper getVariantSuffix() + _SM/_LG catalog rows
 *   2. variant-router.ts keyword-based _SM/_LG routing
 *   3. project-context-integration.ts preferLargeVariants/preferSmallVariants scoring
 *
 * Now: one function, one multiplier, applied once.
 *
 * @module complexity-resolver
 */

import type { Activity } from '../../activities';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ResolvedHours {
    /** Final hours after applying the complexity multiplier */
    hours: number;
    /** The multiplier that was applied (e.g. 0.5, 1.0, 2.0) */
    multiplier: number;
    /** Which complexity variant was used */
    variant: 'SM' | 'BASE' | 'LG';
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults (used when activity doesn't have explicit multipliers)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SM_MULTIPLIER = 0.50;
const DEFAULT_LG_MULTIPLIER = 2.00;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective hours for an activity at a given complexity level.
 *
 * LOW    → base_hours × sm_multiplier
 * MEDIUM → base_hours × 1.0
 * HIGH   → base_hours × lg_multiplier
 */
export function resolveActivityHours(
    activity: Activity,
    complexityLevel: ComplexityLevel,
): ResolvedHours {
    const smMul = activity.sm_multiplier ?? DEFAULT_SM_MULTIPLIER;
    const lgMul = activity.lg_multiplier ?? DEFAULT_LG_MULTIPLIER;

    switch (complexityLevel) {
        case 'LOW':
            return {
                hours: Math.round(activity.base_hours * smMul * 100) / 100,
                multiplier: smMul,
                variant: 'SM',
            };
        case 'HIGH':
            return {
                hours: Math.round(activity.base_hours * lgMul * 100) / 100,
                multiplier: lgMul,
                variant: 'LG',
            };
        case 'MEDIUM':
        default:
            return {
                hours: activity.base_hours,
                multiplier: 1.0,
                variant: 'BASE',
            };
    }
}

/**
 * Resolve hours for a batch of activities at the same complexity level.
 */
export function resolveAllActivityHours(
    activities: Activity[],
    complexityLevel: ComplexityLevel,
): { activity: Activity; resolved: ResolvedHours }[] {
    return activities.map(activity => ({
        activity,
        resolved: resolveActivityHours(activity, complexityLevel),
    }));
}
