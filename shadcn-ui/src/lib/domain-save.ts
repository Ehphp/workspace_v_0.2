/**
 * domain-save.ts — Client-side domain orchestration adapter
 *
 * Mirrors the server-side orchestrateDomainSave / finalizeSnapshot
 * using the browser's Supabase client. Used by RequirementWizard
 * to create domain chain artifacts alongside the legacy save.
 *
 * Chain: Analysis → ImpactMap → CandidateSet → Decision → Estimation → Snapshot
 */

import { supabase } from './supabase';
import { calculateEstimation } from './estimationEngine';
import type { Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';
import type {
    CandidateActivity,
    RequirementAnalysisRow,
    ImpactMapDomainRow,
    CandidateSetRow,
    EstimationDecisionRow,
    EstimationSnapshotData,
    EstimationSnapshotRow,
} from '@/types/domain-model';

const ENGINE_VERSION = '2.0.0';

// ─── Resolved activity/driver/risk with full data ───────────────

export interface ResolvedActivity {
    activity_id: string;
    code: string;
    base_hours: number;
    is_ai_suggested: boolean;
}

export interface ResolvedDriver {
    driver_id: string;
    code: string;
    selected_value: string;
    multiplier: number;
}

export interface ResolvedRisk {
    risk_id: string;
    code: string;
    weight: number;
}

// ─── Resolve wizard codes into domain-ready objects ─────────────

export function resolveWizardActivities(
    selectedCodes: string[],
    aiSuggestedCodes: string[],
    masterActivities: Activity[],
): ResolvedActivity[] {
    return selectedCodes
        .map((code) => {
            const activity = masterActivities.find((a) => a.code === code);
            if (!activity) return null;
            return {
                activity_id: activity.id,
                code: activity.code,
                base_hours: activity.base_hours,
                is_ai_suggested: aiSuggestedCodes.includes(code),
            };
        })
        .filter((a): a is ResolvedActivity => a !== null);
}

export function resolveWizardDrivers(
    selectedDriverValues: Record<string, string>,
    masterDrivers: Driver[],
): ResolvedDriver[] {
    return Object.entries(selectedDriverValues)
        .map(([code, value]) => {
            const driver = masterDrivers.find((d) => d.code === code);
            if (!driver) return null;
            const option = driver.options.find((o) => o.value === value);
            return {
                driver_id: driver.id,
                code: driver.code,
                selected_value: value,
                multiplier: option?.multiplier ?? 1.0,
            };
        })
        .filter((d): d is ResolvedDriver => d !== null);
}

export function resolveWizardRisks(
    selectedCodes: string[],
    masterRisks: Risk[],
): ResolvedRisk[] {
    return selectedCodes
        .map((code) => {
            const risk = masterRisks.find((r) => r.code === code);
            if (!risk) return null;
            return {
                risk_id: risk.id,
                code: risk.code,
                weight: risk.weight,
            };
        })
        .filter((r): r is ResolvedRisk => r !== null);
}

// ─── ID-based resolvers (for RequirementDetail / manual edit) ───

export function resolveActivitiesById(
    selectedIds: string[],
    aiSuggestedIds: string[],
    masterActivities: Activity[],
): ResolvedActivity[] {
    return selectedIds
        .map((id) => {
            const activity = masterActivities.find((a) => a.id === id);
            if (!activity) return null;
            return {
                activity_id: activity.id,
                code: activity.code,
                base_hours: activity.base_hours,
                is_ai_suggested: aiSuggestedIds.includes(id),
            };
        })
        .filter((a): a is ResolvedActivity => a !== null);
}

export function resolveDriversById(
    selectedDriverValues: Record<string, string>,
    masterDrivers: Driver[],
): ResolvedDriver[] {
    return Object.entries(selectedDriverValues)
        .map(([driverId, value]) => {
            const driver = masterDrivers.find((d) => d.id === driverId);
            if (!driver) return null;
            const option = driver.options.find((o) => o.value === value);
            return {
                driver_id: driver.id,
                code: driver.code,
                selected_value: value,
                multiplier: option?.multiplier ?? 1.0,
            };
        })
        .filter((d): d is ResolvedDriver => d !== null);
}

export function resolveRisksById(
    selectedIds: string[],
    masterRisks: Risk[],
): ResolvedRisk[] {
    return selectedIds
        .map((id) => {
            const risk = masterRisks.find((r) => r.id === id);
            if (!risk) return null;
            return {
                risk_id: risk.id,
                code: risk.code,
                weight: risk.weight,
            };
        })
        .filter((r): r is ResolvedRisk => r !== null);
}

// ─── Domain orchestration input / output ────────────────────────

export interface WizardDomainSaveInput {
    requirementId: string;
    userId: string;
    description: string;
    techCategory?: string | null;
    technologyId?: string | null;
    blueprintId?: string | null;
    understanding?: Record<string, unknown> | null;
    /** UUID of the canonical requirement_understanding artifact row */
    requirementUnderstandingId?: string | null;
    impactMapData?: Record<string, unknown> | null;
    /** UUID of the canonical impact_map artifact row */
    artifactImpactMapId?: string | null;
    activities: ResolvedActivity[];
    drivers: ResolvedDriver[];
    risks: ResolvedRisk[];
    /**
     * Enriched candidates from CandidateBuilder (with provenance).
     * When provided, persisted directly instead of the pass-through buildCandidates().
     */
    enrichedCandidates?: CandidateActivity[];

    /** Artifact traceability — understanding version at estimation time */
    basedOnUnderstandingVersion?: number | null;
    /** Artifact traceability — impact map ID at estimation time */
    basedOnImpactMapId?: string | null;
}

export interface WizardDomainSaveResult {
    analysisId: string;
    decisionId: string;
    estimation: EstimationResult;
}

// ─── Supabase CRUD (frontend client) ────────────────────────────

async function getLatestAnalysis(requirementId: string): Promise<RequirementAnalysisRow | null> {
    const { data, error } = await supabase
        .from('requirement_analyses')
        .select('*')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Failed to fetch analysis: ${error.message}`);
    return data as RequirementAnalysisRow | null;
}

async function createAnalysis(input: {
    requirement_id: string;
    understanding?: Record<string, unknown> | null;
    requirement_understanding_id?: string | null;
    input_description: string;
    input_tech_category: string | null;
    confidence: number | null;
    created_by: string;
}): Promise<RequirementAnalysisRow> {
    const { data, error } = await supabase
        .from('requirement_analyses')
        .insert(input)
        .select()
        .single();
    if (error || !data) throw new Error(`Failed to create RequirementAnalysis: ${error?.message}`);
    return data as RequirementAnalysisRow;
}

async function getLatestImpactMap(analysisId: string): Promise<ImpactMapDomainRow | null> {
    const { data, error } = await supabase
        .from('impact_maps')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Failed to fetch impact map: ${error.message}`);
    return data as ImpactMapDomainRow | null;
}

