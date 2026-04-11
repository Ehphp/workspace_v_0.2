/**
 * artifact-invalidation.service.ts — Downstream artifact invalidation
 *
 * When an upstream artifact (e.g., requirement_understanding) is updated
 * to a new version, downstream artifacts that depend on it become stale.
 * This service provides the logic to detect and propagate invalidation.
 *
 * Currently hooks into the existing stale-reason detection in
 * canonical-profile.service.ts (which already checks version mismatches).
 * This module adds explicit invalidation actions (logging, flagging).
 *
 * @module artifact-invalidation
 */

import { getSupabaseAdmin } from './supabase-client';

/**
 * Result of an invalidation check.
 */
export interface InvalidationResult {
    /** Whether any downstream artifacts are now stale */
    invalidated: boolean;
    /** Which artifact types were affected */
    affectedArtifacts: ('impact_map' | 'estimation_blueprint' | 'estimation')[];
    /** Human-readable log of what was invalidated and why */
    log: string[];
}

/**
 * Check and flag downstream artifacts when a requirement understanding
 * version changes.
 *
 * This is a read-only check that surfaces invalidation info. It does NOT
 * delete or modify downstream artifacts — it returns what would be stale.
 *
 * @param requirementId  The requirement whose understanding changed
 * @param newVersion     The new understanding version
 * @param previousVersion The version that downstream artifacts were based on
 */
export async function invalidateDownstreamArtifacts(
    requirementId: string,
    newVersion: number,
    previousVersion: number,
): Promise<InvalidationResult> {
    const log: string[] = [];
    const affected: InvalidationResult['affectedArtifacts'] = [];

    if (newVersion <= previousVersion) {
        return { invalidated: false, affectedArtifacts: [], log: ['No version change detected'] };
    }

    log.push(`[invalidation] Understanding version changed: ${previousVersion} → ${newVersion} for requirement ${requirementId}`);

    const sb = getSupabaseAdmin();

    // Check impact maps that reference this requirement
    const { data: impactMaps } = await sb
        .from('impact_map')
        .select('id, version, created_at')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (impactMaps && impactMaps.length > 0) {
        affected.push('impact_map');
        log.push(`[invalidation] Impact map (v${impactMaps[0].version}) may be stale — based on older understanding`);
    }

    // Check estimation blueprints
    const { data: blueprints } = await sb
        .from('estimation_blueprint')
        .select('id, version, created_at')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (blueprints && blueprints.length > 0) {
        affected.push('estimation_blueprint');
        log.push(`[invalidation] Estimation blueprint (v${blueprints[0].version}) may be stale — based on older understanding`);
    }

    // Check estimations linked to this requirement
    const { data: estimations } = await sb
        .from('estimations')
        .select('id, created_at')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (estimations && estimations.length > 0) {
        affected.push('estimation');
        log.push(`[invalidation] Latest estimation may be stale — understanding version mismatch`);
    }

    const invalidated = affected.length > 0;
    if (invalidated) {
        log.push(`[invalidation] Total affected artifact types: ${affected.join(', ')}`);
    }

    console.log(log.join('\n'));
    return { invalidated, affectedArtifacts: affected, log };
}
