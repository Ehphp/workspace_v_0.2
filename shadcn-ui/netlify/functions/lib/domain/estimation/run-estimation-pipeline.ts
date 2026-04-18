/**
 * run-estimation-pipeline.ts — Deterministic candidate pipeline (pure, no I/O)
 *
 * Encapsulates the signal extraction → candidate synthesis stage that runs
 * on every estimation request BEFORE the agent is invoked.
 *
 * Responsibilities:
 *   1. Run artifact extractors (blueprint, impact-map, understanding)
 *   2. Normalize outputs to SignalSet[]
 *   3. Inject keyword + project-activity signals
 *   4. Detect artifact staleness
 *   5. Compute aggregate confidence → candidate limit + pipeline config
 *   6. Synthesize ranked candidates
 *   7. Build provenance map
 *
 * This function has zero I/O and zero LLM calls.  It is the canonical
 * deterministic core that both the agentic path and the fallback path share.
 */

import type { Activity, ProjectActivity, InterviewAnswerRecord } from '../../infrastructure/db/activities';
import {
    mapBlueprintToActivities,
    isBlueprintMappable,
    blueprintToNormalizedSignals,
    type BlueprintMappingResult,
} from './blueprint-activity-mapper';
import {
    extractImpactMapSignals,
    impactMapToNormalizedSignals,
} from './impact-map-signal-extractor';
import {
    extractUnderstandingSignals,
    understandingToNormalizedSignals,
} from './understanding-signal-extractor';
import { keywordToNormalizedSignals } from '../pipeline/keyword-signal-adapter';
import { projectActivitiesToSignals } from '../pipeline/project-activity-signal-adapter';
import {
    synthesizeCandidates,
    computeCandidateLimit,
    type SynthesizedCandidateSet,
} from '../pipeline/candidate-synthesizer';
import type { SignalSet } from '../pipeline/signal-types';
import { buildProvenanceMap } from './provenance-map';
import type { ActivityProvenance } from './blueprint-activity-mapper';
import { computeAggregateConfidence } from './aggregate-confidence';
import { computePipelineConfig, type PipelineConfig } from '../pipeline/pipeline-config';
import type { ActivityBiases } from './project-context-rules';
import type { KillSwitches } from '../pipeline/kill-switches';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface EstimationPipelineInput {
    /** Sanitized requirement description */
    description: string;
    /** Interview answers (may be partial) */
    answers: Record<string, InterviewAnswerRecord>;
    /** Tech category (e.g. 'MULTI', 'PP') */
    techCategory: string;
    /** Full activity catalog for this tech category */
    activities: Activity[];
    /** Project-scoped custom activities (may be empty) */
    projectActivities: ProjectActivity[];
    /** Structured estimation blueprint (optional) */
    estimationBlueprint?: Record<string, unknown>;
    /** Structured impact map (optional) */
    impactMap?: Record<string, unknown>;
    /** Structured requirement understanding (optional) */
    requirementUnderstanding?: Record<string, unknown>;
    /** Project technical blueprint (optional, for keyword bias) */
    projectTechnicalBlueprint?: Record<string, unknown>;
    /** Activity bias hints from project/blueprint rules */
    activityBiases: ActivityBiases;
    /**
     * Signal-level kill switches. When omitted all signals are enabled.
     * Pass `readKillSwitches()` from the handler for runtime control.
     */
    killSwitches?: Pick<KillSwitches,
        | 'blueprintSignalEnabled'
        | 'impactMapSignalEnabled'
        | 'understandingSignalEnabled'
        | 'projectActivitySignalEnabled'
    >;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface EstimationPipelineResult {
    /** Fully ranked + scored candidates */
    candidateResult: SynthesizedCandidateSet;
    /** All signal sets that fed the synthesizer */
    signalSets: SignalSet[];
    /** Blueprint mapping output (undefined if blueprint was absent or not mappable) */
    blueprintMappingResult?: BlueprintMappingResult;
    /** Deterministic provenance map: code → provenance */
    provenanceMap: Map<string, ActivityProvenance>;
    /** Artifact staleness flag */
    isStale: boolean;
    /** Which artifacts triggered staleness */
    staleReasons: string[];
    /** Aggregate confidence score [0, 1] */
    aggregateConfidence: number;
    /** Dynamic candidate limit derived from confidence */
    candidateLimit: number;
    /** Pipeline behavior config derived from confidence */
    pipelineConfig: PipelineConfig;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Run the deterministic estimation pipeline.
 *
 * Returns a fully populated `EstimationPipelineResult` ready for the caller
 * to pass to either the agentic or deterministic (fallback) path.
 */
export function runEstimationPipeline(
    input: EstimationPipelineInput,
): EstimationPipelineResult {
    const {
        description,
        answers,
        techCategory,
        activities,
        projectActivities,
        estimationBlueprint,
        impactMap,
        requirementUnderstanding,
        activityBiases,
        killSwitches,
    } = input;

    // Resolve signal-level enable flags (default: all enabled)
    const sig = {
        blueprint:       killSwitches?.blueprintSignalEnabled       ?? true,
        impactMap:       killSwitches?.impactMapSignalEnabled        ?? true,
        understanding:   killSwitches?.understandingSignalEnabled    ?? true,
        projectActivity: killSwitches?.projectActivitySignalEnabled  ?? true,
    };

    // ── Step 1: Run artifact extractors ──────────────────────────────────────

    const blueprintMappingResult: BlueprintMappingResult | undefined =
        sig.blueprint && estimationBlueprint && isBlueprintMappable(estimationBlueprint)
            ? mapBlueprintToActivities(estimationBlueprint, activities, techCategory)
            : undefined;

    const impactMapResult =
        sig.impactMap && impactMap && (impactMap as any).impacts?.length > 0
            ? extractImpactMapSignals(impactMap as any, activities, techCategory)
            : undefined;

    const understandingResult =
        sig.understanding && requirementUnderstanding
            ? extractUnderstandingSignals(requirementUnderstanding as any, activities, techCategory)
            : undefined;

    // ── Step 2: Normalize to SignalSets ───────────────────────────────────────

    const signalSets: SignalSet[] = [];
    if (blueprintMappingResult) signalSets.push(blueprintToNormalizedSignals(blueprintMappingResult));
    if (impactMapResult)        signalSets.push(impactMapToNormalizedSignals(impactMapResult));
    if (understandingResult)    signalSets.push(understandingToNormalizedSignals(understandingResult));

    // Keyword signals (always present — baseline cannot be disabled).
    // topN scales DOWN as richer artifact signals are available: keyword is
    // supplemental when blueprint/impactMap/understanding are present, and
    // primary only when no artifacts exist.
    //   0 artifact signals → topN 15  (keyword is the only source)
    //   1 artifact signal  → topN 12
    //   2 artifact signals → topN 10
    //   3 artifact signals → topN  8
    const artifactSignalCount = signalSets.length; // signals added so far are all artifact-based
    const keywordTopN = Math.max(8, 15 - artifactSignalCount * 2);
    signalSets.push(keywordToNormalizedSignals({
        activities,
        description,
        answers,
        topN: keywordTopN,
        blueprint: estimationBlueprint,
        activityBiases,
    }));

    // Project-activity signals (highest weight: 4.0, conditional)
    if (sig.projectActivity && projectActivities.length > 0) {
        signalSets.push(projectActivitiesToSignals(
            projectActivities,
            estimationBlueprint,
        ));
    }

    // ── Step 3: Detect artifact staleness ────────────────────────────────────

    const bpGeneratedAt = (estimationBlueprint as any)?.metadata?.generatedAt as string | undefined;
    const uGeneratedAt  = (requirementUnderstanding as any)?.metadata?.generatedAt as string | undefined;
    const imGeneratedAt = (impactMap as any)?.metadata?.generatedAt as string | undefined;

    const staleReasons: string[] = [];
    if (bpGeneratedAt) {
        const bpTs = new Date(bpGeneratedAt).getTime();
        if (uGeneratedAt && new Date(uGeneratedAt).getTime() > bpTs) {
            staleReasons.push('UNDERSTANDING_UPDATED');
        }
        if (imGeneratedAt && new Date(imGeneratedAt).getTime() > bpTs) {
            staleReasons.push('IMPACT_MAP_UPDATED');
        }
    }
    const isStale = staleReasons.length > 0;

    // ── Step 4: Dynamic sizing ────────────────────────────────────────────────

    const aggregateConfidence = computeAggregateConfidence(
        requirementUnderstanding as Record<string, unknown> | null,
        impactMap as Record<string, unknown> | null,
        (estimationBlueprint ?? {}) as Record<string, unknown>,
        isStale,
    );
    const candidateLimit  = computeCandidateLimit(aggregateConfidence);
    const pipelineConfig  = computePipelineConfig(aggregateConfidence);

    // ── Step 5: Synthesize candidates ─────────────────────────────────────────

    const candidateResult: SynthesizedCandidateSet = synthesizeCandidates({
        signalSets,
        catalog: activities,
        projectCatalog: projectActivities.length > 0 ? projectActivities : undefined,
        techCategory,
        config: { maxCandidates: candidateLimit },
    });

    // ── Step 6: Build provenance map ──────────────────────────────────────────

    const rankedActivities = candidateResult.candidates.map(c => c.activity);
    const provenanceMap    = buildProvenanceMap(blueprintMappingResult, rankedActivities);

    return {
        candidateResult,
        signalSets,
        blueprintMappingResult,
        provenanceMap,
        isStale,
        staleReasons,
        aggregateConfidence,
        candidateLimit,
        pipelineConfig,
    };
}
