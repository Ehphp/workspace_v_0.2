/**
 * decision.service.ts — EstimationDecision domain service
 *
 * Creates decision records that capture what was selected, excluded,
 * and the rationale behind the estimation.
 */

import { getDomainSupabase } from '../supabase';
import type {
    EstimationDecisionRow,
    CreateEstimationDecisionInput,
} from '../../../../../src/types/domain-model';

/**
 * Persist an EstimationDecision.
 */
export async function createEstimationDecision(
    input: CreateEstimationDecisionInput,
): Promise<EstimationDecisionRow> {
    const sb = getDomainSupabase();

    const { data, error } = await sb
        .from('estimation_decisions')
        .insert({
            candidate_set_id: input.candidate_set_id,
            selected_activity_ids: input.selected_activity_ids,
            excluded_activity_ids: input.excluded_activity_ids ?? [],
            driver_values: input.driver_values,
            risk_ids: input.risk_ids,
            warnings: input.warnings ?? [],
            assumptions: input.assumptions ?? [],
            decision_confidence: input.decision_confidence ?? null,
            created_by: input.created_by,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create EstimationDecision: ${error?.message}`);
    }
    return data as EstimationDecisionRow;
}
