/**
 * save-orchestrator.ts — Domain-aware estimation save flow
 *
 * Orchestrates the full domain chain when a user saves an estimation:
 *
 *   1. Ensure RequirementAnalysis exists (create or reuse)
 *   2. Generate / reuse ImpactMap
 *   3. Build CandidateSet
 *   4. Create EstimationDecision
 *   5. Compute estimation via domain engine
 *   6. Save estimation with analysis_id + decision_id
 *   7. Create EstimationSnapshot
 *
 * This module does NOT replace the existing save_estimation_atomic RPC.
 * Instead it wraps the domain-layer bookkeeping AROUND the existing flow.
 * The UI continues to send selected activities, drivers, risks unchanged.
 */

import { getDomainSupabase } from '../supabase';
import {
  createRequirementAnalysis,
  getLatestAnalysis,
} from './analysis.service';
import { createImpactMap, getLatestImpactMap } from './impact-map.service';
import { buildCandidates, createCandidateSet } from './candidate-set.service';
import { createEstimationDecision } from './decision.service';
import { computeEstimation, ENGINE_VERSION } from './estimation-engine';
import { createEstimationSnapshot, buildSnapshotData } from './snapshot.service';

import type { EstimationResult } from '../../../../../src/types/estimation';

// ─── Input from the existing save flow ───────────────────────────

export interface DomainSaveInput {
  /** Requirement being estimated */
  requirementId: string;
  /** Authenticated user */
  userId: string;
  /** Raw requirement description (used for analysis if none exists) */
  description: string;
  /** Tech category string */
  techCategory?: string | null;
  /** Technology UUID (if available) */
  technologyId?: string | null;
  /** Blueprint UUID (if available) */
  blueprintId?: string | null;

  /** Existing understanding artifact (from wizard step) */
  understanding?: Record<string, unknown> | null;
  /** Existing impact map artifact (from wizard step) */
  impactMapData?: Record<string, unknown> | null;

  /** Activities selected by user / AI — fully resolved with IDs */
  activities: {
    activity_id: string;
    code: string;
    base_hours: number;
    is_ai_suggested: boolean;
  }[];

  /** Drivers with resolved IDs */
  drivers: {
    driver_id: string;
    code: string;
    selected_value: string;
    multiplier: number;
  }[];

  /** Risks with resolved IDs */
  risks: {
    risk_id: string;
    code: string;
    weight: number;
  }[];

  /** Warnings from AI / system */
  warnings?: string[];
  /** Assumptions surfaced during estimation */
  assumptions?: string[];
}

export interface DomainSaveResult {
  analysisId: string;
  impactMapId: string | null;
  candidateSetId: string;
  decisionId: string;
  estimation: EstimationResult;
  snapshotId: string;
}

/**
 * Execute the full domain orchestration for a save.
 *
 * This is called BEFORE the existing save_estimation_atomic RPC, and its
 * output (analysis_id, decision_id) is passed into the RPC call.
 */
