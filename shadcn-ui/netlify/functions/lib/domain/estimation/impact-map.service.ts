/**
 * impact-map.service.ts — ImpactMap domain service
 *
 * Creates domain-model impact maps linked to a RequirementAnalysis.
 */

import { getDomainSupabase } from '../supabase';
import type {
    ImpactMapDomainRow,
    CreateImpactMapInput,
} from '../../../../../src/types/domain-model';

/**
 * Persist a new ImpactMap linked to an analysis.
 *
 * New writes set `artifact_impact_map_id` FK and leave `impact_data`
 * JSONB null. Legacy callers that still pass inline JSONB are supported.
 */
export async function createImpactMap(
    input: CreateImpactMapInput,
): Promise<ImpactMapDomainRow> {
    const sb = getDomainSupabase();

    const { data, error } = await sb
        .from('impact_maps')
        .insert({
            analysis_id: input.analysis_id,
            impact_data: input.impact_data ?? null,
            artifact_impact_map_id: input.artifact_impact_map_id ?? null,
            confidence: input.confidence ?? null,
            created_by: input.created_by,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create ImpactMap: ${error?.message}`);
    }
    return data as ImpactMapDomainRow;
}

/**
 * Retrieve the latest ImpactMap for a given analysis.
 */
export async function getLatestImpactMap(
    analysisId: string,
): Promise<ImpactMapDomainRow | null> {
    const sb = getDomainSupabase();

    const { data, error } = await sb
        .from('impact_maps')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to fetch ImpactMap: ${error.message}`);
    }
    return (data as ImpactMapDomainRow) ?? null;
}
