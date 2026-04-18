/**
 * AI Action: Generate Impact Map
 *
 * Produces a structured Impact Map artifact from a requirement description
 * using gpt-4o-mini.
 *
 * Mirrors generate-understanding.ts:
 *   1. Cache lookup (skip in testMode)
 *   2. Build prompt (system + user)
 *   3. LLM call with strict JSON schema
 *   4. Validate output with Zod
 *   5. Cache store
 *   6. Return typed result
 */

import { z } from 'zod';
import { getDefaultProvider } from '../openai-client';
import { getPrompt } from '../prompt-registry';
import {
    IMPACT_MAP_SYSTEM_PROMPT,
    createImpactMapResponseSchema,
} from '../prompts/impact-map-generation';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
} from '../ai-cache';
import type { CacheConfig } from '../ai-cache';
import { formatProjectContextBlock } from '../prompt-builder';
import { formatProjectTechnicalBlueprintBlock } from '../formatters/project-blueprint-formatter';
import { formatArtifactBlock } from '../formatters/artifact-formatter';
import type { RequirementUnderstanding } from '../../../../../src/types/requirement-understanding';

// ─────────────────────────────────────────────────────────────────────────────
// Cache profile — 12 h (same TTL as understanding)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_IMPACT_MAP: CacheConfig = {
    prefix: 'ai:impactmap',
    ttlSeconds: 12 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types (backend-local)
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateImpactMapRequest {
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
    /** Project Technical Blueprint — architectural baseline from project creation */
    projectTechnicalBlueprint?: Record<string, unknown>;
    /** Skip cache for testing */
    testMode?: boolean;
}

export interface GenerateImpactMapResponse {
    summary: string;
    impacts: Array<{
        layer: string;
        action: string;
        components: string[];
        reason: string;
        confidence: number;
    }>;
    overallConfidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for server-side validation of LLM output
// ─────────────────────────────────────────────────────────────────────────────

const ImpactLayerEnum = z.enum([
    'frontend', 'logic', 'data', 'integration',
    'automation', 'configuration', 'ai_pipeline',
]);

const ImpactActionEnum = z.enum([
    'read', 'modify', 'create', 'configure',
]);

const LLMOutputSchema = z.object({
    summary: z.string().min(20).max(1000),
    impacts: z.array(z.object({
        layer: ImpactLayerEnum,
        action: ImpactActionEnum,
        components: z.array(z.string().min(1).max(200)).min(1).max(10),
        reason: z.string().min(10).max(500),
        confidence: z.number().min(0).max(1),
    })).min(1).max(15),
    overallConfidence: z.number().min(0).max(1),
});

// formatUnderstandingBlock and formatProjectBlueprintBlock → shared formatArtifactBlock from formatters/artifact-formatter

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a structured Impact Map from a requirement description.
 *
 * @param request - Sanitized description + optional tech/project/understanding context
 * @returns Validated ImpactMap artifact (without metadata — caller adds it)
 */
export async function generateImpactMap(
    request: GenerateImpactMapRequest
): Promise<GenerateImpactMapResponse> {
    const { description, techCategory, projectContext, requirementUnderstanding, projectTechnicalBlueprint, testMode } = request;

    console.log('[generate-impact-map] Starting, description length:', description.length);

    // ── 1. Cache lookup ─────────────────────────────────────────────
    const cacheKeyParts = [
        description.slice(0, 300),
        techCategory ?? '',
        requirementUnderstanding ? 'ru:1' : 'ru:0',
        projectTechnicalBlueprint ? 'ptb:1' : 'ptb:0',
    ];

    if (!testMode) {
        const cacheKey = buildCacheKey(cacheKeyParts, CACHE_IMPACT_MAP);
        const cached = await getCachedResponse<GenerateImpactMapResponse>(
            cacheKey,
            CACHE_IMPACT_MAP,
        );
        if (cached) {
            console.log('[generate-impact-map] Cache hit');
            return cached;
        }
    }

    // ── 2. Build prompts ────────────────────────────────────────────
    const systemPrompt =
        (await getPrompt('impact_map')) ?? IMPACT_MAP_SYSTEM_PROMPT;

    const userPromptParts: string[] = [
        `DESCRIZIONE DEL REQUISITO:\n${description}`,
    ];

    // Inject understanding block (if available) before tech context
    const understandingBlock = formatArtifactBlock(
        requirementUnderstanding as Record<string, unknown>,
        'COMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall\'utente)',
    );
    if (understandingBlock) {
        userPromptParts.push(understandingBlock);
    }

    // Inject project technical blueprint (if available)
    const blueprintBlock = formatProjectTechnicalBlueprintBlock(projectTechnicalBlueprint, {
        instruction: 'Distingui gli impatti relativi al NUOVO requisito dai componenti già esistenti nel progetto. Segnala solo ciò che il requisito aggiunge o modifica.',
    });
    if (blueprintBlock) {
        userPromptParts.push(blueprintBlock);
    }

    if (techCategory) {
        userPromptParts.push(`\nCATEGORIA TECNOLOGICA: ${techCategory}`);
    }
    if (projectContext) {
        userPromptParts.push(formatProjectContextBlock(projectContext));
    }

    const userPrompt = userPromptParts.join('\n');
    const responseSchema = createImpactMapResponseSchema();

    // ── 3. LLM call ─────────────────────────────────────────────────
    const llmStart = Date.now();

    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: responseSchema as any,
        systemPrompt,
        userPrompt,
        options: 'complex',
    });

    const llmMs = Date.now() - llmStart;
    console.log('[generate-impact-map] LLM completed in', llmMs, 'ms');

    if (!responseContent) {
        throw new Error('No response from LLM for impact map generation');
    }

    // ── 4. Parse + validate ─────────────────────────────────────────
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseContent);
    } catch {
        console.error('[generate-impact-map] Invalid JSON from LLM');
        throw new Error('LLM returned invalid JSON for impact map generation');
    }

    const validation = LLMOutputSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('[generate-impact-map] Validation failed:', validation.error.issues);
        throw new Error('LLM output failed schema validation for impact map generation');
    }

    const result = validation.data;

    // ── 5. Cache store ──────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey(cacheKeyParts, CACHE_IMPACT_MAP);
        await setCachedResponse(cacheKey, result, CACHE_IMPACT_MAP);
    }

    console.log(
        '[generate-impact-map] Success, overallConfidence:',
        result.overallConfidence,
        'impacts:',
        result.impacts.length,
    );

    return result;
}