export async function orchestrateDomainSave(
  input: DomainSaveInput,
): Promise<DomainSaveResult> {
  // 1. Ensure RequirementAnalysis exists
  let analysis = await getLatestAnalysis(input.requirementId);
  if (!analysis && input.understanding) {
    analysis = await createRequirementAnalysis({
      requirement_id: input.requirementId,
      understanding: input.understanding,
      input_description: input.description,
      input_tech_category: input.techCategory ?? null,
      confidence: null,
      created_by: input.userId,
    });
  }
  // If still no analysis (legacy flow without understanding), create a minimal one
  if (!analysis) {
    analysis = await createRequirementAnalysis({
      requirement_id: input.requirementId,
      understanding: { _legacy: true, description: input.description },
      input_description: input.description,
      input_tech_category: input.techCategory ?? null,
      confidence: null,
      created_by: input.userId,
    });
  }

  // 2. Impact map (optional — reuse or create)
  let impactMap = await getLatestImpactMap(analysis.id);
  if (!impactMap && input.impactMapData) {
    impactMap = await createImpactMap({
      analysis_id: analysis.id,
      impact_data: input.impactMapData,
      confidence: null,
      created_by: input.userId,
    });
  }

  // 3. Build & persist CandidateSet
  const candidates = buildCandidates(input.activities);
  const candidateSet = await createCandidateSet({
    analysis_id: analysis.id,
    impact_map_id: impactMap?.id ?? null,
    technology_id: input.technologyId ?? null,
    candidates,
    created_by: input.userId,
  });

  // 4. Create EstimationDecision
  const selectedIds = input.activities.map((a) => a.activity_id);
  const decision = await createEstimationDecision({
    candidate_set_id: candidateSet.id,
    selected_activity_ids: selectedIds,
    excluded_activity_ids: [],
    driver_values: input.drivers.map((d) => ({
      driver_id: d.driver_id,
      selected_value: d.selected_value,
    })),
    risk_ids: input.risks.map((r) => r.risk_id),
    warnings: input.warnings ?? [],
    assumptions: input.assumptions ?? [],
    decision_confidence: null,
    created_by: input.userId,
  });

  // 5. Compute estimation via domain engine
  const estimation = computeEstimation({
    activities: input.activities.map((a) => ({
      code: a.code,
      baseHours: a.base_hours,
      isAiSuggested: a.is_ai_suggested,
    })),
    drivers: input.drivers.map((d) => ({
      code: d.code,
      value: d.selected_value,
      multiplier: d.multiplier,
    })),
    risks: input.risks.map((r) => ({
      code: r.code,
      weight: r.weight,
    })),
  });

  // 6. Snapshot data (will be persisted after the RPC returns estimation_id)
  const snapshotData = buildSnapshotData({
    activities: input.activities,
    drivers: input.drivers,
    risks: input.risks,
    totals: {
      base_days: estimation.baseDays,
      driver_multiplier: estimation.driverMultiplier,
      subtotal: estimation.subtotal,
      risk_score: estimation.riskScore,
      contingency_percent: estimation.contingencyPercent,
      contingency_days: estimation.contingencyDays,
      total_days: estimation.totalDays,
    },
    analysis_id: analysis.id,
    decision_id: decision.id,
    blueprint_id: input.blueprintId ?? null,
  });

  // Note: snapshot creation requires estimation_id from the RPC.
  // We store the data and the caller must call `createEstimationSnapshot`
  // after the RPC completes.
  // For now, we store a placeholder that the caller will finalize.

  return {
    analysisId: analysis.id,
    impactMapId: impactMap?.id ?? null,
    candidateSetId: candidateSet.id,
    decisionId: decision.id,
    estimation,
    snapshotId: '', // will be set by caller after RPC
  };
}

/**
 * Finalize the snapshot after the estimation RPC returns the estimation_id.
 * Must be called AFTER save_estimation_atomic completes.
 */
export async function finalizeSnapshot(input: {
  estimationId: string;
  userId: string;
  domainSave: DomainSaveInput;
  estimation: EstimationResult;
  analysisId: string;
  decisionId: string;
  blueprintId: string | null;
}): Promise<string> {
  const snapshotData = buildSnapshotData({
    activities: input.domainSave.activities,
    drivers: input.domainSave.drivers,
    risks: input.domainSave.risks,
    totals: {
      base_days: input.estimation.baseDays,
      driver_multiplier: input.estimation.driverMultiplier,
      subtotal: input.estimation.subtotal,
      risk_score: input.estimation.riskScore,
      contingency_percent: input.estimation.contingencyPercent,
      contingency_days: input.estimation.contingencyDays,
      total_days: input.estimation.totalDays,
    },
    analysis_id: input.analysisId,
    decision_id: input.decisionId,
    blueprint_id: input.blueprintId,
  });

  const snapshot = await createEstimationSnapshot({
    estimation_id: input.estimationId,
    snapshot_data: snapshotData,
    engine_version: ENGINE_VERSION,
    created_by: input.userId,
  });

  return snapshot.id;
}
