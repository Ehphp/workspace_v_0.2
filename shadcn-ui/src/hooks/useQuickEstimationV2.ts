/**
 * useQuickEstimationV2 — Client-side AI pipeline orchestrator for Quick Estimate
 *
 * Runs the same artifact chain as the Wizard (Understanding → Impact Map →
 * Blueprint → Interview Planner → Estimation) but with auto-confirmed artifacts
 * and no intermediate UI steps.
 *
 * Design constraints:
 * - Each step is a separate Netlify function call (respects per-function timeout)
 * - Artifacts cascade: each step feeds its output to the next
 * - All soft-optional: if any artifact step fails, the pipeline continues
 *   with degraded context (never blocks)
 * - Uses interviewFinalizeEstimation for the deterministic calculation
 *   (same as Wizard, with AI-suggested drivers & risks)
 * - traceId links all steps for observability
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchEstimationMasterData, type EstimationMasterData } from '@/lib/api';
import { interviewFinalizeEstimation, type FinalizedEstimation } from '@/lib/estimation-utils';
import { generateRequirementUnderstanding } from '@/lib/requirement-understanding-api';
import { generateImpactMap } from '@/lib/impact-map-api';
import { generateEstimationBlueprint } from '@/lib/estimation-blueprint-api';
import { generateInterviewQuestions, generateEstimateFromInterview } from '@/lib/requirement-interview-api';
import { validateRequirementDescription } from '@/lib/requirement-validation-api';
import type { Technology } from '@/types/database';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';
import type { ImpactMap } from '@/types/impact-map';
import type { EstimationBlueprint } from '@/types/estimation-blueprint';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';
import type {
    SelectedActivityWithReason,
    SuggestedDriver,
    PreEstimate,
} from '@/types/requirement-interview';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline types
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStep =
    | 'idle'
    | 'loading-data'
    | 'validation'
    | 'understanding'
    | 'impact-map'
    | 'blueprint'
    | 'interview-planner'
    | 'estimation'
    | 'finalizing'
    | 'done'
    | 'error';

export interface PipelineArtifacts {
    understanding?: RequirementUnderstanding;
    impactMap?: ImpactMap;
    blueprint?: EstimationBlueprint;
    interviewDecision?: 'ASK' | 'SKIP';
    preEstimate?: PreEstimate;
}

export interface PipelineStepResult {
    step: PipelineStep;
    success: boolean;
    durationMs: number;
    skipped?: boolean;
    error?: string;
}

export interface PipelineTrace {
    traceId: string;
    startedAt: string;
    steps: PipelineStepResult[];
    totalDurationMs: number;
}

export interface QuickEstimationV2Result {
    /** Finalized estimation (deterministic engine output) */
    estimation: FinalizedEstimation;
    /** AI-selected activities with per-activity reasoning */
    activities: SelectedActivityWithReason[];
    /** AI reasoning for overall estimation */
    reasoning: string;
    /** Confidence score (0-1) */
    confidenceScore: number;
    /** AI-generated title */
    generatedTitle?: string;
    /** Suggested drivers from AI */
    suggestedDrivers?: SuggestedDriver[];
    /** Suggested risk codes from AI */
    suggestedRisks?: string[];
    /** Auto-confirmed artifacts for inspection */
    artifacts: PipelineArtifacts;
    /** Full execution trace */
    trace: PipelineTrace;
    /** Pipeline metrics from backend */
    metrics?: Record<string, unknown>;
    /** Whether escalation to full wizard is recommended */
    shouldEscalate: boolean;
    /** Reason for escalation recommendation */
    escalationReason?: string;
    /** Decision trace from deterministic DecisionEngine */
    decisionTrace?: Array<{ step: string; action: string; code: string; reason: string; score?: number; layer?: string }>;
    /** Coverage report from DecisionEngine */
    coverageReport?: { byLayer: Record<string, { covered: boolean; activityCount: number; topScore: number; topCode: string }>; totalSelected: number; totalCandidates: number; gapLayers: string[] };
}

/** A completed-step insight shown live during the pipeline */
export interface PipelineInsight {
    step: PipelineStep;
    icon: 'understanding' | 'impact' | 'blueprint' | 'planner';
    label: string;
    detail: string;
    success: boolean;
}

