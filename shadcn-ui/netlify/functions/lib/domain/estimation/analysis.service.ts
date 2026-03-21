/**
 * analysis.service.ts — RequirementAnalysis domain service
 *
 * Creates and retrieves RequirementAnalysis records.
 * Reuses existing AI-generated understanding artifacts.
 */

import { getDomainSupabase } from '../supabase';
import type {
  RequirementAnalysisRow,
  CreateRequirementAnalysisInput,
} from '../../../../../src/types/domain-model';

/**
 * Persist a new RequirementAnalysis from an existing understanding artifact.
 */
export async function createRequirementAnalysis(
  input: CreateRequirementAnalysisInput,
): Promise<RequirementAnalysisRow> {
  const sb = getDomainSupabase();

  const { data, error } = await sb
    .from('requirement_analyses')
    .insert({
      requirement_id: input.requirement_id,
      understanding: input.understanding,
      input_description: input.input_description,
      input_tech_category: input.input_tech_category ?? null,
      confidence: input.confidence ?? null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create RequirementAnalysis: ${error?.message}`);
  }
  return data as RequirementAnalysisRow;
}

/**
 * Retrieve the latest RequirementAnalysis for a given requirement.
 * Returns null if none exists (backward compatibility — older estimations
 * won't have an analysis).
 */
export async function getLatestAnalysis(
  requirementId: string,
): Promise<RequirementAnalysisRow | null> {
  const sb = getDomainSupabase();

  const { data, error } = await sb
    .from('requirement_analyses')
    .select('*')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch RequirementAnalysis: ${error.message}`);
  }
  return (data as RequirementAnalysisRow) ?? null;
}
