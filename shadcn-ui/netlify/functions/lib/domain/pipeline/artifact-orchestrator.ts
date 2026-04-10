/**
 * ArtifactOrchestrator — Coordinates generation of pipeline artifacts
 *
 * Orchestrates the sequential or parallel generation of:
 *   1. RequirementUnderstanding (from description)
 *   2. ImpactMap (from description + understanding)
 *   3. EstimationBlueprint (from description + understanding + impactMap)
 *
 * Key design decisions:
 *   - **Sequential-enriched** (default): each artifact feeds the next,
 *     producing higher-quality downstream artifacts.
 *   - **Parallel-independent**: all three run concurrently, each from
 *     description only. Faster but lower quality.
 *   - **Pre-populated**: some/all artifacts already exist (user confirmed).
 *     Orchestrator skips generation for existing artifacts.
 *
 * The orchestrator works with TYPED inputs — no Record<string, unknown>.
 * Prompt rendering is explicit and controlled.
 *
 * @module artifact-orchestrator
 */

import type { RequirementUnderstanding } from '../../../../../src/types/requirement-understanding';
import type { ImpactMap } from '../../../../../src/types/impact-map';
import type { EstimationBlueprint } from '../../../../../src/types/estimation-blueprint';
import type { CanonicalRequirement, CanonicalProjectContext } from './canonical-requirement';
import { buildCanonicalRequirement } from './canonical-requirement';
import {
    generateRequirementUnderstanding,
    type GenerateUnderstandingRequest,
    type GenerateUnderstandingResponse,
} from '../../ai/actions/generate-understanding';
import {
    generateImpactMap,
    type GenerateImpactMapRequest,
    type GenerateImpactMapResponse,
} from '../../ai/actions/generate-impact-map';
import {
    generateEstimationBlueprint,
    type GenerateBlueprintRequest,
    type GenerateBlueprintResponse,
} from '../../ai/actions/generate-estimation-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestrationStrategy = 'sequential-enriched' | 'parallel-independent' | 'pre-populated';

export interface OrchestrateInput {
    /** Sanitized requirement description */
    description: string;

    /** Technology category code */
    techCategory: string;

    /** Project context (optional) */
    projectContext?: CanonicalProjectContext | null;

    /** Project technical blueprint — architectural baseline (optional) */
    projectTechnicalBlueprint?: Record<string, unknown> | null;

    /**
     * Pre-existing artifacts (user-confirmed). If provided, the orchestrator
     * skips generation for that artifact and uses it as-is.
     */
    existing?: {
        understanding?: RequirementUnderstanding;
        impactMap?: ImpactMap;
        blueprint?: EstimationBlueprint;
    };

    /** Strategy override (default: inferred from existing artifacts) */
    strategy?: OrchestrationStrategy;

    /** Skip cache for testing */
    testMode?: boolean;
}

export interface ArtifactBundle {
    /** The canonical requirement representation */
    canonicalRequirement: CanonicalRequirement;

    /** Generated or pre-existing RequirementUnderstanding */
    understanding: RequirementUnderstanding | null;

    /** Generated or pre-existing ImpactMap */
    impactMap: ImpactMap | null;

    /** Generated or pre-existing EstimationBlueprint */
    blueprint: EstimationBlueprint | null;

    /** Trace of what happened during orchestration */
    generationTrace: GenerationTrace;
}

export interface GenerationTrace {
    /** Strategy used */
    strategy: OrchestrationStrategy;

    /** Per-artifact generation info */
    steps: GenerationStep[];

    /** Total wall-clock time (ms) */
    totalMs: number;
}

export interface GenerationStep {
    /** Which artifact */
    artifact: 'understanding' | 'impactMap' | 'blueprint';

    /** How it was obtained */
    source: 'generated' | 'pre-existing' | 'skipped';

    /** Generation time in ms (0 if pre-existing or skipped) */
    durationMs: number;

    /** Model used (if generated) */
    model?: string;