async function createImpactMapDomain(input: {
    analysis_id: string;
    impact_data?: Record<string, unknown> | null;
    artifact_impact_map_id?: string | null;
    confidence: number | null;
    created_by: string;
}): Promise<ImpactMapDomainRow> {
    const { data, error } = await supabase
        .from('impact_maps')
        .insert(input)
        .select()
        .single();
    if (error || !data) throw new Error(`Failed to create ImpactMap: ${error?.message}`);
    return data as ImpactMapDomainRow;
}

async function createCandidateSet(input: {
    analysis_id: string;
    impact_map_id: string | null;
    technology_id: string | null;
    candidates: CandidateActivity[];
    created_by: string;
}): Promise<CandidateSetRow> {
    const { data, error } = await supabase
        .from('candidate_sets')
        .insert(input)
        .select()
        .single();
    if (error || !data) throw new Error(`Failed to create CandidateSet: ${error?.message}`);
    return data as CandidateSetRow;
}

async function createDecision(input: {
    candidate_set_id: string;
    selected_activity_ids: string[];
    excluded_activity_ids: string[];
    driver_values: { driver_id: string; selected_value: string }[];
    risk_ids: string[];
    warnings: string[];
    assumptions: string[];
    decision_confidence: number | null;
    based_on_understanding_version?: number | null;
    based_on_impact_map_id?: string | null;
    created_by: string;
}): Promise<EstimationDecisionRow> {
    const { data, error } = await supabase
        .from('estimation_decisions')
        .insert(input)
        .select()
        .single();
    if (error || !data) throw new Error(`Failed to create EstimationDecision: ${error?.message}`);
    return data as EstimationDecisionRow;
}

async function createSnapshot(input: {
    estimation_id: string;
    snapshot_data: EstimationSnapshotData;
    engine_version: string;
    created_by: string;
}): Promise<EstimationSnapshotRow> {
    const { data, error } = await supabase
        .from('estimation_snapshots')
        .insert(input)
        .select()
        .single();
    if (error || !data) throw new Error(`Failed to create EstimationSnapshot: ${error?.message}`);
    return data as EstimationSnapshotRow;
}

// ─── Build candidates from resolved activities ──────────────────

function buildCandidates(activities: ResolvedActivity[]): CandidateActivity[] {
    return activities.map((a) => ({
        activity_id: a.activity_id,
        activity_code: a.code,
        source: (a.is_ai_suggested ? 'ai' : 'manual') as CandidateActivity['source'],
        score: a.is_ai_suggested ? 80 : 100,
        confidence: a.is_ai_suggested ? 0.7 : 1.0,
    }));
}

