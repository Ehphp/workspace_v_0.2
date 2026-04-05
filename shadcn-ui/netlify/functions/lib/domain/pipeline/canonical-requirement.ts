/**
 * Canonical Requirement Representation
 *
 * A typed, normalized view of the requirement that feeds into the
 * ArtifactOrchestrator. Built from:
 *   - Raw description text
 *   - RequirementUnderstanding (if available)
 *   - Project context (if available)
 *
 * This is NOT a persistence entity — it's a transient pipeline object
 * that ensures all downstream consumers (ImpactMap generator, Blueprint
 * generator, CandidateSynthesizer) work from the same canonical input.
 *
 * @module canonical-requirement
 */

import type { RequirementUnderstanding, ComplexityAssessment, RequirementActor, StateTransition } from '../../../../../src/types/requirement-understanding';
import type { Complexity, PipelineLayer } from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// Core Type
// ─────────────────────────────────────────────────────────────────────────────

export interface CanonicalRequirement {
    /** Sanitized description text */
    description: string;

    /** Technology category code (e.g. 'POWER_PLATFORM', 'BACKEND') */
    techCategory: string;

    /** Business objective (from Understanding, or empty) */
    businessObjective: string;

    /** Expected output (from Understanding, or empty) */
    expectedOutput: string;

    /**
     * Normalized functional perimeter terms.
     * Sourced from Understanding.functionalPerimeter.
     */
    normalizedPerimeter: string[];

    /** Explicit exclusions (from Understanding) */
    exclusions: string[];

    /** Actors involved (from Understanding) */
    actors: RequirementActor[];

    /** State transition: before → after (from Understanding) */
    stateTransition: StateTransition | null;

    /** Complexity assessment (from Understanding) */
    complexity: ComplexityAssessment | null;

    /** Understanding confidence (0–1), or 0 if no understanding */
    understandingConfidence: number;

    /** Project context (optional) */
    projectContext: CanonicalProjectContext | null;

    /** Source flags — which inputs were available */
    sources: {
        hasUnderstanding: boolean;
        hasProjectContext: boolean;
    };
}

export interface CanonicalProjectContext {
    name: string;
    description: string;
    owner?: string;
    projectType?: string;
    domain?: string;
    scope?: string;
    teamSize?: number;
    deadlinePressure?: string;
    methodology?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildCanonicalInput {
    /** Sanitized requirement description */
    description: string;
    /** Technology category code */
    techCategory: string;
    /** RequirementUnderstanding artifact (optional) */
    understanding?: RequirementUnderstanding | null;
    /** Project context (optional) */
    projectContext?: CanonicalProjectContext | null;
}

/**
 * Build a CanonicalRequirement from available inputs.
 *
 * If understanding is absent, fields are set to safe defaults (empty arrays,
 * null objects) so downstream consumers don't need null checks on every field.
 */
export function buildCanonicalRequirement(input: BuildCanonicalInput): CanonicalRequirement {
    const { description, techCategory, understanding, projectContext } = input;

    if (understanding) {
        return {
            description,
            techCategory,
            businessObjective: understanding.businessObjective,
            expectedOutput: understanding.expectedOutput,
            normalizedPerimeter: [...understanding.functionalPerimeter],
            exclusions: [...understanding.exclusions],
            actors: [...understanding.actors],
            stateTransition: understanding.stateTransition,
            complexity: understanding.complexityAssessment,
            understandingConfidence: understanding.confidence,
            projectContext: projectContext ?? null,
            sources: {
                hasUnderstanding: true,
                hasProjectContext: !!projectContext,
            },
        };
    }

    return {
        description,
        techCategory,
        businessObjective: '',
        expectedOutput: '',
        normalizedPerimeter: [],
        exclusions: [],
        actors: [],
        stateTransition: null,
        complexity: null,
        understandingConfidence: 0,
        projectContext: projectContext ?? null,
        sources: {
            hasUnderstanding: false,
            hasProjectContext: !!projectContext,
        },
    };
}
