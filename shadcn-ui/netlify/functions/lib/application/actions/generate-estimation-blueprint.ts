/**
 * AI Action: Generate Estimation Blueprint
 *
 * Produces a structured Estimation Blueprint from a requirement description,
 * optionally enriched by Requirement Understanding and Impact Map artifacts.
 *
 * Mirrors generate-impact-map.ts:
 *   1. Cache lookup (skip in testMode)
 *   2. Build prompt (system + user)
 *   3. LLM call with strict JSON schema
 *   4. Validate output with Zod
 *   5. Cache store
 *   6. Return typed result
 */

import { z } from 'zod';
import { getDefaultProvider } from '../../infrastructure/llm/openai-client';
import { getPrompt } from '../../ai/prompt-registry';
import {
    BLUEPRINT_SYSTEM_PROMPT,
    createBlueprintResponseSchema,
} from '../../ai/prompts/blueprint-generation';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
} from '../../infrastructure/cache/ai-cache';
import type { CacheConfig } from '../../infrastructure/cache/ai-cache';
import { formatProjectContextBlock } from '../../ai/prompt-builder';
import { formatProjectTechnicalBlueprintBlock } from '../../ai/formatters/project-blueprint-formatter';
import { formatArtifactBlock } from '../../ai/formatters/artifact-formatter';
import type { RequirementUnderstanding } from '../../../../../src/types/requirement-understanding';
import type { ImpactMap } from '../../../../../src/types/impact-map';

// ─────────────────────────────────────────────────────────────────────────────
// Cache profile — 12 h (same TTL as understanding / impact map)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_BLUEPRINT: CacheConfig = {
    prefix: 'ai:blueprint',
    ttlSeconds: 12 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types (backend-local)
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateBlueprintRequest {
    /** Sanitized requirement description */
    description: string;
    /** Technology category (e.g. POWER_PLATFORM, BACKEND) */
    techCategory?: string;
    /** Project context */
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
    /** Confirmed Requirement Understanding from previous step */
    requirementUnderstanding?: RequirementUnderstanding | Record<string, unknown>;
    /** Confirmed Impact Map from previous step */
    impactMap?: ImpactMap | Record<string, unknown>;
    /** Project Technical Blueprint for architectural baseline */
    projectTechnicalBlueprint?: Record<string, unknown>;
    /** Skip cache for testing */
    testMode?: boolean;
}

