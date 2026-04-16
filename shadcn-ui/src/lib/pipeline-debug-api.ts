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
} from '@/lib/api';
import { getLatestProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import type { EstimationFromInterviewResponse } from '@/types/requirement-interview';

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

export interface DebugActivity {
    code: string;
    name: string;
    baseHours: number;
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
        /** Full activity objects — preferred for display */
        activities: DebugActivity[];
        /** Kept for backwards-compat with old localStorage entries */
        activitiesSelected: string[];
        pipelineMode: string;
    };
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
    const [understandingRow, impactMapRow, blueprintRow, projectBlueprint] = await Promise.all([
        getLatestRequirementUnderstanding(requirementId).catch(() => null),
        getLatestImpactMap(requirementId).catch(() => null),
        getLatestEstimationBlueprint(requirementId).catch(() => null),
        projectId ? getLatestProjectTechnicalBlueprint(projectId).catch(() => null) : Promise.resolve(null),
    ]);

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

        return {
            id,
            timestamp: new Date().toISOString(),
            config,
            artifacts,
            result: {
                totalBaseDays: data.totalBaseDays,
                confidenceScore: data.confidenceScore,
                activities: data.activities.map(a => ({ code: a.code, name: a.name, baseHours: a.baseHours })),
                activitiesSelected: data.activities.map(a => a.code),
                pipelineMode: data.pipelineTrace?.pipelineMode ?? 'unknown',
            },
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
