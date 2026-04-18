/**
 * Type Definitions for Requirement Technical Interview System
 * 
 * Defines types for technical question generation, user answers, and interview state.
 * Questions are designed for technical-to-technical dialogue.
 */

import { z } from 'zod';
import type { RequirementUnderstanding } from './requirement-understanding';
import type { ImpactMap } from './impact-map';
import type { EstimationBlueprint } from './estimation-blueprint';

/**
 * Categories of technical questions that impact estimation
 */
export type TechnicalQuestionCategory =
    | 'INTEGRATION'      // API, external systems, protocols
    | 'DATA'             // Volumes, structures, migrations
    | 'SECURITY'         // Authentication, authorization, compliance
    | 'PERFORMANCE'      // Scalability, caching, optimization
    | 'UI_UX'            // Interface complexity, responsive, accessibility
    | 'ARCHITECTURE'     // Patterns, microservices, monolith
    | 'TESTING'          // Coverage requirements, E2E, load testing
    | 'DEPLOYMENT';      // CI/CD, environments, rollback

/**
 * Question types supported by the interview system
 */
export type InterviewQuestionType = 'single-choice' | 'multiple-choice' | 'range' | 'text';

/**
 * Option for choice-based questions
 */
export interface TechnicalQuestionOption {
    id: string;
    label: string;
    description?: string;
    /** Estimated impact multiplier (e.g., 1.0 = baseline, 1.5 = +50% effort) */
    impactMultiplier?: number;
}

/**
 * Pre-estimate from the information-gain planner (Round 0)
 */
export interface PreEstimate {
    /** Optimistic estimate (best-case reasonable) */
    minHours: number;
    /** Pessimistic estimate (worst-case reasonable) */
    maxHours: number;
    /** Confidence that the range covers reality (0–1) */
    confidence: number;
}

/**
 * Impact metadata for an interview question (information-gain scoring)
 */
export interface QuestionImpact {
    /** Expected percentage of range reduction if this question is answered */
    expectedRangeReductionPct: number;
    /** Importance tier derived from the reduction percentage */
    importance: 'high' | 'medium' | 'low';
}

/**
 * Technical Question for Requirement Interview
 * 
 * Each question is designed to:
 * 1. Extract information that impacts the estimate
 * 2. Force the developer to clarify with functional if needed
 * 3. Provide context on WHY this matters for the estimate
 */
export interface TechnicalQuestion {
    /** Unique identifier */
    id: string;
    /** Question type determines UI rendering */
    type: InterviewQuestionType;
    /** Category for grouping and analysis */
    category: TechnicalQuestionCategory;
    /** The question text (technical language) */
    question: string;
    /** Technical context explaining WHY a developer needs to know this */
    technicalContext: string;
    /** How the answer influences the estimate */
    impactOnEstimate: string;
    /** Options for single/multiple choice questions */
    options?: TechnicalQuestionOption[];
    /** Whether answer is required to proceed */
    required: boolean;
    /** For range questions: minimum value */
    min?: number;
    /** For range questions: maximum value */
    max?: number;
    /** For range questions: step increment */
    step?: number;
    /** For range questions: unit label (e.g., "users", "requests/sec") */
    unit?: string;
    /** For text questions: placeholder text */
    placeholder?: string;
    /** For text questions: maximum character length */
    maxLength?: number;
    /** Information-gain impact metadata (only present with planner v2) */
    impact?: QuestionImpact;
}

/**
 * Request to generate interview questions
 */
export interface RequirementInterviewRequest {
    /** The requirement description to analyze */
    description: string;
    /** Selected technology preset ID */
    techPresetId: string;
    /** Technology category (BACKEND_API, FRONTEND_WEB, etc.) */
    techCategory: string;
    /** Optional project ID — used to include project-scoped activities */
    projectId?: string;
    /** Optional project context to avoid redundant questions */
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
    /** Optional structured understanding from Phase 1 — enriches AI context */
    requirementUnderstanding?: RequirementUnderstanding;
    /** Optional impact map from Phase 2 — enriches AI context with architectural layer info */
    impactMap?: ImpactMap;
    /** Optional estimation blueprint — structured technical work model */
    estimationBlueprint?: EstimationBlueprint;
    /** Optional project technical blueprint — architectural baseline from project creation */
    projectTechnicalBlueprint?: Record<string, unknown>;
}
export interface RequirementInterviewResponse {
    /** Whether generation was successful */
    success: boolean;
    /** Planner decision: ASK = show questions, SKIP = go directly to estimation */
    decision?: 'ASK' | 'SKIP';
    /** Pre-estimate range from Round 0 planner (information-gain) */
    preEstimate?: PreEstimate;
    /** Generated technical questions (0-3 with planner v2, 4-6 legacy) */
    questions: TechnicalQuestion[];
    /** AI reasoning for why these questions were chosen */
    reasoning: string;
    /** Initial complexity estimate based on description alone */
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
    /** Activities already identifiable from the description */
    suggestedActivities: string[];
    /** Error message if success is false */
    error?: string;
    /** Planner metrics (only present with planner v2) */
    metrics?: {
        totalMs: number;
        llmMs: number;
        activitiesFetchMs: number;
        activitiesCatalogSize: number;
        activitiesRanked: number;
        activitiesSource: string;
        questionCountRaw: number;
        questionCountFiltered: number;
        decisionOverridden: boolean;
    };
}

