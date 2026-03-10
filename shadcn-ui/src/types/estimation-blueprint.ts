/**
 * Type Definitions for Estimation Blueprint Artifact
 *
 * The Estimation Blueprint is a structured intermediate representation
 * that captures the technical anatomy of a requirement BEFORE activity
 * selection. It decomposes the requirement into impacted components,
 * integrations, data entities, testing scope, assumptions, exclusions,
 * and uncertainties.
 *
 * ARCHITECTURAL CONTRACT:
 * - The Blueprint is generated AFTER Understanding + Impact Map,
 *   BEFORE Technical Interview / Estimation.
 * - It must NOT estimate hours, days, or effort.
 * - It must NOT select activities from the catalog.
 * - It must produce a structured technical work model that later steps
 *   (interview, estimation) can consume as formal input.
 * - It bridges the gap between "AI reasoning text" and "selected activities"
 *   by providing a structured intermediate representation.
 */

import { z } from 'zod';
import type { RequirementUnderstanding } from './requirement-understanding';
import type { ImpactMap } from './impact-map';

// ============================================================================
// ENUMS / UNION TYPES
// ============================================================================

/**
 * Architectural layers — reuses the same taxonomy as ImpactMap
 * for consistency across the pipeline.
 */
export type BlueprintLayer =
    | 'frontend'
    | 'logic'
    | 'data'
    | 'integration'
    | 'automation'
    | 'configuration'
    | 'ai_pipeline';

/**
 * Type of technical intervention required on a component.
 */
export type InterventionType =
    | 'new_development'
    | 'modification'
    | 'configuration'
    | 'integration'
    | 'migration';

/**
 * Estimated complexity of work on a component.
 */
export type ComponentComplexity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Direction of an integration.
 */
export type IntegrationDirection = 'inbound' | 'outbound' | 'bidirectional';

/**
 * Type of data operation.
 */
export type DataOperation = 'read' | 'write' | 'create' | 'modify' | 'delete';

/**
 * Criticality level for testing areas.
 */
export type TestCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================================================
// CORE ARTIFACT
// ============================================================================

/**
 * A component/subsystem impacted by the requirement.
 */
export interface BlueprintComponent {
    /** Component or subsystem name (architecture-oriented) */
    name: string;
    /** Architectural layer */
    layer: BlueprintLayer;
    /** Type of technical intervention */
    interventionType: InterventionType;
    /** Complexity assessment */
    complexity: ComponentComplexity;
    /** Optional notes or clarifications */
    notes?: string;
}

/**
 * An integration point touched by the requirement.
 */
export interface BlueprintIntegration {
    /** Target system or service */
    target: string;
    /** Type of integration (API, webhook, file, message queue, etc.) */
    type: string;
    /** Direction of data flow */
    direction?: IntegrationDirection;
    /** Optional notes */
    notes?: string;
}

/**
 * A data entity touched by the requirement.
 */
export interface BlueprintDataEntity {
    /** Entity name */
    entity: string;
    /** Type of data operation */
    operation: DataOperation;
    /** Optional notes */
    notes?: string;
}

/**
 * A testing area identified for the requirement.
 */
export interface BlueprintTestingScope {
    /** Area to test */
    area: string;
    /** Type of test (unit, integration, e2e, UAT, performance, etc.) */
    testType: string;
    /** Criticality of this testing area */
    criticality?: TestCriticality;
}

/**
 * The complete Estimation Blueprint artifact.
 */
export interface EstimationBlueprint {
    /** One-paragraph summary of the technical work model */
    summary: string;
    /** Impacted components/subsystems */
    components: BlueprintComponent[];
    /** Integration points */
    integrations: BlueprintIntegration[];
    /** Data entities touched */
    dataEntities: BlueprintDataEntity[];
    /** Testing scope */
    testingScope: BlueprintTestingScope[];
    /** Key assumptions made about the requirement */
    assumptions: string[];
    /** Explicit exclusions from scope */
    exclusions: string[];
    /** Open points / uncertainties that could affect estimation */
    uncertainties: string[];
    /** Overall confidence in the blueprint (0.0–1.0) */
    overallConfidence: number;
    /** Optional reasoning about the decomposition */
    reasoning?: string;
}

// ============================================================================
// METADATA
// ============================================================================

/**
 * Generation metadata — stored alongside the artifact for auditing.
 */
