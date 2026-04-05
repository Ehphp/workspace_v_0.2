/**
 * Type Definitions for Impact Map Artifact
 *
 * Defines the structured output that captures the AI's architectural impact
 * analysis of a requirement — which system layers are affected, what type
 * of structural action each requires, and which components are involved.
 *
 * ARCHITECTURAL CONTRACT:
 * - Impact Map is a PRE-TASK artifact — it describes WHERE the system is
 *   affected, not WHAT to build or HOW LONG it takes.
 * - It must never collapse into WBS (work breakdown) semantics.
 * - components[] must be architecture-oriented nouns (e.g. "approval service"),
 *   never tasks, file names, code symbols, or technology-specific labels.
 * - The artifact is technology-agnostic and layer-based.
 * - Estimation remains a separate downstream stage.
 *
 * Generated AFTER Requirement Understanding, BEFORE Technical Interview.
 */

import { z } from 'zod';
import type { RequirementUnderstanding } from './requirement-understanding';
import {
    type PipelineLayer,
    PipelineLayerSchema,
} from '../../netlify/functions/lib/domain/pipeline/pipeline-domain';

// ============================================================================
// ENUMS / UNION TYPES
// ============================================================================

/**
 * Architectural layers — extends PipelineLayer with 'ai_pipeline' for LLM output validation.
 *
 * | Layer          | Covers                                                    |
 * |----------------|-----------------------------------------------------------|
 * | frontend       | UI, forms, pages, portals, dashboards                     |
 * | logic          | Business rules, services, plugins, server-side validation |
 * | data           | Schema, entities, tables, views, data integrity           |
 * | integration    | APIs, connectors, external system calls, webhooks         |
 * | automation     | Workflows, scheduled processes, event-driven flows        |
 * | configuration  | Feature flags, settings, environment parameters           |
 * | ai_pipeline    | LLM prompts, RAG pipelines, embeddings, ML models        |
 */
export type ImpactLayer = PipelineLayer | 'ai_pipeline';

/**
 * Type of structural action required on a layer.
 * Impact-specific subset — excludes 'delete' (not applicable in impact analysis).
 *
 * Maps to effort gradients (read < configure < modify < create)
 * but the Impact Map itself must NOT estimate effort.
 */
export type ImpactAction = 'read' | 'modify' | 'create' | 'configure';

// ============================================================================
// CORE ARTIFACT
// ============================================================================

/**
 * A single architectural impact entry.
 *
 * Describes one layer affected by the requirement, the type of action,
 * the components involved, the reason (traced to the requirement), and
 * a confidence score for this specific assessment.
 */
export interface ImpactItem {
    /** Architectural layer affected */
    layer: ImpactLayer;
    /** Type of structural action required */
    action: ImpactAction;
    /**
     * Affected components within the layer.
     * Must be architecture-oriented nouns (e.g. "approval service",
     * "order entity") — never tasks, file names, or technology labels.
     */
    components: string[];
    /** Why this layer is impacted — must reference the requirement */
    reason: string;
    /** Confidence in this individual impact assessment (0.0–1.0) */
    confidence: number;
}

/**
 * The complete Impact Map artifact.
 *
 * One-paragraph architectural summary + list of layer impacts +
 * aggregate confidence score.
 */
export interface ImpactMap {
    /** One-paragraph architectural summary */
    summary: string;
    /** Individual layer impacts */
    impacts: ImpactItem[];
    /** Aggregate confidence across all impacts (0.0–1.0) */
    overallConfidence: number;
}

// ============================================================================
// METADATA
// ============================================================================

/**
 * Generation metadata — stored alongside the artifact for auditing.
 * NOT injected into downstream prompts.
 */
export interface ImpactMapMetadata {
    /** ISO timestamp of generation */
    generatedAt: string;
    /** Model used (e.g. "gpt-4o-mini") */
    model: string;
    /** Technology category if available */
    techCategory?: string;
    /** Length of the original input description */
    inputDescriptionLength: number;
    /** Whether Requirement Understanding was available as input */
    hasRequirementUnderstanding: boolean;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

/**
 * Request to generate an Impact Map artifact
 */
export interface ImpactMapRequest {
    /** The requirement description to analyze */
    description: string;
    /** Technology category (optional — strengthens layer interpretation) */
    techCategory?: string;
    /** Selected technology preset ID */
    techPresetId?: string;
    /** Optional project context */
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
    /** Optional confirmed Requirement Understanding (from previous step) */
    requirementUnderstanding?: RequirementUnderstanding;
    /** Optional project technical blueprint (architectural baseline) */
    projectTechnicalBlueprint?: Record<string, unknown>;
}

/**
 * Response from the Impact Map generation endpoint
 */
export interface ImpactMapResponse {
    success: boolean;
    /** The generated Impact Map (present when success=true) */
    impactMap?: ImpactMap;
    /** Generation metadata */
    metadata?: ImpactMapMetadata;
    /** Performance metrics */
    metrics?: {
        totalMs: number;
        llmMs: number;
        model: string;
    };
    /** Error message (present when success=false) */
    error?: string;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

/** Extends PipelineLayerSchema with 'ai_pipeline' for LLM output validation. */
export const ImpactLayerSchema = z.union([
    PipelineLayerSchema,
    z.literal('ai_pipeline'),
]);

/** Impact-specific action schema — validates the 4-value ImpactAction subset. */
export const ImpactActionSchema = z.enum([
    'read',
    'modify',
    'create',
    'configure',
]);

export const ImpactItemSchema = z.object({
    layer: ImpactLayerSchema,
    action: ImpactActionSchema,
    components: z.array(z.string().min(1).max(200)).min(1).max(10),
    reason: z.string().min(10).max(500),
    confidence: z.number().min(0).max(1),
});

export const ImpactMapSchema = z.object({
    summary: z.string().min(20).max(1000),
    impacts: z.array(ImpactItemSchema).min(1).max(15),
    overallConfidence: z.number().min(0).max(1),
});

export const ImpactMapMetadataSchema = z.object({
    generatedAt: z.string(),
    model: z.string(),
    techCategory: z.string().optional(),
    inputDescriptionLength: z.number().int().min(0),
    hasRequirementUnderstanding: z.boolean(),
});

export const ImpactMapResponseSchema = z.object({
    success: z.boolean(),
    impactMap: ImpactMapSchema.optional(),
    metadata: ImpactMapMetadataSchema.optional(),
    metrics: z.object({
        totalMs: z.number(),
        llmMs: z.number(),
        model: z.string(),
    }).optional(),
    error: z.string().optional(),
});
