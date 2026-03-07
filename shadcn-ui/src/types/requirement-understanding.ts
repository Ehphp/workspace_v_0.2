/**
 * Type Definitions for Requirement Understanding Artifact
 *
 * Defines the structured output that captures the AI's formal understanding
 * of a requirement — objective, perimeter, actors, state transition,
 * assumptions, and complexity assessment.
 *
 * This artifact is generated BEFORE the technical interview / estimation,
 * giving the user an inspectable "contract" of what the system understood.
 */

import { z } from 'zod';

// ============================================================================
// CORE ARTIFACT
// ============================================================================

/**
 * Actor involved in the requirement
 */
export interface RequirementActor {
    /** Role name (e.g. "End user", "Admin", "External system") */
    role: string;
    /** How the actor interacts with the requirement (e.g. "Submits requests") */
    interaction: string;
}

/**
 * State transition — initial (before) → final (after)
 */
export interface StateTransition {
    /** Current situation before implementation */
    initialState: string;
    /** Desired situation after implementation */
    finalState: string;
}

/**
 * Complexity assessment with rationale
 */
export interface ComplexityAssessment {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    /** Brief explanation of why this complexity level was chosen */
    rationale: string;
}

/**
 * Generation metadata
 */
export interface UnderstandingMetadata {
    /** ISO timestamp of generation */
    generatedAt: string;
    /** Model used (e.g. "gpt-4o-mini") */
    model: string;
    /** Technology category if available */
    techCategory?: string;
    /** Length of the original input description */
    inputDescriptionLength: number;
}

/**
 * Structured Requirement Understanding artifact.
 *
 * Produced by AI from a raw requirement description. Captures:
 * - Business objective and expected output
 * - Functional perimeter and exclusions
 * - Actors and their interactions
 * - State transition (before → after)
 * - Preconditions, assumptions, complexity
 */
export interface RequirementUnderstanding {
    /** Business objective — what the requirement aims to achieve */
    businessObjective: string;
    /** Expected output / deliverables */
    expectedOutput: string;
    /** Functional perimeter — what's in scope (1-8 items) */
    functionalPerimeter: string[];
    /** Explicit exclusions — what's NOT in scope (0-5 items) */
    exclusions: string[];
    /** Actors / stakeholders involved (1-5 actors) */
    actors: RequirementActor[];
    /** Initial state → Final state */
    stateTransition: StateTransition;
    /** Preconditions / triggers (0-5 items) */
    preconditions: string[];
    /** Key assumptions made by the AI (0-5 items) */
    assumptions: string[];
    /** Complexity assessment */
    complexityAssessment: ComplexityAssessment;
    /** Confidence in the understanding (0–1) */
    confidence: number;
    /** Generation metadata */
    metadata: UnderstandingMetadata;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

/**
 * Request to generate a Requirement Understanding artifact
 */
export interface RequirementUnderstandingRequest {
    /** The requirement description to analyze */
    description: string;
    /** Technology category (optional — available if user already selected tech) */
    techCategory?: string;
    /** Selected technology preset ID */
    techPresetId?: string;
    /** Optional project context */
    projectContext?: {
        name: string;
        description: string;
        owner?: string;
    };
    /** Optional normalization result (if user ran "Analizza e Migliora" first) */
    normalizationResult?: {
        normalizedDescription: string;
    };
}

/**
 * Response from the Requirement Understanding generation endpoint
 */
export interface RequirementUnderstandingResponse {
    success: boolean;
    /** The generated understanding (present when success=true) */
    understanding?: RequirementUnderstanding;
    /** Error message (present when success=false) */
    error?: string;
    /** Performance metrics */
    metrics?: {
        totalMs: number;
        llmMs: number;
        model: string;
    };
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const RequirementActorSchema = z.object({
    role: z.string().min(1).max(100),
    interaction: z.string().min(1).max(300),
});

export const StateTransitionSchema = z.object({
    initialState: z.string().min(1).max(500),
    finalState: z.string().min(1).max(500),
});

export const ComplexityAssessmentSchema = z.object({
    level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    rationale: z.string().min(1).max(300),
});

export const UnderstandingMetadataSchema = z.object({
    generatedAt: z.string(),
    model: z.string(),
    techCategory: z.string().optional(),
    inputDescriptionLength: z.number().int().min(0),
});

export const RequirementUnderstandingSchema = z.object({
    businessObjective: z.string().min(1).max(500),
    expectedOutput: z.string().min(1).max(500),
    functionalPerimeter: z.array(z.string().min(1).max(300)).min(1).max(8),
    exclusions: z.array(z.string().min(1).max(300)).max(5),
    actors: z.array(RequirementActorSchema).min(1).max(5),
    stateTransition: StateTransitionSchema,
    preconditions: z.array(z.string().min(1).max(300)).max(5),
    assumptions: z.array(z.string().min(1).max(300)).max(5),
    complexityAssessment: ComplexityAssessmentSchema,
    confidence: z.number().min(0).max(1),
    metadata: UnderstandingMetadataSchema,
});

export const RequirementUnderstandingResponseSchema = z.object({
    success: z.boolean(),
    understanding: RequirementUnderstandingSchema.optional(),
    error: z.string().optional(),
    metrics: z.object({
        totalMs: z.number(),
        llmMs: z.number(),
        model: z.string(),
    }).optional(),
});