/**
 * User's answer to an interview question
 */
export interface InterviewAnswer {
    /** ID of the question being answered */
    questionId: string;
    /** Category of the question (denormalized for easier analysis) */
    category: TechnicalQuestionCategory;
    /** The answer value */
    value: string | string[] | number;
    /** When the answer was provided */
    timestamp: Date;
}

/**
 * Request to generate estimate from interview answers
 */
export interface EstimationFromInterviewRequest {
    /** Original requirement description */
    description: string;
    /** Selected technology preset ID */
    techPresetId: string;
    /** Technology category */
    techCategory: string;
    /** All interview answers */
    answers: Record<string, InterviewAnswer>;
    /** Optional project ID — used to include project-scoped activities */
    projectId?: string;
    /** Optional project context to improve AI understanding */
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
    /** Optional pre-estimate from Round 0 planner — used as anchoring context */
    preEstimate?: PreEstimate;
    /** Optional structured understanding from Phase 1 — enriches AI context */
    requirementUnderstanding?: RequirementUnderstanding;
    /** Optional impact map from Phase 2 — enriches AI context with architectural layer info */
    impactMap?: ImpactMap;
    /** Optional estimation blueprint — structured technical work model */
    estimationBlueprint?: EstimationBlueprint;
    /** Optional project technical blueprint — architectural baseline from project creation */
    projectTechnicalBlueprint?: Record<string, unknown>;
}

/**
 * Activity selected by AI with reasoning
 */
export interface SelectedActivityWithReason {
    /** Activity code from catalog */
    code: string;
    /** Activity display name */
    name: string;
    /** Base hours for this activity */
    baseHours: number;
    /** Why this activity was selected */
    reason: string;
    /** Which interview answer triggered this selection (if any) */
    fromAnswer?: string;
    /** Question ID that influenced this selection */
    fromQuestionId?: string;
    /** How this activity was sourced (blueprint mapper, keyword fallback, etc.) */
    provenance?: 'blueprint-component' | 'blueprint-integration' | 'blueprint-data' | 'blueprint-testing' | 'keyword-fallback' | 'multi-crosscutting' | 'agent-discovered';
}

/**
 * Suggested driver adjustment based on interview
 */
export interface SuggestedDriver {
    /** Driver code */
    code: string;
    /** Suggested value (LOW, MEDIUM, HIGH) */
    suggestedValue: string;
    /** Why this driver value is suggested */
    reason: string;
    /** Which answer led to this suggestion */
    fromQuestionId?: string;
}

/**
 * Response from estimate generation
 */
/**
 * Provenance entry for a single candidate activity.
 * Carries full traceability from the CandidateBuilder.
 */
export interface CandidateProvenanceEntry {
    /** Activity code */
    code: string;
    /** Composite score (0–10 scale) */
    score: number;
    /** Signal sources that contributed */
    sources: string[];
    /** Per-source contribution breakdown */
    contributions: {
        blueprint: number;
        impactMap: number;
        understanding: number;
        keyword: number;
        projectContext: number;
        projectActivity: number;
    };
    /** Highest contributing source */
    primarySource: string;
    /** Human-readable provenance trail */
    provenance: string[];
    /** Confidence (0–1) */
    confidence: number;
}

