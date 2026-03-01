/**
 * Canonical Technology Helpers
 *
 * Single source of truth for activity–technology compatibility logic.
 * All filtering should go through these helpers instead of raw
 * `a.tech_category === t.tech_category` string comparisons.
 *
 * After the 20260301_canonical_technology_model migration, activities carry a
 * `technology_id` FK. These helpers use the FK when available and fall back to
 * the legacy `tech_category` string for backward compatibility.
 */

import type { Activity, Technology } from '@/types/database';

/** UUID of the "MULTI" technology row (populated lazily). */
let _multiTechId: string | null | undefined;

/**
 * Resolve the MULTI technology id from a list of technologies.
 * Caches the result after the first call.
 */
function getMultiTechId(technologies: Technology[]): string | null {
    if (_multiTechId !== undefined) return _multiTechId;
    const multi = technologies.find((t) => t.code === 'MULTI');
    _multiTechId = multi?.id ?? null;
    return _multiTechId;
}

/**
 * Reset cached MULTI id (useful after test teardown or hot-reload).
 */
export function resetMultiTechCache(): void {
    _multiTechId = undefined;
}

// ────────────────────────────────────────────────────────────
// Core compatibility check
// ────────────────────────────────────────────────────────────

/**
 * Check if an activity is compatible with a technology.
 *
 * Logic (in priority order):
 *   1. If `technology` is null/undefined → everything allowed (no filter).
 *   2. If `activity.technology_id` is set → use FK: must match `technology.id`
 *      OR be the MULTI technology.
 *   3. Fallback (legacy): compare `activity.tech_category` strings.
 */
export function isActivityCompatible(
    activity: Activity,
    technology: Technology | null | undefined,
    technologies?: Technology[],
): boolean {
    if (!technology) return true;

    // ── FK path (preferred) ──────────────────────────
    if (activity.technology_id) {
        if (activity.technology_id === technology.id) return true;

        // Allow MULTI activities
        if (technologies) {
            const multiId = getMultiTechId(technologies);
            if (multiId && activity.technology_id === multiId) return true;
        }

        // Without the full tech list we fall through to the string check
        // so existing call-sites that don't pass `technologies` still work.
    }

    // ── Legacy string path ───────────────────────────
    return (
        activity.tech_category === technology.tech_category ||
        activity.tech_category === technology.code ||
        activity.tech_category === 'MULTI'
    );
}

// ────────────────────────────────────────────────────────────
// Filtering helpers
// ────────────────────────────────────────────────────────────

/**
 * Filter a list of activities to those compatible with the given technology.
 * Drop-in replacement for:
 *   `activities.filter(a => a.tech_category === t.tech_category || a.tech_category === 'MULTI')`
 */
export function filterActivitiesByTechnology(
    activities: Activity[],
    technology: Technology | null | undefined,
    technologies?: Technology[],
): Activity[] {
    if (!technology) return activities;
    return activities.filter((a) => isActivityCompatible(a, technology, technologies));
}

/**
 * Build a Supabase `.or()` filter string for activities by technology.
 *
 * Returns a string usable as:
 *   `supabase.from('activities').select('*').or(techFilter)`
 *
 * Uses `technology_id` when the id is available, with `tech_category` fallback.
 */
export function buildActivityTechFilter(technology: Technology, multiTechId?: string | null): string {
    const parts: string[] = [];

    // FK-based filter (canonical)
    parts.push(`technology_id.eq.${technology.id}`);
    if (multiTechId) {
        parts.push(`technology_id.eq.${multiTechId}`);
    }

    // Legacy fallback: keep tech_category filter so that un-migrated rows still show
    parts.push(`tech_category.eq.${technology.code}`);
    parts.push(`tech_category.eq.MULTI`);

    return parts.join(',');
}
