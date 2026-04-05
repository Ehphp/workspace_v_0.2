/**
 * AI Action: Explain Decision
 *
 * Produces a natural-language explanation of the DecisionEngine output
 * using gpt-4o-mini. The LLM does NOT select activities — it only
 * explains WHY the deterministic engine selected them.
 *
 * Pattern:
 *   1. Cache lookup (skip in testMode)
 *   2. Build prompt (system + user)
 *   3. LLM call with strict JSON schema
 *   4. Validate output
 *   5. Cache store
 *   6. Return typed result
 */

import { z } from 'zod';
import { getDefaultProvider } from '../openai-client';
import {
    DECISION_EXPLANATION_SYSTEM_PROMPT,
    buildDecisionExplanationSchema,
    buildDecisionExplanationUserPrompt,
    type DecisionExplanationPromptInput,
} from '../prompts/decision-explanation';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
} from '../ai-cache';
import type { CacheConfig } from '../ai-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Cache profile — 6 h (explanation may change with prompt tuning)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_EXPLANATION: CacheConfig = {
    prefix: 'ai:decision-explain',
    ttlSeconds: 6 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplainDecisionRequest {
    /** Input for prompt building */
    promptInput: DecisionExplanationPromptInput;
    /** Skip cache for testing */
    testMode?: boolean;
}

export interface DecisionExplanation {
    /** Overall reasoning for the selection */
    reasoning: string;
    /** Per-activity explanation */
    activityExplanations: Array<{ code: string; explanation: string }>;
    /** Potential warnings about the selection */
    warnings: string[];
    /** Potential functional gaps */
    gaps: string[];
    /** Suggested effort drivers */
    suggestedDrivers: Array<{ name: string; rationale: string }>;
    /** Suggested risks */
    suggestedRisks: Array<{ name: string; rationale: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for server-side validation of LLM output
// ─────────────────────────────────────────────────────────────────────────────

const LLMOutputSchema = z.object({
    reasoning: z.string().min(1),
    activityExplanations: z.array(z.object({
        code: z.string().min(1),
        explanation: z.string().min(1),
    })).min(1),
    warnings: z.array(z.string()).max(5),
    gaps: z.array(z.string()).max(5),
    suggestedDrivers: z.array(z.object({
        name: z.string().min(1),
        rationale: z.string().min(1),
    })).max(5),
    suggestedRisks: z.array(z.object({
        name: z.string().min(1),
        rationale: z.string().min(1),
    })).max(5),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a natural-language explanation for the DecisionEngine output.
 *
 * The LLM does NOT select activities — it only explains the deterministic
 * selection and suggests drivers/risks.
 */
export async function explainDecision(
    request: ExplainDecisionRequest,
): Promise<DecisionExplanation> {
    const { promptInput, testMode } = request;

    console.log('[explain-decision] Starting, activities:', promptInput.selectedActivities.length);

    // ── 1. Cache lookup ─────────────────────────────────────────────
    const cacheInputKey = [
        promptInput.description.slice(0, 200),
        promptInput.techCategory,
        promptInput.selectedActivities.map(a => a.code).sort().join(','),
    ];

    if (!testMode) {
        const cacheKey = buildCacheKey(cacheInputKey, CACHE_EXPLANATION);
        const cached = await getCachedResponse<DecisionExplanation>(
            cacheKey,
            CACHE_EXPLANATION,
        );
        if (cached) {
            console.log('[explain-decision] Cache hit');
            return cached;
        }
    }

    // ── 2. Build prompts ────────────────────────────────────────────
    const systemPrompt = DECISION_EXPLANATION_SYSTEM_PROMPT;
    const userPrompt = buildDecisionExplanationUserPrompt(promptInput);
    const responseSchema = buildDecisionExplanationSchema();

    // ── 3. LLM call ─────────────────────────────────────────────────
    const llmStart = Date.now();

    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: responseSchema as any,
        systemPrompt,
        userPrompt,
    });

    const llmMs = Date.now() - llmStart;
    console.log('[explain-decision] LLM completed in', llmMs, 'ms');

    if (!responseContent) {
        throw new Error('No response from LLM for decision explanation');
    }

    // ── 4. Parse + validate ─────────────────────────────────────────
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseContent);
    } catch {
        console.error('[explain-decision] Invalid JSON from LLM');
        throw new Error('LLM returned invalid JSON for decision explanation');
    }

    const validation = LLMOutputSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('[explain-decision] Validation failed:', validation.error.issues);
        throw new Error('LLM output failed schema validation for decision explanation');
    }

    const result: DecisionExplanation = validation.data;

    // ── 5. Cache store ──────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey(cacheInputKey, CACHE_EXPLANATION);
        await setCachedResponse(cacheKey, result, CACHE_EXPLANATION);
    }

    console.log(
        '[explain-decision] Success, reasoning length:',
        result.reasoning.length,
        'warnings:', result.warnings.length,
        'gaps:', result.gaps.length,
    );

    return result;
}
