/**
 * estimation-orchestrator.ts — Pipeline di stima completa
 *
 * Orchestrates the full estimation flow in 4 sequential stages:
 *
 *   Stage 1 — fetch-activities
 *     Fetch the activity catalog (server-side) + project-scoped activities.
 *
 *   Stage 2 — evaluate-rules
 *     Apply deterministic rules derived from project context and project
 *     technical blueprint (activity biases, driver/risk suggestions).
 *
 *   Stage 3 — deterministic-pipeline
 *     Signal extraction (blueprint, impact-map, understanding, keyword,
 *     project-activity) → candidate synthesis → provenance map.
 *     Pure function — no I/O, no LLM calls.
 *
 *   Stage 4a — agentic-path  (default)
 *     Feed ranked candidates to the LLM agent. Agent selects activities,
 *     generates reasoning, suggests drivers/risks.
 *     Runs a deterministic baseline in parallel for delta observability.
 *
 *   Stage 4b — deterministic-fallback  (agent disabled or failed)
 *     DecisionEngine selects directly from candidates.
 *     No LLM call. Guaranteed 200 response.
 */

import { CircuitOpenError } from '../../infrastructure/llm/circuit-breaker';
import { runAgentPipeline } from '../../application/agent';
import type { AgentInput } from '../../application/agent';
import {
    fetchActivitiesServerSide,
    fetchProjectActivities,
    type Activity,
    type InterviewAnswerRecord,
    type ProjectActivity,
} from '../../infrastructure/db/activities';
import { attachProvenance, provenanceBreakdown } from './provenance-map';
import { evaluateProjectContextRules } from './project-context-rules';
import { evaluateProjectTechnicalBlueprintRules } from './blueprint-rules';
import { mergeProjectAndBlueprintRules } from './blueprint-context-integration';
import { mergeDriverSuggestions, mergeRiskSuggestions } from './project-context-integration';
import type { ProjectTechnicalBlueprint } from '../project/project-technical-blueprint.types';
import type { EstimationContext } from '../types/estimation';
import { formatProjectTechnicalBlueprintBlock } from '../../ai/formatters/project-blueprint-formatter';
import { formatProjectActivitiesBlock } from '../../ai/formatters/project-activities-formatter';
import { runEstimationPipeline } from './run-estimation-pipeline';
import { createPipelineLogger } from '../../observability/pipeline-logger';
import { runDecisionEngine } from '../pipeline/decision-engine';
import { computeAgentDelta } from '../../observability/pipeline-trace';
import type { PipelineTrace, SignalSourceStat } from '../../observability/pipeline-trace';
import type { KillSwitches } from '../pipeline/kill-switches';
import type { SynthesizedCandidateSet } from '../pipeline/candidate-synthesizer';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface OrchestratorInput {
    description: string;
    answers: Record<string, InterviewAnswerRecord>;
    techCategory: string;
    techPresetId?: string;
    /** @deprecated Kept for backward compat — activities are fetched server-side */
    activities?: Activity[];
    projectId?: string;
    projectContext?: {
        name: string;
        description: string;
        owner?: string;
        projectType?: string;
        domain?: string;
        scope?: string;
        teamSize?: number;
        deadlinePressure?: string;
        methodology?: string;
    };
    requirementUnderstanding?: Record<string, unknown>;
    impactMap?: Record<string, unknown>;
    estimationBlueprint?: Record<string, unknown>;
    projectTechnicalBlueprint?: Record<string, unknown>;
    killSwitches: KillSwitches;
    requestId: string;
    userId?: string;
    sanitizedDescription: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface EstimationMetrics {
    totalDurationMs: number;
    activitiesFetchMs: number;
    draftDurationMs: number;
    reflectionDurationMs: number;
    toolIterations: number;
    model: string;
    activitiesCatalogSize: number;
    activitiesAfterRanking: number;
    pipelineMode: 'agentic' | 'deterministic-fallback';
    timedOut: boolean;
    fallbackUsed: boolean;
    candidateSource: 'blueprint-mapper' | 'keyword-ranking' | 'vector-search';
    blueprintCoverage?: {
        componentCoveragePercent: number;
        fromBlueprint: number;
        fromFallback: number;
        missingGroups: string[];
    };
    blueprintWarnings?: Array<{ level: string; code: string; message: string }>;
}

export interface OrchestratorResult {
    success: true;
    generatedTitle: string;
    activities: ReturnType<typeof attachProvenance>;
    totalBaseDays: number;
    reasoning: string;
    confidenceScore: number;
    suggestedDrivers: Array<{
        code: string;
        suggestedValue?: string;
        reason: string;
        source: 'ai' | 'rule' | 'project_context_rule';
        fromQuestionId?: string | null;
    }>;
    suggestedRisks: string[];
    candidateProvenance: Array<{
        code: string;
        score: number;
        sources: unknown;
        contributions: unknown;
        primarySource: string;
        provenance: unknown;
        confidence: number;
    }>;
    decisionTrace?: unknown;
    coverageReport?: unknown;
    projectContextNotes?: string[];
    agentMetadata?: {
        executionId?: string;
        totalDurationMs: number;
        iterations: number;
        toolCallCount: number;
        model: string;
        reflectionAssessment?: string;
        reflectionConfidence?: number;
        engineValidation?: unknown;
    };
    metrics: EstimationMetrics;
    pipelineTrace: PipelineTrace;
    staleReasons?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyMetrics(model: string): EstimationMetrics {
    return {
        totalDurationMs: 0,
        activitiesFetchMs: 0,
        draftDurationMs: 0,
        reflectionDurationMs: 0,
        toolIterations: 0,
        model,
        activitiesCatalogSize: 0,
        activitiesAfterRanking: 0,
        pipelineMode: 'agentic',
        timedOut: false,
        fallbackUsed: false,
        candidateSource: 'keyword-ranking',
    };
}

function buildSignalSourceStats(
    pipeline: ReturnType<typeof runEstimationPipeline>,
    candidateResult: SynthesizedCandidateSet,
): SignalSourceStat[] {
    return pipeline.signalSets.map(ss => {
        const topN = ss.signals.slice(0, 5);
        const topAvgScore = topN.length > 0
            ? Number((topN.reduce((s, sig) => s + sig.score, 0) / topN.length).toFixed(3))
            : 0;
        const primaryCandidates = candidateResult.candidates.filter(c => c.primarySource === ss.source);
        const primarySourceShare = candidateResult.candidates.length > 0
            ? Number((primaryCandidates.length / candidateResult.candidates.length).toFixed(3))
            : 0;
        return {
            source: ss.source,
            signalCount: ss.signals.length,
            topAvgScore,
            primarySourceShare,
            rawSignals: ss.signals.slice(0, 50).map(sig => ({
                activityCode: sig.activityCode,
                score: sig.score,
                confidence: sig.confidence,
                provenance: sig.provenance,
            })),
        };
    });
}

function buildCandidateProvenance(candidateResult: SynthesizedCandidateSet) {
    return candidateResult.candidates.map(c => ({
        code: c.activity.code,
        score: c.score,
        sources: c.sources,
        contributions: c.contributions,
        primarySource: c.primarySource,
        provenance: c.provenance,
        confidence: c.confidence,
    }));
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function runEstimationOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
    const pipelineStart = Date.now();
    const { killSwitches: ks, sanitizedDescription, requestId } = input;
    const metrics = createEmptyMetrics(ks.estimationModel);
    const pipelineLog = createPipelineLogger(requestId);

    // ── Stage 1: fetch-activities ─────────────────────────────────────────────

    const fetchResult = await fetchActivitiesServerSide(
        input.techCategory,
        input.techPresetId,
        input.activities,
    );
    metrics.activitiesFetchMs = fetchResult.fetchMs;
    metrics.activitiesCatalogSize = fetchResult.activities.length;

    if (fetchResult.activities.length === 0) {
        throw new Error('Nessuna attività disponibile per questa tecnologia.');
    }

    const projectActivityResult = await fetchProjectActivities(input.projectId);
    const projectActivities: ProjectActivity[] = projectActivityResult.activities;

    // ── Stage 2: evaluate-rules ───────────────────────────────────────────────

    const estimationCtx: EstimationContext = {
        technologyId: input.techPresetId ?? null,
        techCategory: input.techCategory ?? null,
        project: input.projectContext ? {
            name: input.projectContext.name,
            description: input.projectContext.description,
            owner: input.projectContext.owner,
            projectType: input.projectContext.projectType as any,
            domain: input.projectContext.domain,
            scope: input.projectContext.scope as any,
            teamSize: input.projectContext.teamSize,
            deadlinePressure: input.projectContext.deadlinePressure as any,
            methodology: input.projectContext.methodology as any,
        } : null,
    };

    const contextRules = evaluateProjectContextRules(estimationCtx);
    const blueprintRules = evaluateProjectTechnicalBlueprintRules(
        input.projectTechnicalBlueprint as unknown as ProjectTechnicalBlueprint | undefined,
    );
    const mergedRules = mergeProjectAndBlueprintRules(contextRules, blueprintRules);

    if (mergedRules.notes.length > 0) {
        console.log('[orchestrator] Merged context+blueprint rules:', mergedRules.notes);
    }

    // ── Stage 3: deterministic-pipeline ──────────────────────────────────────
    // Signal extraction → candidate synthesis → provenance map. No LLM calls.

    const pipeline = runEstimationPipeline({
        description: sanitizedDescription,
        answers: input.answers,
        techCategory: input.techCategory,
        activities: fetchResult.activities,
        projectActivities,
        estimationBlueprint: input.estimationBlueprint,
        impactMap: input.impactMap,
        requirementUnderstanding: input.requirementUnderstanding,
        activityBiases: mergedRules.activityBiases,
        killSwitches: ks,
    });

    const {
        candidateResult,
        blueprintMappingResult,
        provenanceMap,
        isStale,
        staleReasons,
        aggregateConfidence,
        candidateLimit,
        pipelineConfig,
    } = pipeline;

    const rankedActivities = candidateResult.candidates.map(c => c.activity);

    if (isStale) {
        console.warn(`[orchestrator] Stale artifacts: ${staleReasons.join(', ')}`);
    }
    console.log(`[orchestrator] Candidates: confidence=${aggregateConfidence}, limit=${candidateLimit}, strategy=${candidateResult.strategy}`);

    pipelineLog.log('signal-extraction', { blueprint: !!blueprintMappingResult, signalSetCount: pipeline.signalSets.length });
    pipelineLog.log('candidate-sizing', { confidence: aggregateConfidence, candidateLimit, isStale, staleReasons, skipInterview: pipelineConfig.skipInterview, skipReflection: pipelineConfig.skipReflection });
    pipelineLog.log('candidate-synthesis', { candidateCount: candidateResult.candidates.length, strategy: candidateResult.strategy });

    metrics.candidateSource = candidateResult.strategy as any;
    metrics.activitiesAfterRanking = rankedActivities.length;

    if (blueprintMappingResult) {
        metrics.blueprintCoverage = {
            componentCoveragePercent: blueprintMappingResult.coverage.componentCoveragePercent,
            fromBlueprint: blueprintMappingResult.coverage.fromBlueprint,
            fromFallback: blueprintMappingResult.coverage.fromFallback,
            missingGroups: blueprintMappingResult.coverage.missingGroups,
        };
        if (blueprintMappingResult.warnings.length > 0) {
            metrics.blueprintWarnings = blueprintMappingResult.warnings;
        }
    }

    // ── Stage 4a: agentic-path ────────────────────────────────────────────────

    const agentInput: AgentInput = {
        description: sanitizedDescription,
        answers: input.answers,
        activities: rankedActivities.map(a => ({
            code: a.code,
            name: a.name,
            description: a.description ? a.description.substring(0, 80) : '',
            base_hours: a.base_hours,
            group: a.group,
            tech_category: a.tech_category,
        })),
        validActivityCodes: rankedActivities.map(a => a.code),
        techCategory: input.techCategory,
        projectContext: input.projectContext ? {
            name: input.projectContext.name,
            description: input.projectContext.description,
            owner: input.projectContext.owner,
        } : undefined,
        technologyName: input.techCategory,
        userId: input.userId,
        projectTechnicalBlueprintBlock: formatProjectTechnicalBlueprintBlock(input.projectTechnicalBlueprint),
        projectScopedActivitiesBlock: formatProjectActivitiesBlock(projectActivities.length > 0 ? projectActivities : undefined),
        projectId: input.projectId,
        flags: {
            reflectionEnabled: ks.reflectionEnabled && !pipelineConfig.skipReflection,
            toolUseEnabled: ks.toolUseEnabled,
            maxReflectionIterations: ks.maxReflectionIterations,
            reflectionConfidenceThreshold: ks.reflectionConfidenceThreshold,
            autoApproveOnly: false,
        },
    };

    metrics.pipelineMode = 'agentic';

    try {
        if (!ks.agenticEnabled) {
            throw Object.assign(new Error('agenticEnabled=false'), { _forcedFallback: true });
        }

        const agentResult = await runAgentPipeline(agentInput);

        if (!agentResult.success) {
            throw new Error(agentResult.error || 'Agentic pipeline failed');
        }

        metrics.totalDurationMs = Date.now() - pipelineStart;
        metrics.draftDurationMs = agentResult.agentMetadata.totalDurationMs;
        metrics.toolIterations = agentResult.agentMetadata.toolCallCount;
        metrics.reflectionDurationMs = agentResult.agentMetadata.reflectionResult
            ? agentResult.agentMetadata.totalDurationMs * 0.2
            : 0;

        const enrichedActivities = attachProvenance(
            agentResult.activities,
            provenanceMap,
            agentResult.expandedActivityCodes,
        );

        console.log('[orchestrator] Provenance:', provenanceBreakdown(enrichedActivities));

        // AI is primary source for drivers/risks; rule-based is fallback only
        const finalDrivers = agentResult.suggestedDrivers.length > 0
            ? agentResult.suggestedDrivers.map(d => ({ ...d, source: 'ai' as const }))
            : mergeDriverSuggestions([], mergedRules.suggestedDrivers);

        const finalRisks = agentResult.suggestedRisks.length > 0
            ? agentResult.suggestedRisks.map(code => ({ code, reason: 'AI-suggested risk.', source: 'ai' as const }))
            : mergeRiskSuggestions([], mergedRules.suggestedRisks);

        pipelineLog.log('driver-risk-merge', {
            aiDriverCount: agentResult.suggestedDrivers.length,
            aiRiskCount: agentResult.suggestedRisks.length,
            usedFallback: agentResult.suggestedDrivers.length === 0 || agentResult.suggestedRisks.length === 0,
        });

        // Deterministic baseline — always run for delta observability and decisionTrace
        const baselineResult = runDecisionEngine({
            candidates: candidateResult.candidates,
            answers: input.answers,
            techCategory: input.techCategory,
            catalog: fetchResult.activities,
            description: sanitizedDescription,
            activityBiases: mergedRules.activityBiases,
        });

        const agentDelta = ks.agentDeltaEnabled
            ? computeAgentDelta(
                baselineResult.selectedCandidates.map(c => c.activity.code),
                enrichedActivities.map((a: any) => a.code),
            )
            : undefined;

        const pipelineTrace: PipelineTrace = {
            requestId,
            timestamp: new Date().toISOString(),
            durationMs: metrics.totalDurationMs,
            aggregateConfidence,
            candidateLimit,
            isStale,
            staleReasons,
            signalSources: buildSignalSourceStats(pipeline, candidateResult),
            candidateCount: candidateResult.candidates.length,
            candidateSynthesisStrategy: candidateResult.strategy,
            pipelineMode: 'agentic',
            agentDelta,
            killSwitches: ks,
        };

        pipelineLog.log('agent-pipeline', {
            success: true,
            activitiesCount: enrichedActivities.length,
            durationMs: metrics.totalDurationMs,
        });
        pipelineLog.flush();

        return {
            success: true,
            generatedTitle: agentResult.generatedTitle,
            activities: enrichedActivities,
            totalBaseDays: agentResult.totalBaseDays,
            reasoning: agentResult.reasoning,
            confidenceScore: agentResult.confidenceScore,
            suggestedDrivers: finalDrivers,
            suggestedRisks: finalRisks.map(r => r.code),
            candidateProvenance: buildCandidateProvenance(candidateResult),
            decisionTrace: baselineResult.decisionTrace,
            coverageReport: baselineResult.coverageReport,
            projectContextNotes: contextRules.notes.length > 0 ? contextRules.notes : undefined,
            agentMetadata: {
                executionId: agentResult.agentMetadata.executionId,
                totalDurationMs: agentResult.agentMetadata.totalDurationMs,
                iterations: agentResult.agentMetadata.iterations,
                toolCallCount: agentResult.agentMetadata.toolCallCount,
                model: agentResult.agentMetadata.model,
                reflectionAssessment: agentResult.agentMetadata.reflectionResult?.assessment,
                reflectionConfidence: agentResult.agentMetadata.reflectionResult?.confidence,
                engineValidation: agentResult.engineValidation,
            },
            metrics,
            pipelineTrace,
            staleReasons: staleReasons.length > 0 ? staleReasons : undefined,
        };

    } catch (agentError: any) {
        // Circuit breaker open → propagate immediately (503 with Retry-After)
        if (agentError instanceof CircuitOpenError) {
            console.warn('[orchestrator] Circuit breaker open, propagating 503');
            throw agentError;
        }

        // ── Stage 4b: deterministic-fallback ─────────────────────────────────
        // Transient LLM failure → DecisionEngine only, no second LLM call.

        metrics.fallbackUsed = true;
        metrics.pipelineMode = 'deterministic-fallback';
        console.warn('[orchestrator] Agentic pipeline failed, falling back to DecisionEngine:', agentError?.message);

        const fallbackStart = Date.now();
        const decisionResult = runDecisionEngine({
            candidates: candidateResult.candidates,
            answers: input.answers,
            techCategory: input.techCategory,
            catalog: fetchResult.activities,
            description: sanitizedDescription,
            activityBiases: mergedRules.activityBiases,
        });

        const fallbackActivities = decisionResult.selectedCandidates.map(c => ({
            code: c.activity.code,
            name: c.activity.name,
            baseHours: c.activity.base_hours,
            reason: `Score ${c.score.toFixed(2)} (${c.primarySource})`,
            fromAnswer: '',
            fromQuestionId: '',
        }));

        const fallbackEnriched = attachProvenance(fallbackActivities, provenanceMap);
        const fallbackDrivers = mergeDriverSuggestions([], mergedRules.suggestedDrivers);
        const fallbackRisks = mergeRiskSuggestions([], mergedRules.suggestedRisks);

        metrics.draftDurationMs = Date.now() - fallbackStart;
        metrics.totalDurationMs = Date.now() - pipelineStart;

        const pipelineTrace: PipelineTrace = {
            requestId,
            timestamp: new Date().toISOString(),
            durationMs: metrics.totalDurationMs,
            aggregateConfidence,
            candidateLimit,
            isStale,
            staleReasons,
            signalSources: buildSignalSourceStats(pipeline, candidateResult),
            candidateCount: candidateResult.candidates.length,
            candidateSynthesisStrategy: candidateResult.strategy,
            pipelineMode: 'deterministic-fallback',
            killSwitches: ks,
        };

        pipelineLog.log('deterministic-fallback', {
            selectedCount: decisionResult.selectedCandidates.length,
            confidence: decisionResult.confidence,
            durationMs: metrics.draftDurationMs,
        });
        pipelineLog.flush();

        return {
            success: true,
            generatedTitle: '',
            activities: fallbackEnriched,
            totalBaseDays: Number(
                fallbackActivities.reduce((sum, a) => sum + a.baseHours / 8, 0).toFixed(2),
            ),
            reasoning: 'Selezione attività basata su analisi strutturale del requisito e delle risposte.',
            confidenceScore: Number(decisionResult.confidence.toFixed(2)),
            suggestedDrivers: fallbackDrivers,
            suggestedRisks: fallbackRisks.map(r => r.code),
            candidateProvenance: buildCandidateProvenance(candidateResult),
            decisionTrace: decisionResult.decisionTrace,
            coverageReport: decisionResult.coverageReport,
            projectContextNotes: mergedRules.notes.length > 0 ? mergedRules.notes : undefined,
            metrics,
            pipelineTrace,
            staleReasons: staleReasons.length > 0 ? staleReasons : undefined,
        };
    }
}
