/**
 * Domain Model — Structured Estimation Entities
 *
 * These types mirror the new database tables introduced by
 * 20260321_domain_model_tables.sql and define the traceability
 * chain:  Analysis → ImpactMap → CandidateSet → Decision → Estimation → Snapshot
 */

import type { ProvenanceSource } from '../../netlify/functions/lib/domain/pipeline/pipeline-domain';

// ─── Source enum for candidate activities ────────────────────────

/**
 * Extends ProvenanceSource with legacy source values ('ai', 'rule')
 * that may exist in stored data. New writes should use ProvenanceSource values only.
 */
export type CandidateSource = ProvenanceSource | 'ai' | 'rule';

// ─── Candidate Activity (single item inside candidate_sets.candidates) ──

export interface CandidateActivity {
    activity_id: string;
    activity_code: string;
    source: CandidateSource;
    score: number;       // relevance score (0–100)
    confidence: number;  // how sure the source is (0.0–1.0)
    reason?: string;     // optional human-readable justification
}

// ─── Canonical Profile Types ────────────────────────────────────

/**
 * Conflict between two artifact sources detected during canonical profile build.
 * Persisted as JSONB array in requirement_analyses.conflicts.
 */
export type ConflictType =
    | 'complexity_mismatch'        // understanding.complexityLevel vs blueprint components
    | 'layer_coverage_mismatch'    // blueprint layers not reflected in impact_map
    | 'integration_underdeclared'  // bidirectional integrations in blueprint, no integration layer in impact_map
    | 'data_entity_vs_readonly'    // blueprint creates/writes data, impact_map claims read-only
    | 'testing_criticality_vs_complexity'; // CRITICAL testing scope on LOW complexity requirement

export type ConflictResolutionHint =
    | 'prefer_blueprint'    // blueprint is the structural source of truth
    | 'prefer_impact_map'   // impact_map reflects confirmed architectural impact
    | 'manual_review';      // ambiguous — surface to user or reflection engine

export interface ConflictEntry {
    type: ConflictType;
    severity: 'low' | 'medium' | 'high';
    description: string;
    /** Profile field where the conflict surfaces */
    field: string;
    sourceA: 'understanding' | 'impact_map' | 'blueprint';
    valueA: unknown;
    sourceB: 'understanding' | 'impact_map' | 'blueprint';
    valueB: unknown;
    /** |confidence_a - confidence_b| — for ranking and filtering */
    confidenceDelta: number;
    resolutionHint: ConflictResolutionHint;
}

export type StructuralType = 'CRUD' | 'INTEGRATION' | 'WORKFLOW' | 'REPORT' | 'MIXED';

/**
 * V1 stale reason codes. Evaluated lazily by buildCanonicalProfile();
 * persisted as materialized cache in requirement_analyses.stale_reasons.
 */
export type StaleReasonCode =
    | 'UNDERSTANDING_UPDATED'
    | 'IMPACT_MAP_UPDATED'
    | 'BLUEPRINT_UPDATED'
    | 'PROJECT_BLUEPRINT_UPDATED'
    | 'PROJECT_CONTEXT_CHANGED';

/**
 * Artifact selection strategy for buildCanonicalProfile().
 * - latest: most recent blueprint version for the requirement
 * - highest_confidence: blueprint with highest confidence_score
 * - pinned: use pinned_blueprint_id from requirement_analyses (audit-safe)
 */
export type ArtifactSelectionStrategy = 'latest' | 'highest_confidence' | 'pinned';

/**
 * The canonical profile built at runtime by buildCanonicalProfile().
 * Not stored as a single row — requirement_analyses is the hub; the profile
 * is materialized by traversing from the pinned_blueprint_id anchor.
 */
export interface CanonicalProfile {
    // Identity
    requirementId: string;
    analysisId: string | null;
    pinnedBlueprintId: string;
    pinnedBlueprintVersion: number;

    // Source artifacts (read-only references — do not mutate)
    understanding: Record<string, unknown> | null;   // RequirementUnderstanding shape
    impactMap: Record<string, unknown> | null;        // ImpactMap shape
    blueprint: Record<string, unknown>;               // EstimationBlueprint shape (required)

