/**
 * Type Definitions for Bulk Interview System
 * 
 * Enables AI-powered interview for multiple requirements at once.
 * Questions are aggregated to reduce user effort while maintaining accuracy.
 */

import { z } from 'zod';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Question scope - determines how many requirements a question affects
 */
export type BulkQuestionScope =
    | 'global'           // Affects ALL requirements (e.g., "How many environments?")
    | 'multi-requirement' // Affects specific subset (e.g., "REQ-001, REQ-003 mention integrations...")
    | 'specific';        // Affects single requirement (e.g., "REQ-005 is ambiguous...")

/**
 * Question types (same as single interview for consistency)
 */
export type BulkQuestionType = 'single-choice' | 'multiple-choice' | 'range';

/**
 * Technical categories (reused from requirement-interview)
 */
export type BulkQuestionCategory =
    | 'INTEGRATION'
    | 'DATA'
    | 'SECURITY'
    | 'PERFORMANCE'
    | 'UI_UX'
    | 'ARCHITECTURE'
    | 'TESTING'
    | 'DEPLOYMENT';

/**
 * Option for choice-based questions
 */
export interface BulkQuestionOption {
    id: string;
    label: string;
    description?: string;
    impactMultiplier?: number;
}

/**
 * A question in the bulk interview
 */
export interface BulkInterviewQuestion {
    /** Unique question ID */
    id: string;
    /** How many requirements this question affects */
    scope: BulkQuestionScope;
    /** IDs of affected requirements (for multi-requirement/specific scope) */
    affectedRequirementIds: string[];
    /** Question type */
    type: BulkQuestionType;
    /** Technical category */
    category: BulkQuestionCategory;
    /** The question text */
    question: string;
    /** Technical context explaining why this matters */
    technicalContext: string;
    /** How answering impacts the estimation */
    impactOnEstimate: string;
    /** Options for choice questions */
    options?: BulkQuestionOption[];
    /** Whether this question is required */
    required: boolean;
    /** For range questions */
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
}

/**
 * Analysis of a single requirement before interview
 */
export interface RequirementAnalysis {
    /** Requirement ID */
    requirementId: string;
    /** Requirement code (e.g., REQ-001) */
    reqCode: string;
    /** Initial complexity estimate */
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    /** How ambiguous the requirement is (0-1) */
    ambiguityScore: number;
    /** Key topics identified */
    topics: string[];
    /** IDs of questions relevant to this requirement */
    relevantQuestionIds: string[];
}

/**
 * Requirement input for bulk interview
 */
