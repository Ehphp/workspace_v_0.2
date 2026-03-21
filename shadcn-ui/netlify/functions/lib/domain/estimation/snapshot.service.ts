/**
 * snapshot.service.ts — EstimationSnapshot domain service
 *
 * Creates immutable snapshots that capture the full input & output
 * used for an estimation, enabling reproducibility and auditing.
 */

import { getDomainSupabase } from '../supabase';
import { ENGINE_VERSION } from './estimation-engine';
import type {
  EstimationSnapshotRow,
  EstimationSnapshotData,
  CreateEstimationSnapshotInput,
} from '../../../../../src/types/domain-model';

/**
 * Persist an EstimationSnapshot.
 */
export async function createEstimationSnapshot(
  input: CreateEstimationSnapshotInput,
): Promise<EstimationSnapshotRow> {
  const sb = getDomainSupabase();

  const { data, error } = await sb
    .from('estimation_snapshots')
    .insert({
      estimation_id: input.estimation_id,
      snapshot_data: input.snapshot_data,
      engine_version: input.engine_version ?? ENGINE_VERSION,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create EstimationSnapshot: ${error?.message}`);
  }
  return data as EstimationSnapshotRow;
}

/**
 * Build the snapshot data object from raw estimation inputs & outputs.
 */
export function buildSnapshotData(input: {
  activities: {
    activity_id: string;
    code: string;
    base_hours: number;
    is_ai_suggested: boolean;
  }[];
  drivers: {
    driver_id: string;
    code: string;
    selected_value: string;
    multiplier: number;
  }[];
  risks: {
    risk_id: string;
    code: string;
    weight: number;
  }[];
  totals: {
    base_days: number;
    driver_multiplier: number;
    subtotal: number;
    risk_score: number;
    contingency_percent: number;
    contingency_days: number;
    total_days: number;
  };
  analysis_id: string | null;
  decision_id: string | null;
  blueprint_id: string | null;
}): EstimationSnapshotData {
  return {
    activities: input.activities.map((a) => ({
      activity_id: a.activity_id,
      code: a.code,
      base_hours: a.base_hours,
      is_ai_suggested: a.is_ai_suggested,
    })),
    drivers: input.drivers.map((d) => ({
      driver_id: d.driver_id,
      code: d.code,
      selected_value: d.selected_value,
      multiplier: d.multiplier,
    })),
    risks: input.risks.map((r) => ({
      risk_id: r.risk_id,
      code: r.code,
      weight: r.weight,
    })),
    totals: { ...input.totals },
    metadata: {
      engine_version: ENGINE_VERSION,
      analysis_id: input.analysis_id,
      decision_id: input.decision_id,
      blueprint_id: input.blueprint_id,
      created_at: new Date().toISOString(),
    },
  };
}