export interface EstimationFromInterviewResponse {
    /** Whether generation was successful */
    success: boolean;
    /** AI-generated title for the requirement */
    generatedTitle?: string;
    /** Selected activities with reasoning */
    activities: SelectedActivityWithReason[];
    /** Total base days (sum of activities / 8) */
    totalBaseDays: number;
    /** AI reasoning for the overall selection */
    reasoning: string;
    /** Confidence score (0-1) - how confident AI is in this estimate */
    confidenceScore: number;
    /** Suggested driver adjustments based on answers */
    suggestedDrivers?: SuggestedDriver[];
    /** Suggested risks based on answers */
    suggestedRisks?: string[];
    /** Rich candidate provenance from CandidateBuilder (when available) */
    candidateProvenance?: CandidateProvenanceEntry[];
    /** Error message if success is false */
    error?: string;
    /** Decision trace from deterministic DecisionEngine (when available) */
    decisionTrace?: Array<{
        step: string;
        action: string;
        code: string;
        reason: string;
        score?: number;
        layer?: string;
    }>;
    /** Coverage report from DecisionEngine (when available) */
    coverageReport?: {
        byLayer: Record<string, { covered: boolean; activityCount: number; topScore: number; topCode: string }>;
        totalSelected: number;
        totalCandidates: number;
        gapLayers: string[];
    };
    /** Warnings from AI explanation (when available) */
    explanationWarnings?: string[];
    /** Functional gaps from AI explanation (when available) */
    explanationGaps?: string[];
    /** Performance metrics for pipeline instrumentation */
    metrics?: {
        totalMs: number;
        activitiesFetchMs?: number;
        vectorSearchMs?: number;
        ragRetrievalMs?: number;
        draftDurationMs?: number;
        reflectionDurationMs?: number;
        refineDurationMs?: number;
        pipeline: 'agentic' | 'deterministic-fallback';
        fallbackUsed?: boolean;
        activitiesRanked?: number;
        activitiesSent?: number;
        /** How the candidate set was generated. @deprecated Use SignalKind from pipeline-domain.ts */
        candidateSource?: 'blueprint-mapper' | 'keyword-ranking' | 'vector-search' | string;
        /** Coverage report from blueprint mapper (if used) */
        blueprintCoverage?: {
            componentCoveragePercent: number;
            fromBlueprint: number;
            fromFallback: number;
            missingGroups: string[];
        };
        /** Non-blocking quality warnings from blueprint mapper */
        blueprintWarnings?: Array<{ level: string; code: string; message: string }>;
    };
    /** Structured observability trace for this pipeline run */
    pipelineTrace?: {
        requestId: string;
        timestamp: string;
        durationMs: number;
        aggregateConfidence: number;
        candidateLimit: number;
        isStale: boolean;
        staleReasons: string[];
        signalSources: Array<{
            source: string;
            signalCount: number;
            topAvgScore: number;
            primarySourceShare: number;
        }>;
        candidateCount: number;
        candidateSynthesisStrategy: string;
        pipelineMode: 'agentic' | 'deterministic-fallback';
        agentDelta?: {
            deterministicSelected: string[];
            agentSelected: string[];
            added: string[];
            removed: string[];
            overlapScore: number;
        };
        killSwitches?: Record<string, unknown>;
    };
}

/**
 * Interview state for the wizard
 */
export interface RequirementInterviewState {
    /** Current phase of the interview */
    phase: 'idle' | 'loading-questions' | 'interviewing' | 'generating-estimate' | 'complete' | 'error';
    /** Generated questions */
    questions: TechnicalQuestion[];
    /** User's answers */
    answers: Map<string, InterviewAnswer>;
    /** Current question index */
    currentQuestionIndex: number;
    /** AI reasoning for question selection */
    reasoning?: string;
    /** Initial complexity estimate */
    estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
    /** Activities suggested before interview */
    suggestedActivities?: string[];
    /** Error message if any */
    error?: string;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const TechnicalQuestionOptionSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    impactMultiplier: z.number().optional(),
});

export const QuestionImpactSchema = z.object({
    expectedRangeReductionPct: z.number(),
    importance: z.enum(['high', 'medium', 'low']),
});

export const TechnicalQuestionSchema = z.object({
    id: z.string(),
    type: z.enum(['single-choice', 'multiple-choice', 'text', 'range']),
    category: z.enum([
        'INTEGRATION', 'DATA', 'SECURITY', 'PERFORMANCE',
        'UI_UX', 'ARCHITECTURE', 'TESTING', 'DEPLOYMENT'
    ]),
    question: z.string().min(10).max(500),
    technicalContext: z.string().min(10).max(500),
    impactOnEstimate: z.string().min(10).max(300),
    options: z.array(TechnicalQuestionOptionSchema).optional(),
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    unit: z.string().optional(),
    placeholder: z.string().optional(),
    maxLength: z.number().optional(),
    impact: QuestionImpactSchema.optional(),
});

export const PreEstimateSchema = z.object({
    minHours: z.number(),
    maxHours: z.number(),
    confidence: z.number().min(0).max(1),
});

export const RequirementInterviewResponseSchema = z.object({
    success: z.boolean(),
    decision: z.enum(['ASK', 'SKIP']).optional(),
    preEstimate: PreEstimateSchema.optional(),
    questions: z.array(TechnicalQuestionSchema).max(8),
    reasoning: z.string(),
    estimatedComplexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    suggestedActivities: z.array(z.string()),
    error: z.string().optional(),
});

