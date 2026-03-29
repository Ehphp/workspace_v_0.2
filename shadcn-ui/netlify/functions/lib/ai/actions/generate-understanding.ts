/**
 * AI Action: Generate Requirement Understanding
 *
 * Produces a structured Requirement Understanding artifact from a raw
 * requirement description using gpt-4o-mini.
 *
 * Follows the same pattern as normalize-requirement.ts:
 *   1. Cache lookup (skip in testMode)
 *   2. Build prompt (system + user)
 *   3. LLM call with strict JSON schema
 *   4. Validate output
 *   5. Cache store
 *   6. Return typed result
 */

import { z } from 'zod';
import { getDefaultProvider } from '../openai-client';
import { getPrompt } from '../prompt-registry';
import {
    UNDERSTANDING_SYSTEM_PROMPT,
    createUnderstandingResponseSchema,
} from '../prompts/understanding-generation';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
} from '../ai-cache';
import type { CacheConfig } from '../ai-cache';
import { formatProjectContextBlock } from '../prompt-builder';

// ─────────────────────────────────────────────────────────────────────────────
// Cache profile — 12 h (understanding may evolve with prompt changes)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_UNDERSTANDING: CacheConfig = {
    prefix: 'ai:understand',
    ttlSeconds: 12 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types (backend-local, mirrors frontend types)
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateUnderstandingRequest {
    /** Sanitized requirement description */
    description: string;
    /** Technology category (e.g. POWER_PLATFORM, BACKEND) */
    techCategory?: string;
    /** Project context to reduce assumptions */
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
    /** Skip cache for testing */
    testMode?: boolean;
}

export interface GenerateUnderstandingResponse {
    businessObjective: string;
    expectedOutput: string;
    functionalPerimeter: string[];
    exclusions: string[];
    actors: Array<{ role: string; interaction: string }>;
    stateTransition: { initialState: string; finalState: string };
    preconditions: string[];
    assumptions: string[];
    complexityAssessment: { level: 'LOW' | 'MEDIUM' | 'HIGH'; rationale: string };
    confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for server-side validation of LLM output
// ─────────────────────────────────────────────────────────────────────────────

const LLMOutputSchema = z.object({
    businessObjective: z.string().min(1),
    expectedOutput: z.string().min(1),
    functionalPerimeter: z.array(z.string().min(1)).min(1).max(8),
    exclusions: z.array(z.string().min(1)).max(5),
    actors: z.array(z.object({
        role: z.string().min(1),
        interaction: z.string().min(1),
    })).min(1).max(5),
    stateTransition: z.object({
        initialState: z.string().min(1),
        finalState: z.string().min(1),
    }),
    preconditions: z.array(z.string().min(1)).max(5),
    assumptions: z.array(z.string().min(1)).max(5),
    complexityAssessment: z.object({
        level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        rationale: z.string().min(1),
    }),
    confidence: z.number().min(0).max(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a structured Requirement Understanding from a requirement description.
 *
 * @param request - Sanitized description + optional tech/project context
 * @returns Validated RequirementUnderstanding artifact (without metadata — caller adds it)
 */
export async function generateRequirementUnderstanding(
    request: GenerateUnderstandingRequest
): Promise<GenerateUnderstandingResponse> {
    const { description, techCategory, projectContext, testMode } = request;

    console.log('[generate-understanding] Starting, description length:', description.length);

    // ── 1. Cache lookup ─────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey(
            [description.slice(0, 300), techCategory ?? ''],
            CACHE_UNDERSTANDING,
        );
        const cached = await getCachedResponse<GenerateUnderstandingResponse>(
            cacheKey,
            CACHE_UNDERSTANDING,
        );
        if (cached) {
            console.log('[generate-understanding] Cache hit');
            return cached;
        }
    }

    // ── 2. Build prompts ────────────────────────────────────────────
    const systemPrompt =
        (await getPrompt('requirement_understanding')) ?? UNDERSTANDING_SYSTEM_PROMPT;

    const userPromptParts: string[] = [
        `DESCRIZIONE DEL REQUISITO:\n${description}`,
    ];
    if (techCategory) {
        userPromptParts.push(`\nCATEGORIA TECNOLOGICA: ${techCategory}`);
    }
    if (projectContext) {
        userPromptParts.push(formatProjectContextBlock(projectContext));
    }
    const userPrompt = userPromptParts.join('\n');

    const responseSchema = createUnderstandingResponseSchema();

    // ── 3. LLM call ─────────────────────────────────────────────────
    const llmStart = Date.now();

    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: responseSchema as any,
        systemPrompt,
        userPrompt,
    });

    const llmMs = Date.now() - llmStart;
    console.log('[generate-understanding] LLM completed in', llmMs, 'ms');

    if (!responseContent) {
        throw new Error('No response from LLM for requirement understanding');
    }

    // ── 4. Parse + validate ─────────────────────────────────────────
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseContent);
    } catch {
        console.error('[generate-understanding] Invalid JSON from LLM');
        throw new Error('LLM returned invalid JSON for requirement understanding');
    }

    const validation = LLMOutputSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('[generate-understanding] Validation failed:', validation.error.issues);
        throw new Error('LLM output failed schema validation for requirement understanding');
    }

    const result = validation.data;

    // ── 5. Cache store ──────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey(
            [description.slice(0, 300), techCategory ?? ''],
            CACHE_UNDERSTANDING,
        );
        await setCachedResponse(cacheKey, result, CACHE_UNDERSTANDING);
    }

    console.log('[generate-understanding] Success, confidence:', result.confidence, 'complexity:', result.complexityAssessment.level);

    return result;
}
