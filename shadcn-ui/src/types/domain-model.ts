/**
 * Domain Model — Structured Estimation Entities
 *
 * These types mirror the new database tables introduced by
 * 20260321_domain_model_tables.sql and define the traceability
 * chain:  Analysis → ImpactMap → CandidateSet → Decision → Estimation → Snapshot
 */

// ─── Source enum for candidate activities ────────────────────────

export type CandidateSource = 'blueprint' | 'ai' | 'rule' | 'manual';

// ─── Candidate Activity (single item inside candidate_sets.candidates) ──

export interface CandidateActivity {
  activity_id: string;
  activity_code: string;
  source: CandidateSource;
  score: number;       // relevance score (0–100)
  confidence: number;  // how sure the source is (0.0–1.0)
  reason?: string;     // optional human-readable justification
}

// ─── RequirementAnalysis ─────────────────────────────────────────

export interface RequirementAnalysisRow {
  id: string;
  requirement_id: string;
  understanding: Record<string, unknown>;
  input_description: string;
  input_tech_category: string | null;
  confidence: number | null;
  created_by: string;
  created_at: string;
}

export interface CreateRequirementAnalysisInput {
  requirement_id: string;
  understanding: Record<string, unknown>;
  input_description: string;
  input_tech_category?: string | null;
  confidence?: number | null;
  created_by: string;
}

// ─── ImpactMap (domain model, distinct from legacy impact_map table) ──

export interface ImpactMapDomainRow {
  id: string;
  analysis_id: string;
  impact_data: Record<string, unknown>;
  confidence: number | null;
  created_by: string;
  created_at: string;
}

export interface CreateImpactMapInput {
  analysis_id: string;
  impact_data: Record<string, unknown>;
  confidence?: number | null;
  created_by: string;
}

// ─── CandidateSet ────────────────────────────────────────────────

export interface CandidateSetRow {
  id: string;
  analysis_id: string;
  impact_map_id: string | null;
  technology_id: string | null;
  candidates: CandidateActivity[];
  created_by: string;
  created_at: string;
}

export interface CreateCandidateSetInput {
  analysis_id: string;
  impact_map_id?: string | null;
  technology_id?: string | null;
  candidates: CandidateActivity[];
  created_by: string;
}

// ─── EstimationDecision ──────────────────────────────────────────

export interface EstimationDecisionRow {
  id: string;
  candidate_set_id: string;
  selected_activity_ids: string[];
  excluded_activity_ids: string[];
  driver_values: { driver_id: string; selected_value: string }[];
  risk_ids: string[];
  warnings: string[];
  assumptions: string[];
  decision_confidence: number | null;
  created_by: string;
  created_at: string;
}

export interface CreateEstimationDecisionInput {
  candidate_set_id: string;
  selected_activity_ids: string[];
  excluded_activity_ids?: string[];
  driver_values: { driver_id: string; selected_value: string }[];
  risk_ids: string[];
  warnings?: string[];
  assumptions?: string[];
  decision_confidence?: number | null;
  created_by: string;
}

// ─── EstimationSnapshot ─────────────────────────────────────────

export interface EstimationSnapshotData {
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
  metadata: {
    engine_version: string;
    analysis_id: string | null;
    decision_id: string | null;
    blueprint_id: string | null;
    created_at: string;
  };
}

export interface EstimationSnapshotRow {
  id: string;
  estimation_id: string;
  snapshot_data: EstimationSnapshotData;
  engine_version: string;
  created_by: string;
  created_at: string;
}

export interface CreateEstimationSnapshotInput {
  estimation_id: string;
  snapshot_data: EstimationSnapshotData;
  engine_version?: string;
  created_by: string;
}

// ─── Extended Estimation (with new FK columns) ──────────────────

export interface EstimationDomainExtension {
  analysis_id: string | null;
  decision_id: string | null;
}

// ─── Full traceability chain ────────────────────────────────────

export interface EstimationTraceChain {
  analysis: RequirementAnalysisRow;
  impactMap: ImpactMapDomainRow | null;
  candidateSet: CandidateSetRow;
  decision: EstimationDecisionRow;
  snapshot: EstimationSnapshotRow;
}