// Step labels for UI progress display
export const STEP_LABELS: Record<PipelineStep, string> = {
    'idle': '',
    'loading-data': 'Caricamento dati...',
    'validation': 'Validazione requisito...',
    'understanding': 'Analisi requisito...',
    'impact-map': 'Mappa impatto architetturale...',
    'blueprint': 'Decomposizione tecnica...',
    'interview-planner': 'Valutazione complessità...',
    'estimation': 'Generazione stima...',
    'finalizing': 'Calcolo finale...',
    'done': 'Completato',
    'error': 'Errore',
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useQuickEstimationV2() {
    // ── State ────────────────────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
    const [result, setResult] = useState<QuickEstimationV2Result | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [liveInsights, setLiveInsights] = useState<PipelineInsight[]>([]);

    // Master data (technologies, activities, drivers, risks)
    const [masterData, setMasterData] = useState<EstimationMasterData | null>(null);

    // Abort support
    const abortRef = useRef(false);

    // ── Helpers ──────────────────────────────────────────────────────────

    const generateTraceId = (): string =>
        `qe2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const timed = async <T,>(
        stepName: PipelineStep,
        fn: () => Promise<T>,
        steps: PipelineStepResult[],
    ): Promise<{ result: T | null; ok: boolean }> => {
        if (abortRef.current) return { result: null, ok: false };
        setCurrentStep(stepName);
        const t0 = performance.now();
        try {
            const r = await fn();
            steps.push({ step: stepName, success: true, durationMs: performance.now() - t0 });
            return { result: r, ok: true };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[QuickEstimateV2] Step ${stepName} failed:`, msg);
            steps.push({ step: stepName, success: false, durationMs: performance.now() - t0, error: msg });
            return { result: null, ok: false };
        }
    };

    // ── Load master data ────────────────────────────────────────────────
    const loadMasterData = useCallback(async (): Promise<EstimationMasterData> => {
        if (masterData) return masterData;
        const data = await fetchEstimationMasterData();
        setMasterData(data);
        return data;
    }, [masterData]);

    // ── Main pipeline ───────────────────────────────────────────────────
    const calculate = useCallback(async (
        description: string,
        technologyId: string,
        projectContext?: { name: string; description: string; owner?: string; projectType?: string; domain?: string; scope?: string; teamSize?: number; deadlinePressure?: string; methodology?: string },
        projectTechnicalBlueprint?: ProjectTechnicalBlueprint,
    ): Promise<boolean> => {
        // Validation
        if (!description.trim() || description.trim().length < 10) {
            setError('Fornisci una descrizione più dettagliata (almeno 10 caratteri).');
            return false;
        }
        if (!technologyId) {
            setError('Seleziona una tecnologia.');
            return false;
        }

        // Init
        abortRef.current = false;
        setError(null);
        setResult(null);
        setLiveInsights([]);

        const traceId = generateTraceId();
        const steps: PipelineStepResult[] = [];
        const pipelineStart = performance.now();

        console.log(`[QuickEstimateV2] Pipeline start — traceId=${traceId}`);

        try {
            // ─── Step 0: Load master data ──────────────────────────────
            const { result: data, ok: dataOk } = await timed(
                'loading-data',
                () => loadMasterData(),
                steps,
            );
            if (!dataOk || !data) {
                setError('Impossibile caricare i dati di configurazione.');
                setCurrentStep('error');
                return false;
            }

            const preset = data.technologies.find(t => t.id === technologyId);
            if (!preset) {
                setError('Tecnologia selezionata non trovata.');
                setCurrentStep('error');
                return false;
            }

            const techCategory = preset.tech_category;
            const artifacts: PipelineArtifacts = {};

            // ─── Step 0.5: Requirement Validation Gate ─────────────────
            const { result: validationResult } = await timed(
                'validation',
                () => validateRequirementDescription(description),
                steps,
            );
            if (validationResult && !validationResult.isValid && validationResult.confidence >= 0.7) {
                setError(`Requisito non valido: ${validationResult.reason}`);
                setCurrentStep('error');
                return false;
            }

            if (abortRef.current) return false;

            // ─── Step 1: Requirement Understanding (soft) ──────────────
            const { result: understandingRes } = await timed(
                'understanding',
                () => generateRequirementUnderstanding({
                    description,
                    techCategory,
                    techPresetId: technologyId,
                    projectContext,
                }),
                steps,
            );
            if (understandingRes?.success && understandingRes.understanding) {
                artifacts.understanding = understandingRes.understanding;
                setLiveInsights(prev => [...prev, {
                    step: 'understanding',
                    icon: 'understanding',
                    label: 'Obiettivo identificato',
                    detail: understandingRes.understanding!.businessObjective.length > 90
                        ? understandingRes.understanding!.businessObjective.slice(0, 90) + '…'
                        : understandingRes.understanding!.businessObjective,
                    success: true,
                }]);
            } else {
                setLiveInsights(prev => [...prev, {
                    step: 'understanding',
                    icon: 'understanding',
                    label: 'Analisi requisito',
                    detail: 'Continuo senza analisi dettagliata',
                    success: false,
                }]);
            }

            if (abortRef.current) return false;

            // ─── Step 2: Impact Map (soft, feeds understanding) ────────
            const { result: impactMapRes } = await timed(
                'impact-map',
                () => generateImpactMap({
                    description,
                    techCategory,
                    techPresetId: technologyId,
                    projectContext,
                    requirementUnderstanding: artifacts.understanding,
                }),
                steps,
            );
            if (impactMapRes?.success && impactMapRes.impactMap) {
                artifacts.impactMap = impactMapRes.impactMap;
                const layers = impactMapRes.impactMap.impacts.map(i => i.layer);
                const uniqueLayers = [...new Set(layers)];
                setLiveInsights(prev => [...prev, {
                    step: 'impact-map',
                    icon: 'impact',
                    label: `${uniqueLayers.length} layer architetturali impattati`,
                    detail: uniqueLayers.join(', '),
                    success: true,
                }]);
            } else {
                setLiveInsights(prev => [...prev, {
                    step: 'impact-map',
                    icon: 'impact',
                    label: 'Mappa impatto',
                    detail: 'Continuo senza mappa impatto',
                    success: false,
                }]);
            }

            if (abortRef.current) return false;

            // ─── Step 3: Estimation Blueprint (soft, feeds both) ───────
            const { result: blueprintRes } = await timed(
                'blueprint',
                () => generateEstimationBlueprint({
                    description,
                    techCategory,
                    techPresetId: technologyId,
                    projectContext,
                    requirementUnderstanding: artifacts.understanding,
                    impactMap: artifacts.impactMap,
                }),
                steps,
            );
            if (blueprintRes?.success && blueprintRes.blueprint) {
                artifacts.blueprint = blueprintRes.blueprint;
                const componentCount = blueprintRes.blueprint.components?.length ?? 0;
                const conf = Math.round((blueprintRes.blueprint.overallConfidence ?? 0) * 100);
                setLiveInsights(prev => [...prev, {
                    step: 'blueprint',
                    icon: 'blueprint',
                    label: `${componentCount} componenti, confidenza ${conf}%`,
                    detail: blueprintRes.blueprint!.reasoning
                        ? (blueprintRes.blueprint!.reasoning.length > 90
                            ? blueprintRes.blueprint!.reasoning.slice(0, 90) + '…'
                            : blueprintRes.blueprint!.reasoning)
                        : `${componentCount} componenti tecnici identificati`,
                    success: true,
                }]);
            } else {
                setLiveInsights(prev => [...prev, {
                    step: 'blueprint',
                    icon: 'blueprint',
                    label: 'Decomposizione tecnica',
                    detail: 'Continuo senza blueprint',
                    success: false,
                }]);
            }

            if (abortRef.current) return false;

            // ─── Step 4: Interview Planner (ASK/SKIP decision) ─────────
            const { result: interviewRes } = await timed(
                'interview-planner',
                () => generateInterviewQuestions({
                    description,
                    techPresetId: technologyId,
                    techCategory,
                    projectContext,
                    requirementUnderstanding: artifacts.understanding,
                    impactMap: artifacts.impactMap,
                    estimationBlueprint: artifacts.blueprint,
                    projectTechnicalBlueprint: projectTechnicalBlueprint
                        ? (projectTechnicalBlueprint as unknown as Record<string, unknown>)
                        : undefined,
                }),
                steps,
            );

            let preEstimate: PreEstimate | undefined;
            let plannerDecision: 'ASK' | 'SKIP' = 'SKIP';

            if (interviewRes?.success) {
                preEstimate = (interviewRes as any).preEstimate;
                plannerDecision = (interviewRes as any).decision || 'SKIP';
                artifacts.interviewDecision = plannerDecision;
                artifacts.preEstimate = preEstimate;
                const rangeLabel = preEstimate
                    ? `${preEstimate.minHours}–${preEstimate.maxHours}h (conf. ${Math.round((preEstimate.confidence ?? 0) * 100)}%)`
                    : '';
                setLiveInsights(prev => [...prev, {
                    step: 'interview-planner',
                    icon: 'planner',
                    label: plannerDecision === 'SKIP'
                        ? 'Requisito chiaro — stima diretta'
                        : 'Servirebbero domande — stimo comunque',
                    detail: rangeLabel || (plannerDecision === 'SKIP' ? 'Nessuna domanda necessaria' : 'Proseguo in modalità rapida'),
                    success: true,
                }]);
            }

            if (abortRef.current) return false;

            // ─── Step 5: Estimation (full pipeline call) ───────────────
            // Quick mode: always proceed with empty answers (SKIP path).
            // Even if planner says ASK, we run the estimation with
            // the context we have and flag shouldEscalate.
            const { result: estimationRes, ok: estimationOk } = await timed(
                'estimation',
                () => generateEstimateFromInterview({
                    description,
                    techPresetId: technologyId,
                    techCategory,
                    answers: {},  // No interview answers in quick mode
                    projectContext,
                    preEstimate,
                    requirementUnderstanding: artifacts.understanding,
                    impactMap: artifacts.impactMap,
                    estimationBlueprint: artifacts.blueprint,
                    projectTechnicalBlueprint: projectTechnicalBlueprint
                        ? (projectTechnicalBlueprint as unknown as Record<string, unknown>)
                        : undefined,
                }),
                steps,
            );

            if (!estimationOk || !estimationRes?.success || !estimationRes.activities?.length) {
                setError(
                    estimationRes?.error ||
                    'La stima non ha prodotto risultati. Prova con una descrizione più dettagliata.',
                );
                setCurrentStep('error');
                return false;
            }

            if (abortRef.current) return false;

            // ─── Step 6: Deterministic finalization ────────────────────
            setCurrentStep('finalizing');
            const activityCodes = estimationRes.activities.map(a => a.code);

            const estimation = interviewFinalizeEstimation(
                activityCodes,
                data.activities,
                data.drivers,
                data.risks,
                estimationRes.suggestedDrivers?.map(d => ({
                    code: d.code,
                    suggestedValue: d.suggestedValue,
                })),
                estimationRes.suggestedRisks,
                preset,
            );

            // ─── Escalation policy ─────────────────────────────────────
            const confidence = estimationRes.confidenceScore ?? 0;
            let shouldEscalate = false;
            let escalationReason: string | undefined;

            if (confidence < 0.60) {
                shouldEscalate = true;
                escalationReason = 'Confidenza bassa — si consiglia il wizard completo per risultati più affidabili.';
            } else if (plannerDecision === 'ASK' && confidence < 0.80) {
                shouldEscalate = true;
                escalationReason = 'L\'AI suggerisce domande aggiuntive — una stima via wizard sarebbe più accurata.';
            }

            // ─── Build trace ───────────────────────────────────────────
            const trace: PipelineTrace = {
                traceId,
                startedAt: new Date(pipelineStart).toISOString(),
                steps,
                totalDurationMs: performance.now() - pipelineStart,
            };

            console.log(`[QuickEstimateV2] Pipeline done — traceId=${traceId}`, {
                totalMs: Math.round(trace.totalDurationMs),
                confidence,
                activities: activityCodes.length,
                shouldEscalate,
                stepsOk: steps.filter(s => s.success).length,
                stepsFailed: steps.filter(s => !s.success).length,
            });

            // ─── Set result ────────────────────────────────────────────
            setResult({
                estimation,
                activities: estimationRes.activities,
                reasoning: estimationRes.reasoning,
                confidenceScore: confidence,
                generatedTitle: estimationRes.generatedTitle,
                suggestedDrivers: estimationRes.suggestedDrivers,
                suggestedRisks: estimationRes.suggestedRisks,
                artifacts,
                trace,
                metrics: estimationRes.metrics as Record<string, unknown> | undefined,
                shouldEscalate,
                escalationReason,
                decisionTrace: estimationRes.decisionTrace,
                coverageReport: estimationRes.coverageReport,
            });
            setCurrentStep('done');
            return true;

        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Errore imprevisto durante la stima.';
            console.error(`[QuickEstimateV2] Pipeline error — traceId=${traceId}:`, e);
            setError(msg);
            setCurrentStep('error');
            return false;
        }
    }, [loadMasterData]);

    // ── Reset ────────────────────────────────────────────────────────────
    const reset = useCallback(() => {
        abortRef.current = true;
        setCurrentStep('idle');
        setResult(null);
        setError(null);
        setLiveInsights([]);
    }, []);

    // ── Abort (cancel in-flight pipeline) ────────────────────────────────
    const abort = useCallback(() => {
        abortRef.current = true;
        setCurrentStep('idle');
    }, []);

    return {
        // State
        currentStep,
        stepLabel: STEP_LABELS[currentStep],
        isRunning: currentStep !== 'idle' && currentStep !== 'done' && currentStep !== 'error',
        result,
        error,
        liveInsights,

        // Master data (for preset selector)
        technologies: masterData?.technologies ?? [],
        loadMasterData,

        // Actions
        calculate,
        reset,
        abort,
    };
}
