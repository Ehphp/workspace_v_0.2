/**
 * DecisionEngine Types — Input/output contracts for deterministic activity selection
 *
 * The DecisionEngine replaces LLM-based activity selection with a
 * deterministic, traceable, unit-testable algorithm.
 *
 * @module decision-engine.types
 */

import type { Activity } from '../../activities';
import type { ActivityBiases } from '../estimation/project-context-rules';
import type { ScoredCandidate } from './candidate.types';

import type { PipelineLayer } from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionEngineInput {
    /** Scored candidates from CandidateBuilder (Phase A) or CandidateSynthesizer (Phase D) */
    candidates: ScoredCandidate[];
    /** Interview answers (may be empty if interview was skipped) */
    answers: Record<string, InterviewAnswerLike>;
    /** Technology category code (e.g. 'POWER_PLATFORM', 'BACKEND') */
    techCategory: string;
    /** Full activity catalog (for variant lookup and mandatory rule resolution) */
    catalog: Activity[];
    /** Per-layer coverage from CandidateBuilder (optional — engine computes internally if absent) */
    layerCoverage?: Record<PipelineLayer, { count: number; topScore: number }>;
    /** Raw requirement description (for mandatory keyword scanning) */
    description: string;
    /** Optional project context biases */
    activityBiases?: ActivityBiases;
    /** Configuration overrides */
    config?: Partial<DecisionEngineConfig>;
}

/**
 * Minimal interview answer shape — compatible with both
 * InterviewAnswer (client) and InterviewAnswerRecord (server).
 */
export interface InterviewAnswerLike {
    questionId: string;
    category: string;
    value: string | string[] | number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionEngineConfig {
    /** Minimum score for a candidate to pass the score gate. Default: 0.5 */
    minScore: number;
    /** Maximum number of selected activities. Default: 10 */
    maxSelected: number;
    /** Layers where coverage is enforced (candidates force-included if uncovered) */
    coverageLayers: PipelineLayer[];
    /**
     * Minimum score a candidate must have to be force-promoted by coverage enforcement.
     * If the best candidate for an uncovered layer scores below this threshold it is
     * considered noise and the layer gap is left open rather than filled with a
     * low-signal activity. Default: 0.25
     */
    minCoverageScore: number;
    /** Keyword-based mandatory inclusion rules */
    mandatoryKeywordRules: MandatoryKeywordRule[];
}

export const DEFAULT_CONFIG: DecisionEngineConfig = {
    minScore: 0.5,
    maxSelected: 10,
    coverageLayers: ['frontend', 'logic', 'data'],
    minCoverageScore: 0.25,
    mandatoryKeywordRules: [], // populated from mandatory-rules.ts
};

// ─────────────────────────────────────────────────────────────────────────────
// Mandatory Keyword Rules
// ─────────────────────────────────────────────────────────────────────────────

export interface MandatoryKeywordRule {
    /** Keywords to scan for in description and answers */
    keywords: string[];
    /** Activity code prefix to force-include (e.g. "PP_FLOW") */
    activityPrefix: string;
    /** Where to scan: 'description' | 'answers' | 'both' */
    source: 'description' | 'answers' | 'both';
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionEngineResult {
    /** Candidates that passed all selection phases */
    selectedCandidates: ScoredCandidate[];
    /** Candidates that were explicitly excluded (with reasons in trace) */
    excludedCandidates: ScoredCandidate[];
    /** Per-layer coverage analysis */
    coverageReport: CoverageReport;
    /** Mandatory inclusions triggered by keyword rules */
    mandatoryInclusions: MandatoryInclusion[];
    /** Full decision trace — every include/exclude with reason */
    decisionTrace: DecisionTraceEntry[];
    /** Overall confidence in the selection (0.0–1.0) */
    confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage
// ─────────────────────────────────────────────────────────────────────────────

export interface CoverageReport {
    /** Per-layer coverage details */
    byLayer: Record<PipelineLayer, LayerCoverage>;
    /** Total selected activities */
    totalSelected: number;
    /** Total candidates considered */
    totalCandidates: number;
    /** Layers with LAYER_PRIORITY HIGH that have no selected candidates */
    gapLayers: PipelineLayer[];
}

export interface LayerCoverage {
    /** Whether at least one activity covers this layer */
    covered: boolean;
    /** Number of selected activities in this layer */
    activityCount: number;
    /** Highest score among selected activities in this layer */
    topScore: number;
    /** Code of the highest-scoring activity in this layer */
    topCode: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mandatory Inclusion
// ─────────────────────────────────────────────────────────────────────────────

export interface MandatoryInclusion {
    /** Activity code that was force-included */
    code: string;
    /** Which MandatoryKeywordRule triggered this */
    rule: string;
    /** The specific keyword that matched */
    matchedKeyword: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Trace
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionStep =
    | 'score-gate'
    | 'mandatory-keyword'
    | 'coverage-enforcement'
    | 'redundancy-elimination'
    | 'top-k-cap';

export type DecisionAction =
    | 'select'
    | 'exclude'
    | 'add-coverage'
    | 'add-mandatory';

export interface DecisionTraceEntry {
    /** Which phase of the algorithm produced this entry */
    step: DecisionStep;
    /** What action was taken */
    action: DecisionAction;
    /** Activity code affected */
    code: string;
    /** Human-readable reason */
    reason: string;
    /** Candidate score (when relevant) */
    score?: number;
    /** Layer (when relevant) */
    layer?: PipelineLayer;
}