// ─── Main orchestration ─────────────────────────────────────────

/**
 * Client-side domain orchestration for the wizard save flow.
 *
 * Creates: RequirementAnalysis, ImpactMap (optional), CandidateSet,
 * EstimationDecision. Computes estimation via the canonical engine.
 *
 * Returns analysisId + decisionId for the RPC save call,
 * and the domain-computed estimation as the source of truth.
 */
export async function orchestrateWizardDomainSave(
    input: WizardDomainSaveInput,
): Promise<WizardDomainSaveResult> {
    // 1. Ensure RequirementAnalysis exists (FK-first: prefer FK to canonical artifact)
    let analysis = await getLatestAnalysis(input.requirementId);
    if (!analysis && (input.understanding || input.requirementUnderstandingId)) {
        analysis = await createAnalysis({
            requirement_id: input.requirementId,
            requirement_understanding_id: input.requirementUnderstandingId ?? null,
            understanding: input.requirementUnderstandingId ? null : (input.understanding ?? null),
            input_description: input.description,
            input_tech_category: input.techCategory ?? null,
            confidence: null,
            created_by: input.userId,
        });
    }
    if (!analysis) {
        analysis = await createAnalysis({
            requirement_id: input.requirementId,
            understanding: { _legacy: true, description: input.description },
            input_description: input.description,
            input_tech_category: input.techCategory ?? null,
            confidence: null,
            created_by: input.userId,
        });
    }

    // 2. Impact map (optional — FK-first: prefer FK to canonical artifact)
    let impactMap = await getLatestImpactMap(analysis.id);
    if (!impactMap && (input.impactMapData || input.artifactImpactMapId)) {
        impactMap = await createImpactMapDomain({
            analysis_id: analysis.id,
            artifact_impact_map_id: input.artifactImpactMapId ?? null,
            impact_data: input.artifactImpactMapId ? null : (input.impactMapData ?? null),
            confidence: null,
            created_by: input.userId,
        });
    }

    // 3. Build & persist CandidateSet
    // Use enriched candidates from CandidateBuilder when available (with provenance),
    // fall back to pass-through builder for legacy/manual paths.
    const candidates = input.enrichedCandidates ?? buildCandidates(input.activities);
    const candidateSet = await createCandidateSet({
        analysis_id: analysis.id,
        impact_map_id: impactMap?.id ?? null,
        technology_id: input.technologyId ?? null,
        candidates,
        created_by: input.userId,
    });

    // 4. Create EstimationDecision
    const decision = await createDecision({
        candidate_set_id: candidateSet.id,
        selected_activity_ids: input.activities.map((a) => a.activity_id),
        excluded_activity_ids: [],
        driver_values: input.drivers.map((d) => ({
            driver_id: d.driver_id,
            selected_value: d.selected_value,
        })),
        risk_ids: input.risks.map((r) => r.risk_id),
        warnings: [],
        assumptions: [],
        decision_confidence: null,
        based_on_understanding_version: input.basedOnUnderstandingVersion ?? null,
        based_on_impact_map_id: input.basedOnImpactMapId ?? input.artifactImpactMapId ?? null,
        created_by: input.userId,
    });

    // 5. Compute estimation via the canonical engine
    const estimation = calculateEstimation({
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

    return {
        analysisId: analysis.id,
        decisionId: decision.id,
        estimation,
    };
}

// ─── Snapshot finalization ───────────────────────────────────────

/**
 * Create the immutable snapshot after the estimation RPC save completes.
 */
export async function finalizeWizardSnapshot(input: {
    estimationId: string;
    userId: string;
    analysisId: string;
    decisionId: string;
    blueprintId: string | null;
    activities: ResolvedActivity[];
    drivers: ResolvedDriver[];
    risks: ResolvedRisk[];
    estimation: EstimationResult;
}): Promise<string> {
    const snapshotData: EstimationSnapshotData = {
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
        totals: {
            base_days: input.estimation.baseDays,
            driver_multiplier: input.estimation.driverMultiplier,
            subtotal: input.estimation.subtotal,
            risk_score: input.estimation.riskScore,
            contingency_percent: input.estimation.contingencyPercent,
            contingency_days: input.estimation.contingencyDays,
            total_days: input.estimation.totalDays,
        },
        metadata: {
            engine_version: ENGINE_VERSION,
            analysis_id: input.analysisId,
            decision_id: input.decisionId,
            blueprint_id: input.blueprintId,
            created_at: new Date().toISOString(),
        },
    };

    const snapshot = await createSnapshot({
        estimation_id: input.estimationId,
        snapshot_data: snapshotData,
        engine_version: ENGINE_VERSION,
        created_by: input.userId,
    });

    return snapshot.id;
}