export interface GenerateBlueprintResponse {
    summary: string;
    components: Array<{
        name: string;
        layer: string;
        interventionType: string;
        complexity: string;
        notes?: string;
    }>;
    integrations: Array<{
        target: string;
        type: string;
        direction?: string;
        notes?: string;
    }>;
    dataEntities: Array<{
        entity: string;
        operation: string;
        notes?: string;
    }>;
    testingScope: Array<{
        area: string;
        testType: string;
        criticality?: string;
    }>;
    assumptions: string[];
    exclusions: string[];
    uncertainties: string[];
    overallConfidence: number;
    reasoning?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for server-side validation of LLM output
// ─────────────────────────────────────────────────────────────────────────────

const BlueprintLayerEnum = z.enum([
    'frontend', 'logic', 'data', 'integration',
    'automation', 'configuration', 'ai_pipeline',
]);

const InterventionTypeEnum = z.enum([
    'new_development', 'modification', 'configuration',
    'integration', 'migration',
]);

const ComplexityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const DataOperationEnum = z.enum(['read', 'write', 'create', 'modify', 'delete']);

const DirectionEnum = z.enum(['inbound', 'outbound', 'bidirectional']);

const CriticalityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const LLMOutputSchema = z.object({
    summary: z.string().min(20).max(1500),
    components: z.array(z.object({
        name: z.string().min(2).max(200),
        layer: BlueprintLayerEnum,
        interventionType: InterventionTypeEnum,
        complexity: ComplexityEnum,
        notes: z.string().max(500).optional(),
    })).min(1).max(20),
    integrations: z.array(z.object({
        target: z.string().min(2).max(200),
        type: z.string().min(2).max(100),
        direction: DirectionEnum.optional(),
        notes: z.string().max(500).optional(),
    })).max(15),
    dataEntities: z.array(z.object({
        entity: z.string().min(2).max(200),
        operation: DataOperationEnum,
        notes: z.string().max(500).optional(),
    })).max(20),
    testingScope: z.array(z.object({
        area: z.string().min(2).max(200),
        testType: z.string().min(2).max(100),
        criticality: CriticalityEnum.optional(),
    })).max(15),
    assumptions: z.array(z.string().min(5).max(300)).max(10),
    exclusions: z.array(z.string().min(5).max(300)).max(10),
    uncertainties: z.array(z.string().min(5).max(300)).max(10),
    overallConfidence: z.number().min(0).max(1),
    reasoning: z.string().max(2000).optional(),
});

// formatUnderstandingBlock and formatImpactMapBlock → shared formatArtifactBlock from formatters/artifact-formatter

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a structured Estimation Blueprint from a requirement description.
 *
 * @param request - Sanitized description + optional upstream artifact context
 * @returns Validated EstimationBlueprint artifact (without metadata — caller adds it)
 */
export async function generateEstimationBlueprint(
    request: GenerateBlueprintRequest
): Promise<GenerateBlueprintResponse> {
    const { description, techCategory, projectContext, requirementUnderstanding, impactMap, projectTechnicalBlueprint, testMode } = request;

    console.log('[generate-blueprint] Starting, description length:', description.length);

    // ── 1. Cache lookup ─────────────────────────────────────────────
    const cacheKeyParts = [
        description.slice(0, 300),
        techCategory ?? '',
        requirementUnderstanding ? 'ru:1' : 'ru:0',
        impactMap ? 'im:1' : 'im:0',
        projectTechnicalBlueprint ? 'ptb:1' : 'ptb:0',
    ];

    if (!testMode) {
        const cacheKey = buildCacheKey(cacheKeyParts, CACHE_BLUEPRINT);
        const cached = await getCachedResponse<GenerateBlueprintResponse>(
            cacheKey,
            CACHE_BLUEPRINT,
        );
        if (cached) {
            console.log('[generate-blueprint] Cache hit');
            return cached;
        }
    }

    // ── 2. Build prompts ────────────────────────────────────────────
    const systemPrompt =
        (await getPrompt('estimation_blueprint')) || BLUEPRINT_SYSTEM_PROMPT;

    const userPromptParts: string[] = [
        `DESCRIZIONE DEL REQUISITO:\n${description}`,
    ];

    // Inject understanding block (if available)
    const understandingBlock = formatArtifactBlock(
        requirementUnderstanding as Record<string, unknown>,
        'COMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall\'utente)',
    );
    if (understandingBlock) {
        userPromptParts.push(understandingBlock);
    }

    // Inject impact map block (if available)
    const impactMapBlock = formatArtifactBlock(
        impactMap as unknown as Record<string, unknown>,
        'MAPPA IMPATTO ARCHITETTURALE (validata dall\'utente)',
    );
    if (impactMapBlock) {
        userPromptParts.push(impactMapBlock);
    }

    if (techCategory) {
        userPromptParts.push(`\nCATEGORIA TECNOLOGICA: ${techCategory}`);
    }
    if (projectContext) {
        userPromptParts.push(formatProjectContextBlock(projectContext));
    }

    // Inject project technical blueprint (if available)
    const ptbBlock = formatProjectTechnicalBlueprintBlock(projectTechnicalBlueprint, {
        instruction: 'Usa questa baseline architetturale per decomporre il requisito. Identifica quali componenti esistenti vengono modificati e quali sono nuovi.',
    });
    if (ptbBlock) {
        userPromptParts.push(ptbBlock);
    }

    const userPrompt = userPromptParts.join('\n');
    const responseSchema = createBlueprintResponseSchema();

    // ── 3. LLM call ─────────────────────────────────────────────────
    const llmStart = Date.now();

    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 3000,
        responseFormat: responseSchema as any,
        systemPrompt,
        userPrompt,
        options: 'complex',
    });

    const llmMs = Date.now() - llmStart;
    console.log('[generate-blueprint] LLM completed in', llmMs, 'ms');

    if (!responseContent) {
        throw new Error('No response from LLM for blueprint generation');
    }

    // ── 4. Parse + validate ─────────────────────────────────────────
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseContent);
    } catch {
        console.error('[generate-blueprint] Invalid JSON from LLM');
        throw new Error('LLM returned invalid JSON for blueprint generation');
    }

    const validation = LLMOutputSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('[generate-blueprint] Validation failed:', validation.error.issues);
        throw new Error('LLM output failed schema validation for blueprint generation');
    }

    const result = validation.data;

    // ── 5. Cache store ──────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey(cacheKeyParts, CACHE_BLUEPRINT);
        await setCachedResponse(cacheKey, result, CACHE_BLUEPRINT);
    }

    console.log(
        '[generate-blueprint] Success, overallConfidence:',
        result.overallConfidence,
        'components:',
        result.components.length,
        'integrations:',
        result.integrations.length,
    );

    return result;
}