export interface EstimationBlueprintMetadata {
    /** ISO timestamp of generation */
    generatedAt: string;
    /** Model used */
    model: string;
    /** Technology category if available */
    techCategory?: string;
    /** Length of the original input description */
    inputDescriptionLength: number;
    /** Whether Requirement Understanding was available as input */
    hasRequirementUnderstanding: boolean;
    /** Whether Impact Map was available as input */
    hasImpactMap: boolean;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

/**
 * Request to generate an Estimation Blueprint artifact.
 */
export interface EstimationBlueprintRequest {
    /** The requirement description */
    description: string;
    /** Technology category */
    techCategory?: string;
    /** Selected technology preset ID */
    techPresetId?: string;
    /** Optional project context */
    projectContext?: {
        name: string;
        description: string;
        owner?: string;
    };
    /** Optional confirmed Requirement Understanding */
    requirementUnderstanding?: RequirementUnderstanding;
    /** Optional confirmed Impact Map */
    impactMap?: ImpactMap;
}

/**
 * Response from the Estimation Blueprint generation endpoint.
 */
export interface EstimationBlueprintResponse {
    success: boolean;
    /** The generated blueprint (present when success=true) */
    blueprint?: EstimationBlueprint;
    /** Generation metadata */
    metadata?: EstimationBlueprintMetadata;
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
// ZOD SCHEMAS
// ============================================================================

export const BlueprintLayerSchema = z.enum([
    'frontend',
    'logic',
    'data',
    'integration',
    'automation',
    'configuration',
    'ai_pipeline',
]);

export const InterventionTypeSchema = z.enum([
    'new_development',
    'modification',
    'configuration',
    'integration',
    'migration',
]);

export const ComponentComplexitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const IntegrationDirectionSchema = z.enum([
    'inbound',
    'outbound',
    'bidirectional',
]);

export const DataOperationSchema = z.enum([
    'read',
    'write',
    'create',
    'modify',
    'delete',
]);

export const TestCriticalitySchema = z.enum([
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
]);

export const BlueprintComponentSchema = z.object({
    name: z.string().min(2).max(200),
    layer: BlueprintLayerSchema,
    interventionType: InterventionTypeSchema,
    complexity: ComponentComplexitySchema,
    notes: z.string().max(500).optional(),
});

export const BlueprintIntegrationSchema = z.object({
    target: z.string().min(2).max(200),
    type: z.string().min(2).max(100),
    direction: IntegrationDirectionSchema.optional(),
    notes: z.string().max(500).optional(),
});

export const BlueprintDataEntitySchema = z.object({
    entity: z.string().min(2).max(200),
    operation: DataOperationSchema,
    notes: z.string().max(500).optional(),
});

export const BlueprintTestingScopeSchema = z.object({
    area: z.string().min(2).max(200),
    testType: z.string().min(2).max(100),
    criticality: TestCriticalitySchema.optional(),
});

export const EstimationBlueprintSchema = z.object({
    summary: z.string().min(20).max(1500),
    components: z.array(BlueprintComponentSchema).min(1).max(20),
    integrations: z.array(BlueprintIntegrationSchema).max(15),
    dataEntities: z.array(BlueprintDataEntitySchema).max(20),
    testingScope: z.array(BlueprintTestingScopeSchema).max(15),
    assumptions: z.array(z.string().min(5).max(300)).max(10),
    exclusions: z.array(z.string().min(5).max(300)).max(10),
    uncertainties: z.array(z.string().min(5).max(300)).max(10),
    overallConfidence: z.number().min(0).max(1),
    reasoning: z.string().max(2000).optional(),
});

export const EstimationBlueprintMetadataSchema = z.object({
    generatedAt: z.string(),
    model: z.string(),
    techCategory: z.string().optional(),
    inputDescriptionLength: z.number().int().min(0),
    hasRequirementUnderstanding: z.boolean(),
    hasImpactMap: z.boolean(),
});

export const EstimationBlueprintResponseSchema = z.object({
    success: z.boolean(),
    blueprint: EstimationBlueprintSchema.optional(),
    metadata: EstimationBlueprintMetadataSchema.optional(),
    metrics: z.object({
        totalMs: z.number(),
        llmMs: z.number(),
        model: z.string(),
    }).optional(),
    error: z.string().optional(),
});
