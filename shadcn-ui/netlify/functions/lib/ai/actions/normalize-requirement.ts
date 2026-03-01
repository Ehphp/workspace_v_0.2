import { getDefaultProvider } from '../openai-client';
import { createNormalizationSchema, createNormalizationSystemPrompt } from '../prompt-builder';
import { getPrompt } from '../prompt-registry';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
    CACHE_NORMALIZE,
} from '../ai-cache';

export interface NormalizeRequirementRequest {
    description: string;
    testMode?: boolean;
}

export interface NormalizeRequirementResponse {
    isValidRequirement: boolean;
    confidence: number;
    originalDescription: string;
    normalizedDescription: string;
    validationIssues: string[];
    transformNotes: string[];
    generatedTitle?: string;
}

/**
 * Normalize and validate a requirement description
 * @param request - Request with description and optional test mode
 * @returns Normalized requirement with validation details
 */
export async function normalizeRequirement(
    request: NormalizeRequirementRequest
): Promise<NormalizeRequirementResponse> {
    const { description, testMode } = request;

    console.log('Normalizing requirement:', description.substring(0, 100));

    // ── Cache lookup (skip in testMode) ─────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey([description.slice(0, 200)], CACHE_NORMALIZE);
        const cached = await getCachedResponse<NormalizeRequirementResponse>(cacheKey, CACHE_NORMALIZE);
        if (cached) return cached;
    }

    const systemPrompt = await getPrompt('normalization') ?? createNormalizationSystemPrompt();
    const userPrompt = description.substring(0, 2000);
    const responseSchema = createNormalizationSchema();

    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2, // Low temperature for consistency
        maxTokens: 1000,
        responseFormat: responseSchema as any,
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
    });

    if (!responseContent) {
        throw new Error('No response from LLM for normalization');
    }

    const result = JSON.parse(responseContent);

    // ── Cache store (skip in testMode) ───────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey([description.slice(0, 200)], CACHE_NORMALIZE);
        await setCachedResponse(cacheKey, result, CACHE_NORMALIZE);
    }

    return result;
}
