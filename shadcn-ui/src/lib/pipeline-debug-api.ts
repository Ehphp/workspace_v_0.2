/**
 * pipeline-debug-api.ts — API client for the Pipeline Debug dashboard.
 *
 * Calls ai-estimate-from-interview with a devConfig override block,
 * stores results in localStorage, and exposes typed history helpers.
 *
 * When requirementId is provided, loads all artifacts from the DB
 * (requirementUnderstanding, impactMap, estimationBlueprint, projectTechnicalBlueprint)
 * so the debug run is identical to the real wizard flow.
 */

import { supabase } from '@/lib/supabase';
import { buildFunctionUrl } from '@/lib/netlify';
import {
    getLatestRequirementUnderstanding,
    getLatestImpactMap,
    getLatestEstimationBlueprint,
    fetchProject,
    fetchRequirement,
} from '@/lib/api';
import { getLatestProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import type { EstimationFromInterviewResponse } from '@/types/requirement-interview';

// ─── Full Pipeline Debug Types ────────────────────────────────────────────────

export type DebugStepId =
    | 'validate'
    | 'understanding'
    | 'impact-map'
    | 'blueprint'
    | 'interview'
    | 'estimate';

export type DebugStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface DebugStep {
    id: DebugStepId;
    label: string;
    endpoint: string;
    status: DebugStepStatus;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    durationMs?: number;
    error?: string;
    note?: string;
}

export interface FullDebugRun {
    id: string;
    timestamp: string;
    config: DebugRunConfig;
    steps: DebugStep[];
    totalDurationMs: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebugKillSwitches {
    agenticEnabled: boolean;
    reflectionEnabled: boolean;
    toolUseEnabled: boolean;
    blueprintSignalEnabled: boolean;
    impactMapSignalEnabled: boolean;
    understandingSignalEnabled: boolean;
    projectActivitySignalEnabled: boolean;
    agentDeltaEnabled: boolean;
}

export const DEFAULT_KS: DebugKillSwitches = {
    agenticEnabled: true,
    reflectionEnabled: true,
    toolUseEnabled: true,
    blueprintSignalEnabled: true,
    impactMapSignalEnabled: true,
    understandingSignalEnabled: true,
    projectActivitySignalEnabled: true,
    agentDeltaEnabled: true,
};

export type ForceMode = 'default' | 'deterministic';

export interface DebugRunConfig {
    description: string;
    techCategory: string;
    projectId?: string;
    /** When set, artifacts are loaded from DB before running (mirrors wizard flow) */
    requirementId?: string;
    killSwitches: DebugKillSwitches;
    forceMode: ForceMode;
}

export interface DebugActivityContributions {
    blueprint: number;
    impactMap: number;
    understanding: number;
    keyword: number;
    projectContext: number;
    projectActivity: number;
}

export interface DebugActivity {
    code: string;
    name: string;
    baseHours: number;
    /** Candidate score from synthesizer (before DecisionEngine) */
    score?: number;
    /** Which source contributed most to this activity's score */
    primarySource?: string;
    /** Per-source score contributions */
    contributions?: DebugActivityContributions;
    /** LLM reason (agentic) or "Score X.XX (source)" (deterministic) */
    reason?: string;
}

export interface DebugDecisionTraceEntry {
    step: string;
    action: string;
    code: string;
    reason: string;
    score?: number;
    layer?: string;
}

/** Which artifacts were found and sent with this run */
export interface DebugArtifacts {
    hasUnderstanding: boolean;
    hasImpactMap: boolean;
    hasEstimationBlueprint: boolean;
    hasProjectBlueprint: boolean;
}

export interface DebugRun {
    id: string;
    timestamp: string;
    config: DebugRunConfig;
    /** Artifacts loaded from DB for this run (undefined = no requirementId was provided) */
    artifacts?: DebugArtifacts;
    result: {
        totalBaseDays: number;
        confidenceScore: number;
        /** Full activity objects with provenance — preferred for display */
        activities: DebugActivity[];
        /** Kept for backwards-compat with old localStorage entries */
        activitiesSelected: string[];
        pipelineMode: string;
    };
    /** Decision trace from DecisionEngine (deterministic path only) */
    decisionTrace?: DebugDecisionTraceEntry[];
    trace: EstimationFromInterviewResponse['pipelineTrace'];
    error?: string;
    durationMs: number;
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'pipeline_debug_runs_v1';
const MAX_RUNS = 10;

export function loadDebugHistory(): DebugRun[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveDebugRun(run: DebugRun): DebugRun[] {
    const history = loadDebugHistory();
    const updated = [run, ...history].slice(0, MAX_RUNS);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    return updated;
}

export function clearDebugHistory(): void {
    localStorage.removeItem(LS_KEY);
}

// ─── Artifact loader ──────────────────────────────────────────────────────────

async function loadArtifacts(requirementId: string, projectId?: string): Promise<{
    body: Record<string, unknown>;
    artifacts: DebugArtifacts;
}> {
    // Requirement needs projectId; skip if missing (we still get artifacts by requirementId).
    const requirementPromise = projectId
        ? fetchRequirement(projectId, requirementId).catch(() => null)
        : Promise.resolve(null);

    const [
        understandingRow,
        impactMapRow,
        blueprintRow,
        projectBlueprint,
        project,
        requirement,
    ] = await Promise.all([
        getLatestRequirementUnderstanding(requirementId).catch(() => null),
        getLatestImpactMap(requirementId).catch(() => null),
        getLatestEstimationBlueprint(requirementId).catch(() => null),
        projectId ? getLatestProjectTechnicalBlueprint(projectId).catch(() => null) : Promise.resolve(null),
        projectId ? fetchProject(projectId).catch(() => null) : Promise.resolve(null),
        requirementPromise,
    ]);

    // Build projectContext with the exact shape the wizard sends (see
    // ai-estimate-from-interview handler). Empty/nullish fields are omitted
    // via the spread so the handler receives only present values.
    const projectContext = project
        ? {
            name: project.name,
            description: project.description || '',
            ...(project.owner ? { owner: project.owner } : {}),
            ...(project.project_type ? { projectType: project.project_type } : {}),
            ...(project.domain ? { domain: project.domain } : {}),
            ...(project.scope ? { scope: project.scope } : {}),
            ...(project.team_size != null ? { teamSize: project.team_size } : {}),
            ...(project.deadline_pressure ? { deadlinePressure: project.deadline_pressure } : {}),
            ...(project.methodology ? { methodology: project.methodology } : {}),
        }
        : null;

    // Requirement-scoped technology wins over project default.
    const techPresetId =
        requirement?.technology_id
        ?? requirement?.tech_preset_id
        ?? project?.technology_id
        ?? project?.tech_preset_id
        ?? null;

    const artifacts: DebugArtifacts = {
        hasUnderstanding: !!understandingRow?.understanding,
        hasImpactMap: !!impactMapRow?.impact_map,
        hasEstimationBlueprint: !!blueprintRow?.blueprint,
        hasProjectBlueprint: !!projectBlueprint,
    };

    const body: Record<string, unknown> = {};
    if (understandingRow?.understanding)  body.requirementUnderstanding = understandingRow.understanding;
    if (impactMapRow?.impact_map)         body.impactMap = impactMapRow.impact_map;
    if (blueprintRow?.blueprint)          body.estimationBlueprint = blueprintRow.blueprint;
    if (projectBlueprint)                 body.projectTechnicalBlueprint = projectBlueprint;
    if (projectContext)                   body.projectContext = projectContext;
    if (techPresetId)                     body.techPresetId = techPresetId;

    return { body, artifacts };
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function runDebugEstimation(config: DebugRunConfig): Promise<DebugRun> {
    const start = Date.now();
    const id = crypto.randomUUID();

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // Load artifacts from DB if we have a requirementId (mirrors wizard flow)
    let artifactBody: Record<string, unknown> = {};
    let artifacts: DebugArtifacts | undefined;
    if (config.requirementId) {
        const loaded = await loadArtifacts(config.requirementId, config.projectId);
        artifactBody = loaded.body;
        artifacts = loaded.artifacts;
    }

    const body = {
        description: config.description,
        techCategory: config.techCategory,
        ...(config.projectId ? { projectId: config.projectId } : {}),
        ...artifactBody,
        answers: {},
        devConfig: {
            killSwitches: config.killSwitches,
            forceMode: config.forceMode === 'deterministic' ? 'deterministic' : undefined,
        },
    };

    try {
        const response = await fetch(buildFunctionUrl('ai-estimate-from-interview'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify(body),
        });

        const data: EstimationFromInterviewResponse = await response.json();
        const durationMs = Date.now() - start;

        if (!response.ok || !data.success) {
            return {
                id,
                timestamp: new Date().toISOString(),
                config,
                artifacts,
                result: { totalBaseDays: 0, confidenceScore: 0, activities: [], activitiesSelected: [], pipelineMode: 'error' },
                trace: undefined,
                error: (data as any).message
                    || (typeof data.error === 'object' ? (data.error as any)?.message : data.error)
                    || `HTTP ${response.status}`,
                durationMs,
            };
        }

        // Build a provenance lookup by code for fast join
        const provByCode = new Map(
            (data.candidateProvenance ?? []).map(p => [p.code, p])
        );

        const activities: DebugActivity[] = data.activities.map(a => {
            const prov = provByCode.get(a.code);
            return {
                code: a.code,
                name: a.name,
                baseHours: a.baseHours,
                score: prov?.score,
                primarySource: prov?.primarySource,
                contributions: prov ? {
                    blueprint:       prov.contributions.blueprint ?? 0,
                    impactMap:       prov.contributions.impactMap ?? 0,
                    understanding:   prov.contributions.understanding ?? 0,
                    keyword:         prov.contributions.keyword ?? 0,
                    projectContext:  prov.contributions.projectContext ?? 0,
                    projectActivity: prov.contributions.projectActivity ?? 0,
                } : undefined,
                reason: a.reason,
            };
        });

        return {
            id,
            timestamp: new Date().toISOString(),
            config,
            artifacts,
            result: {
                totalBaseDays: data.totalBaseDays,
                confidenceScore: data.confidenceScore,
                activities,
                activitiesSelected: data.activities.map(a => a.code),
                pipelineMode: data.pipelineTrace?.pipelineMode ?? 'unknown',
            },
            decisionTrace: data.decisionTrace,
            trace: data.pipelineTrace,
            durationMs,
        };
    } catch (err: any) {
        return {
            id,
            timestamp: new Date().toISOString(),
            config,
            artifacts,
            result: { totalBaseDays: 0, confidenceScore: 0, activities: [], activitiesSelected: [], pipelineMode: 'error' },
            trace: undefined,
            error: err?.message ?? 'Network error',
            durationMs: Date.now() - start,
        };
    }
}

// ─── Full Pipeline Runner ─────────────────────────────────────────────────────

const STEP_DEFS: Pick<DebugStep, 'id' | 'label' | 'endpoint'>[] = [
    { id: 'validate',      label: 'Validate Requirement',      endpoint: 'ai-validate-requirement'      },
    { id: 'understanding', label: 'Requirement Understanding', endpoint: 'ai-requirement-understanding' },
    { id: 'impact-map',    label: 'Impact Map',                endpoint: 'ai-impact-map'                },
    { id: 'blueprint',     label: 'Estimation Blueprint',      endpoint: 'ai-estimation-blueprint'      },
    { id: 'interview',     label: 'Requirement Interview',     endpoint: 'ai-requirement-interview'     },
    { id: 'estimate',      label: 'Estimate from Interview',   endpoint: 'ai-estimate-from-interview'   },
];

export async function runFullDebugPipeline(
    config: DebugRunConfig,
    onProgress: (steps: DebugStep[]) => void
): Promise<FullDebugRun> {
    const runId = crypto.randomUUID();
    const globalStart = Date.now();

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    const steps: DebugStep[] = STEP_DEFS.map(def => ({ ...def, status: 'pending' as const }));
    const emit = () => onProgress([...steps]);
    emit();

    let ctxFromDb: Record<string, unknown> = {};
    if (config.requirementId) {
        const loaded = await loadArtifacts(config.requirementId, config.projectId);
        ctxFromDb = loaded.body;
    }

    const ctx: Record<string, unknown> = { ...ctxFromDb };

    // Remove DB artifacts for disabled steps so they don't leak into downstream requests
    if (!config.killSwitches.understandingSignalEnabled) delete ctx.requirementUnderstanding;
    if (!config.killSwitches.impactMapSignalEnabled)     delete ctx.impactMap;
    if (!config.killSwitches.blueprintSignalEnabled)     delete ctx.estimationBlueprint;

    function skipStep(id: DebugStepId) {
        const step = steps.find(s => s.id === id)!;
        step.status = 'skipped';
        emit();
    }

    async function runStep(id: DebugStepId, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
        const step = steps.find(s => s.id === id)!;
        step.status = 'running';
        step.request = body;
        emit();

        const t = Date.now();
        try {
            const res = await fetch(buildFunctionUrl(step.endpoint), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            step.durationMs = Date.now() - t;
            step.response = data;

            if (!res.ok || data.success === false) {
                step.status = 'error';
                step.error =
                    data.error?.message ??
                    data.message ??
                    (typeof data.error === 'string' ? data.error : undefined) ??
                    `HTTP ${res.status}`;
                emit();
                return null;
            }

            step.status = 'success';
            emit();
            return data;
        } catch (err: any) {
            step.durationMs = Date.now() - t;
            step.status = 'error';
            step.error = err?.message ?? 'Network error';
            emit();
            return null;
        }
    }

    const base = {
        description: config.description,
        techCategory: config.techCategory,
        ...(config.projectId              ? { projectId: config.projectId }                              : {}),
        ...(ctx.techPresetId              ? { techPresetId: ctx.techPresetId }                           : {}),
        ...(ctx.projectContext            ? { projectContext: ctx.projectContext }                       : {}),
        ...(ctx.projectTechnicalBlueprint ? { projectTechnicalBlueprint: ctx.projectTechnicalBlueprint } : {}),
    };

    // Step 1 — Validate
    await runStep('validate', { description: config.description });

    // Step 2 — Understanding
    if (config.killSwitches.understandingSignalEnabled) {
        const understandingData = await runStep('understanding', { ...base });
        if (understandingData?.understanding) ctx.requirementUnderstanding = understandingData.understanding;
    } else {
        skipStep('understanding');
    }

    // Step 3 — Impact Map
    if (config.killSwitches.impactMapSignalEnabled) {
        const impactMapData = await runStep('impact-map', {
            ...base,
            ...(ctx.requirementUnderstanding ? { requirementUnderstanding: ctx.requirementUnderstanding } : {}),
        });
        if (impactMapData?.impactMap) ctx.impactMap = impactMapData.impactMap;
    } else {
        skipStep('impact-map');
    }

    // Step 4 — Estimation Blueprint
    if (config.killSwitches.blueprintSignalEnabled) {
        const blueprintData = await runStep('blueprint', {
            ...base,
            ...(ctx.requirementUnderstanding ? { requirementUnderstanding: ctx.requirementUnderstanding } : {}),
            ...(ctx.impactMap                ? { impactMap: ctx.impactMap }                                : {}),
        });
        if (blueprintData?.blueprint) ctx.estimationBlueprint = blueprintData.blueprint;
    } else {
        skipStep('blueprint');
    }

    // Step 5 — Interview
    const interviewData = await runStep('interview', {
        ...base,
        ...(ctx.requirementUnderstanding ? { requirementUnderstanding: ctx.requirementUnderstanding } : {}),
        ...(ctx.impactMap                ? { impactMap: ctx.impactMap }                                : {}),
        ...(ctx.estimationBlueprint      ? { estimationBlueprint: ctx.estimationBlueprint }            : {}),
    });
    if (interviewData?.decision === 'SKIP') {
        const interviewStep = steps.find(s => s.id === 'interview')!;
        interviewStep.note = `SKIP — ${interviewData.reasoning ?? 'intervista non necessaria'}`;
        emit();
    }

    // Step 6 — Estimate
    await runStep('estimate', {
        description: config.description,
        techCategory: config.techCategory,
        ...(config.projectId              ? { projectId: config.projectId }                              : {}),
        ...(ctx.techPresetId              ? { techPresetId: ctx.techPresetId }                           : {}),
        ...(ctx.projectContext            ? { projectContext: ctx.projectContext }                       : {}),
        ...(ctx.requirementUnderstanding  ? { requirementUnderstanding: ctx.requirementUnderstanding }  : {}),
        ...(ctx.impactMap                 ? { impactMap: ctx.impactMap }                                 : {}),
        ...(ctx.estimationBlueprint       ? { estimationBlueprint: ctx.estimationBlueprint }             : {}),
        ...(ctx.projectTechnicalBlueprint ? { projectTechnicalBlueprint: ctx.projectTechnicalBlueprint } : {}),
        answers: {},
        devConfig: {
            killSwitches: config.killSwitches,
            forceMode: config.forceMode === 'deterministic' ? 'deterministic' : undefined,
        },
    });

    return {
        id: runId,
        timestamp: new Date().toISOString(),
        config,
        steps: [...steps],
        totalDurationMs: Date.now() - globalStart,
    };
}