    // Derived fields (computed by buildCanonicalProfile, not stored)
    inferredComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
    aggregateConfidence: number;     // weighted, runtime-only
    structuralType: StructuralType;
    conflicts: ConflictEntry[];
    isStale: boolean;
    staleReasons: StaleReasonCode[];

    // Context snapshots frozen at analysis time
    projectContextSnapshot: Record<string, unknown> | null;
    projectTechnicalBaselineSnapshot: Record<string, unknown> | null;

    // Built on demand by buildCanonicalSearchText() — not always populated
    canonicalSearchText?: string;
}

// ─── RequirementAnalysis ─────────────────────────────────────────

export interface RequirementAnalysisRow {
    id: string;
    requirement_id: string;
    /** @deprecated Use requirement_understanding_id FK to read from artifact table */
    understanding: Record<string, unknown> | null;
    /** FK to canonical artifact table (set on new writes) */
    requirement_understanding_id: string | null;
    input_description: string;
    input_tech_category: string | null;
    confidence: number | null;
    created_by: string;
    created_at: string;

    // ── Canonical profile hub fields (added 20260411_canonical_profile_hub) ──

    /** Single anchor into the artifact triad. Traversing this UUID gives
     *  based_on_understanding_id and based_on_impact_map_id for free. */
    pinned_blueprint_id: string | null;
    /** Snapshot of estimation_blueprint.version at pin time — for audit. */
    pinned_blueprint_version: number | null;

    /** Detected conflicts between artifact sources. Persisted as materialized cache.
     *  Shape: ConflictEntry[] — see canonical-profile.service.ts for conflict rules. */
    conflicts: ConflictEntry[];

    /** Lazy-evaluated stale flag. True when any stale_reason is present. */
    is_stale: boolean;
    /** Set of StaleReasonCode values indicating why the profile is stale. */
    stale_reasons: StaleReasonCode[];

    /** ProjectContext at the moment this analysis was created. */
    project_context_snapshot: Record<string, unknown> | null;
    /** ProjectTechnicalBlueprint at the moment this analysis was created. */
    project_technical_baseline_snapshot: Record<string, unknown> | null;

    /** Canonical embedding — populated async after canonicalSearchText stabilises.
     *  NULL until generated; query with AND is_embedding_stale = false. */
    canonical_embedding: number[] | null;  // vector(1536) serialised as number[]
    /** Format version of the search text used to generate the embedding. */
    canonical_embedding_version: number;
    /** True when source artifacts changed after embedding was generated. */
    is_embedding_stale: boolean;
}

export interface CreateRequirementAnalysisInput {
    requirement_id: string;
    /** @deprecated Pass requirement_understanding_id instead of inline JSONB */
    understanding?: Record<string, unknown> | null;
    /** FK to canonical requirement_understanding artifact */
    requirement_understanding_id?: string | null;
    input_description: string;
    input_tech_category?: string | null;
    confidence?: number | null;
    created_by: string;

    // ── Canonical profile hub fields — optional on create, set after wizard completion ──
    pinned_blueprint_id?: string | null;
    pinned_blueprint_version?: number | null;
    conflicts?: ConflictEntry[];
    is_stale?: boolean;
    stale_reasons?: StaleReasonCode[];
    project_context_snapshot?: Record<string, unknown> | null;
    project_technical_baseline_snapshot?: Record<string, unknown> | null;
}

// ─── ImpactMap (domain model, distinct from legacy impact_map table) ──

export interface ImpactMapDomainRow {
    id: string;
    analysis_id: string;
    /** @deprecated Use artifact_impact_map_id FK to read from artifact table */
    impact_data: Record<string, unknown> | null;
    /** FK to canonical impact_map artifact table (set on new writes) */
    artifact_impact_map_id: string | null;
    confidence: number | null;
    created_by: string;
    created_at: string;
}

export interface CreateImpactMapInput {
    analysis_id: string;
    /** @deprecated Pass artifact_impact_map_id instead of inline JSONB */
    impact_data?: Record<string, unknown> | null;
    /** FK to canonical impact_map artifact */
    artifact_impact_map_id?: string | null;
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