export const InterviewAnswerSchema = z.object({
    questionId: z.string(),
    category: z.enum([
        'INTEGRATION', 'DATA', 'SECURITY', 'PERFORMANCE',
        'UI_UX', 'ARCHITECTURE', 'TESTING', 'DEPLOYMENT'
    ]),
    value: z.union([z.string(), z.array(z.string()), z.number()]),
    timestamp: z.date(),
});

export const SelectedActivityWithReasonSchema = z.object({
    code: z.string(),
    name: z.string(),
    baseHours: z.number(),
    reason: z.string(),
    fromAnswer: z.string().optional(),
    fromQuestionId: z.string().optional(),
});

export const EstimationFromInterviewResponseSchema = z.object({
    success: z.boolean(),
    activities: z.array(SelectedActivityWithReasonSchema),
    totalBaseDays: z.number(),
    reasoning: z.string(),
    confidenceScore: z.number().min(0).max(1),
    suggestedDrivers: z.array(z.object({
        code: z.string(),
        suggestedValue: z.string(),
        reason: z.string(),
        fromQuestionId: z.string().optional(),
    })).optional(),
    suggestedRisks: z.array(z.string()).optional(),
    error: z.string().optional(),
    decisionTrace: z.array(z.object({
        step: z.string(),
        action: z.string(),
        code: z.string(),
        reason: z.string(),
        score: z.number().optional(),
        layer: z.string().optional(),
    })).optional(),
    coverageReport: z.object({
        byLayer: z.record(z.object({
            covered: z.boolean(),
            activityCount: z.number(),
            topScore: z.number(),
            topCode: z.string(),
        })),
        totalSelected: z.number(),
        totalCandidates: z.number(),
        gapLayers: z.array(z.string()),
    }).optional(),
    explanationWarnings: z.array(z.string()).optional(),
    explanationGaps: z.array(z.string()).optional(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get display info for a question category
 */
export function getCategoryInfo(category: TechnicalQuestionCategory): {
    label: string;
    description: string;
    iconName: string;
    colorClass: string;
} {
    const info: Record<TechnicalQuestionCategory, ReturnType<typeof getCategoryInfo>> = {
        INTEGRATION: {
            label: 'Integrazioni',
            description: 'API, sistemi esterni, protocolli di comunicazione',
            iconName: 'Code2',
            colorClass: 'bg-blue-100 text-blue-700',
        },
        DATA: {
            label: 'Dati',
            description: 'Volumi, strutture dati, migrazioni, ETL',
            iconName: 'Database',
            colorClass: 'bg-green-100 text-green-700',
        },
        SECURITY: {
            label: 'Sicurezza',
            description: 'Autenticazione, autorizzazione, compliance',
            iconName: 'Shield',
            colorClass: 'bg-red-100 text-red-700',
        },
        PERFORMANCE: {
            label: 'Performance',
            description: 'Scalabilità, caching, ottimizzazione',
            iconName: 'Gauge',
            colorClass: 'bg-orange-100 text-orange-700',
        },
        UI_UX: {
            label: 'UI/UX',
            description: 'Complessità interfaccia, responsive, accessibility',
            iconName: 'Layout',
            colorClass: 'bg-purple-100 text-purple-700',
        },
        ARCHITECTURE: {
            label: 'Architettura',
            description: 'Pattern, microservizi, design system',
            iconName: 'GitBranch',
            colorClass: 'bg-indigo-100 text-indigo-700',
        },
        TESTING: {
            label: 'Testing',
            description: 'Coverage, E2E automation, load testing',
            iconName: 'TestTube',
            colorClass: 'bg-yellow-100 text-yellow-700',
        },
        DEPLOYMENT: {
            label: 'Deployment',
            description: 'CI/CD, ambienti, rollback strategy',
            iconName: 'Rocket',
            colorClass: 'bg-pink-100 text-pink-700',
        },
    };

    return info[category];
}

/**
 * Calculate completion percentage for interview
 */
export function calculateInterviewProgress(
    questions: TechnicalQuestion[],
    answers: Map<string, InterviewAnswer>
): number {
    if (questions.length === 0) return 0;
    return (answers.size / questions.length) * 100;
}

/**
 * Check if all required questions have been answered
 */
export function areRequiredQuestionsAnswered(
    questions: TechnicalQuestion[],
    answers: Map<string, InterviewAnswer>
): boolean {
    return questions
        .filter(q => q.required)
        .every(q => answers.has(q.id));
}

/**
 * Get unanswered required questions
 */
export function getUnansweredRequired(
    questions: TechnicalQuestion[],
    answers: Map<string, InterviewAnswer>
): TechnicalQuestion[] {
    return questions.filter(q => q.required && !answers.has(q.id));
}