    /** Confidence of the generated artifact */
    confidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrate artifact generation for a requirement.
 *
 * Default strategy is `sequential-enriched`:
 *   Understanding → ImpactMap (with understanding) → Blueprint (with both)
 *
 * If all artifacts are pre-populated, strategy is `pre-populated` and
 * no LLM calls are made.
 */
export async function orchestrateArtifacts(input: OrchestrateInput): Promise<ArtifactBundle> {
    const startMs = Date.now();
    const steps: GenerationStep[] = [];

    const {
        description,
        techCategory,
        projectContext,
        projectTechnicalBlueprint,
        existing,
        testMode,
    } = input;

    // Determine strategy
    const allExist = !!existing?.understanding && !!existing?.impactMap && !!existing?.blueprint;
    const strategy = input.strategy ?? (allExist ? 'pre-populated' : 'sequential-enriched');

    console.log(`[artifact-orchestrator] Strategy: ${strategy} | existing: understanding=${!!existing?.understanding} impactMap=${!!existing?.impactMap} blueprint=${!!existing?.blueprint}`);

    const projectCtx = projectContext ?? undefined;

    if (strategy === 'parallel-independent') {
        return orchestrateParallel(description, techCategory, projectCtx, projectTechnicalBlueprint ?? undefined, existing, testMode, steps, startMs);
    }

    // ── Sequential-enriched (default) or pre-populated ──────────────

    // Step 1: Understanding
    let understanding: RequirementUnderstanding | null = existing?.understanding ?? null;
    if (understanding) {
        steps.push({ artifact: 'understanding', source: 'pre-existing', durationMs: 0, confidence: understanding.confidence });
    } else {
        const stepStart = Date.now();
        const result = await generateRequirementUnderstanding({
            description,
            techCategory,
            projectContext: projectCtx,
            testMode,
        });
        understanding = toRequirementUnderstanding(result, techCategory);
        steps.push({
            artifact: 'understanding',
            source: 'generated',
            durationMs: Date.now() - stepStart,
            model: 'gpt-4o-mini',
            confidence: understanding.confidence,
        });
        console.log(`[artifact-orchestrator] Understanding generated, confidence=${understanding.confidence}`);
    }

    // Step 2: ImpactMap
    let impactMap: ImpactMap | null = existing?.impactMap ?? null;
    if (impactMap) {
        steps.push({ artifact: 'impactMap', source: 'pre-existing', durationMs: 0, confidence: impactMap.overallConfidence });
    } else {
        const stepStart = Date.now();
        const result = await generateImpactMap({
            description,
            techCategory,
            projectContext: projectCtx,
            requirementUnderstanding: understanding as unknown as Record<string, unknown>,
            projectTechnicalBlueprint: projectTechnicalBlueprint ?? undefined,
            testMode,
        });
        impactMap = toImpactMap(result);
        steps.push({
            artifact: 'impactMap',
            source: 'generated',
            durationMs: Date.now() - stepStart,
            model: 'gpt-4o-mini',
            confidence: impactMap.overallConfidence,
        });
        console.log(`[artifact-orchestrator] ImpactMap generated, impacts=${impactMap.impacts.length}, confidence=${impactMap.overallConfidence}`);
    }

    // Step 3: Blueprint
    let blueprint: EstimationBlueprint | null = existing?.blueprint ?? null;
    if (blueprint) {
        steps.push({ artifact: 'blueprint', source: 'pre-existing', durationMs: 0, confidence: blueprint.overallConfidence });
    } else {
        const stepStart = Date.now();
        const result = await generateEstimationBlueprint({
            description,
            techCategory,
            projectContext: projectCtx,
            requirementUnderstanding: understanding as unknown as Record<string, unknown>,
            impactMap: impactMap as unknown as Record<string, unknown>,
            testMode,
        });
        blueprint = toEstimationBlueprint(result);
        steps.push({
            artifact: 'blueprint',
            source: 'generated',
            durationMs: Date.now() - stepStart,
            model: 'gpt-4o-mini',
            confidence: blueprint.overallConfidence,
        });
        console.log(`[artifact-orchestrator] Blueprint generated, components=${blueprint.components.length}, confidence=${blueprint.overallConfidence}`);
    }

    // Build canonical requirement
    const canonicalRequirement = buildCanonicalRequirement({
        description,
        techCategory,
        understanding,
        projectContext: projectContext ?? null,
    });

    return {
        canonicalRequirement,
        understanding,
        impactMap,
        blueprint,
        generationTrace: {
            strategy,
            steps,
            totalMs: Date.now() - startMs,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parallel strategy
// ─────────────────────────────────────────────────────────────────────────────

async function orchestrateParallel(
    description: string,
    techCategory: string,
    projectContext: CanonicalProjectContext | undefined,
    projectTechnicalBlueprint: Record<string, unknown> | undefined,
    existing: OrchestrateInput['existing'],
    testMode: boolean | undefined,
    steps: GenerationStep[],
    startMs: number,
): Promise<ArtifactBundle> {
    const promises: Promise<void>[] = [];

    let understanding: RequirementUnderstanding | null = existing?.understanding ?? null;
    let impactMap: ImpactMap | null = existing?.impactMap ?? null;
    let blueprint: EstimationBlueprint | null = existing?.blueprint ?? null;

    // Understanding
    if (understanding) {
        steps.push({ artifact: 'understanding', source: 'pre-existing', durationMs: 0, confidence: understanding.confidence });
    } else {
        promises.push((async () => {
            const stepStart = Date.now();
            const result = await generateRequirementUnderstanding({
                description, techCategory, projectContext, testMode,
            });
            understanding = toRequirementUnderstanding(result, techCategory);
            steps.push({
                artifact: 'understanding', source: 'generated',
                durationMs: Date.now() - stepStart, model: 'gpt-4o-mini',
                confidence: understanding.confidence,
            });
        })());
    }

    // ImpactMap (parallel — no understanding input, but with blueprint baseline)
    if (impactMap) {
        steps.push({ artifact: 'impactMap', source: 'pre-existing', durationMs: 0, confidence: impactMap.overallConfidence });
    } else {
        promises.push((async () => {
            const stepStart = Date.now();
            const result = await generateImpactMap({
                description, techCategory, projectContext, projectTechnicalBlueprint, testMode,
            });
            impactMap = toImpactMap(result);
            steps.push({
                artifact: 'impactMap', source: 'generated',
                durationMs: Date.now() - stepStart, model: 'gpt-4o-mini',
                confidence: impactMap.overallConfidence,
            });
        })());
    }

    // Blueprint (parallel — no understanding/impactMap input)
    if (blueprint) {
        steps.push({ artifact: 'blueprint', source: 'pre-existing', durationMs: 0, confidence: blueprint.overallConfidence });
    } else {
        promises.push((async () => {
            const stepStart = Date.now();
            const result = await generateEstimationBlueprint({
                description, techCategory, projectContext, testMode,
            });
            blueprint = toEstimationBlueprint(result);
            steps.push({
                artifact: 'blueprint', source: 'generated',
                durationMs: Date.now() - stepStart, model: 'gpt-4o-mini',
                confidence: blueprint.overallConfidence,
            });
        })());
    }

    await Promise.all(promises);

    const canonicalRequirement = buildCanonicalRequirement({
        description,
        techCategory,
        understanding,
        projectContext: projectContext ?? null,
    });

    return {
        canonicalRequirement,
        understanding,
        impactMap,
        blueprint,
        generationTrace: {
            strategy: 'parallel-independent',
            steps,
            totalMs: Date.now() - startMs,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response → Domain type converters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the generate-understanding response to a full RequirementUnderstanding.
 * The response lacks metadata — we add it here.
 */
function toRequirementUnderstanding(
    response: GenerateUnderstandingResponse,
    techCategory?: string,
): RequirementUnderstanding {
    return {
        ...response,
        metadata: {
            generatedAt: new Date().toISOString(),
            model: 'gpt-4o-mini',
            techCategory,
            inputDescriptionLength: 0, // caller doesn't need this for pipeline
        },
    };
}

/**
 * Convert the generate-impact-map response to a full ImpactMap.
 * The response shape matches ImpactMap — this is a type-safe cast.
 */
function toImpactMap(response: GenerateImpactMapResponse): ImpactMap {
    return {
        summary: response.summary,
        impacts: response.impacts.map(i => ({
            layer: i.layer as ImpactMap['impacts'][0]['layer'],
            action: i.action as ImpactMap['impacts'][0]['action'],
            components: i.components,
            reason: i.reason,
            confidence: i.confidence,
        })),
        overallConfidence: response.overallConfidence,
    };
}

/**
 * Convert the generate-blueprint response to a full EstimationBlueprint.
 * The response shape matches EstimationBlueprint — this is a type-safe cast.
 */
function toEstimationBlueprint(response: GenerateBlueprintResponse): EstimationBlueprint {
    return {
        summary: response.summary,
        components: response.components.map(c => ({
            name: c.name,
            layer: c.layer as EstimationBlueprint['components'][0]['layer'],
            interventionType: c.interventionType as EstimationBlueprint['components'][0]['interventionType'],
            complexity: c.complexity as EstimationBlueprint['components'][0]['complexity'],
            notes: c.notes,
        })),
        integrations: response.integrations.map(i => ({
            target: i.target,
            type: i.type,
            direction: i.direction as EstimationBlueprint['integrations'][0]['direction'],
            notes: i.notes,
        })),
        dataEntities: response.dataEntities.map(d => ({
            entity: d.entity,
            operation: d.operation as EstimationBlueprint['dataEntities'][0]['operation'],
            notes: d.notes,
        })),
        testingScope: response.testingScope.map(t => ({
            area: t.area,
            testType: t.testType,
            criticality: t.criticality as EstimationBlueprint['testingScope'][0]['criticality'],
        })),
        assumptions: response.assumptions,
        exclusions: response.exclusions,
        uncertainties: response.uncertainties,
        overallConfidence: response.overallConfidence,
        reasoning: response.reasoning,
    };
}
