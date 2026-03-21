/**
 * candidate-set.service.ts — CandidateSet domain service
 *
 * Builds and persists candidate activity sets from analysis + impact map + technology.
 */

import { getDomainSupabase } from '../supabase';
import type {
    CandidateSetRow,
    CandidateActivity,
    CandidateSource,
    CreateCandidateSetInput,
} from '../../../../../src/types/domain-model';

/**
 * Build a CandidateSet from the current estimation inputs.
 *
 * This is a pass-through builder that transforms the existing
 * AI-suggested and user-selected activities into the domain model format.
 * Future iterations will add smarter ranking from blueprint/analysis/impact map.
 */
export function buildCandidates(
    activities: {
        activity_id: string;
        code: string;
        is_ai_suggested: boolean;
        base_hours?: number;
    }[],
    source: CandidateSource = 'ai',
): CandidateActivity[] {
    return activities.map((a) => ({
        activity_id: a.activity_id,
        activity_code: a.code,
        source: a.is_ai_suggested ? 'ai' : 'manual',
        score: a.is_ai_suggested ? 80 : 100, // manual selections get max score
        confidence: a.is_ai_suggested ? 0.7 : 1.0,
    }));
}

/**
 * Persist a CandidateSet.
 */
export async function createCandidateSet(
    input: CreateCandidateSetInput,
): Promise<CandidateSetRow> {
    const sb = getDomainSupabase();

    const { data, error } = await sb
        .from('candidate_sets')
        .insert({
            analysis_id: input.analysis_id,
            impact_map_id: input.impact_map_id ?? null,
            technology_id: input.technology_id ?? null,
            candidates: input.candidates,
            created_by: input.created_by,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create CandidateSet: ${error?.message}`);
    }
    return data as CandidateSetRow;
}