export interface BulkRequirementInput {
    id: string;
    reqId: string; // e.g., "REQ-001"
    title: string;
    description: string;
    techPresetId: string | null;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate bulk interview questions
 */
export interface BulkInterviewRequest {
    /** Requirements to analyze */
    requirements: BulkRequirementInput[];
    /** Technology category for all requirements */
    techCategory: string;
    /** Technology preset ID (optional, for filtering activities) */
    techPresetId?: string;
    /** Optional project context */
    projectContext?: {
        name: string;
        description: string;
    };
}

/**
 * Response from bulk interview question generation
 */
export interface BulkInterviewResponse {
    /** Whether generation was successful */
    success: boolean;
    /** Generated questions (6-10 typical) */
    questions: BulkInterviewQuestion[];
    /** Analysis of each requirement */
    requirementAnalysis: RequirementAnalysis[];
    /** AI reasoning for question selection */
    reasoning: string;
    /** Summary statistics */
    summary: {
        totalRequirements: number;
        globalQuestions: number;
        multiReqQuestions: number;
        specificQuestions: number;
        avgAmbiguityScore: number;
    };
    /** Error message if success is false */
    error?: string;
}

/**
 * User's answer to a bulk interview question
 */
export interface BulkInterviewAnswer {
    /** ID of the question */
    questionId: string;
    /** The scope of the question */
    scope: BulkQuestionScope;
    /** IDs of requirements this answer affects */
    affectedRequirementIds: string[];
    /** Category of the question */
    category: BulkQuestionCategory;
    /** The answer value */
    value: string | string[] | number;
    /** When answered */
    timestamp: Date;
}

/**
 * Activity selected by AI with reasoning
 */
export interface BulkSelectedActivity {
    /** Activity code */
    code: string;
    /** Activity name */
    name: string;
    /** Base hours */
    baseHours: number;
    /** Why this activity was selected */
    reason: string;
    /** Answer value that triggered this (if any) */
    fromAnswer?: string;
    /** Question ID that triggered this (if any) */
    fromQuestionId?: string;
}

/**
 * Estimation result for a single requirement
 */
export interface BulkRequirementEstimation {
    /** Requirement ID */
    requirementId: string;
    /** Requirement code */
    reqCode: string;
    /** AI-generated title (if description was vague) */
    generatedTitle?: string;
    /** Selected activities */
    activities: BulkSelectedActivity[];
    /** Total base days */
    totalBaseDays: number;
    /** Confidence score (0-1) */
    confidenceScore: number;
    /** AI reasoning for this specific requirement */
    reasoning: string;
    /** Whether estimation was successful */
    success: boolean;
    /** Error if failed */
    error?: string;
}

/**
 * Request to generate estimates from bulk interview answers
 */
export interface BulkEstimateFromInterviewRequest {
    /** Original requirements */
    requirements: BulkRequirementInput[];
    /** Technology category */
    techCategory: string;
    /** All interview answers */
    answers: Record<string, BulkInterviewAnswer>;
    /** Available activities (will be provided by client) */
    activities: Array<{
        code: string;
        name: string;
        description: string;
        base_hours: number;
        group: string;
        tech_category: string;
    }>;
}

/**
 * Response from bulk estimate generation
 */
export interface BulkEstimateFromInterviewResponse {
    /** Whether generation was successful */
    success: boolean;
    /** Estimations for each requirement */
    estimations: BulkRequirementEstimation[];
    /** Overall statistics */
    summary: {
        totalRequirements: number;
        successfulEstimations: number;
        failedEstimations: number;
        totalBaseDays: number;
        avgConfidenceScore: number;
    };
    /** Error message if overall failure */
    error?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Phases of the bulk interview process
 */
export type BulkInterviewPhase =
    | 'idle'
    | 'analyzing'        // AI is analyzing requirements
    | 'interviewing'     // User is answering questions
    | 'generating'       // AI is generating estimates
    | 'reviewing'        // User is reviewing results
    | 'saving'           // Saving to database
    | 'complete'
    | 'error';

/**
 * State for bulk interview UI
 */
export interface BulkInterviewState {
    /** Current phase */
    phase: BulkInterviewPhase;
    /** Requirements being processed */
    requirements: BulkRequirementInput[];
    /** Generated questions */
    questions: BulkInterviewQuestion[];
    /** Requirement analysis results */
    requirementAnalysis: RequirementAnalysis[];
    /** User's answers */
    answers: Map<string, BulkInterviewAnswer>;
    /** Current question index */
    currentQuestionIndex: number;
    /** AI reasoning for questions */
    reasoning?: string;
    /** Estimation results */
    estimations: BulkRequirementEstimation[];
    /** Error message */
    error?: string;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const BulkQuestionOptionSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    impactMultiplier: z.number().optional(),
});

export const BulkInterviewQuestionSchema = z.object({
    id: z.string(),
    scope: z.enum(['global', 'multi-requirement', 'specific']),
    affectedRequirementIds: z.array(z.string()),
    type: z.enum(['single-choice', 'multiple-choice', 'range']),
    category: z.enum([
        'INTEGRATION', 'DATA', 'SECURITY', 'PERFORMANCE',
        'UI_UX', 'ARCHITECTURE', 'TESTING', 'DEPLOYMENT'
    ]),
    question: z.string().min(10).max(500),
    technicalContext: z.string().min(10).max(500),
    impactOnEstimate: z.string().min(10).max(300),
    options: z.array(BulkQuestionOptionSchema).optional(),
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    unit: z.string().optional(),
});

export const RequirementAnalysisSchema = z.object({
    requirementId: z.string(),
    reqCode: z.string(),
    complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    ambiguityScore: z.number().min(0).max(1),
    topics: z.array(z.string()),
    relevantQuestionIds: z.array(z.string()),
});

export const BulkInterviewResponseSchema = z.object({
    success: z.boolean(),
    questions: z.array(BulkInterviewQuestionSchema).min(3).max(12),
    requirementAnalysis: z.array(RequirementAnalysisSchema),
    reasoning: z.string(),
    summary: z.object({
        totalRequirements: z.number(),
        globalQuestions: z.number(),
        multiReqQuestions: z.number(),
        specificQuestions: z.number(),
        avgAmbiguityScore: z.number(),
    }),
    error: z.string().optional(),
});
