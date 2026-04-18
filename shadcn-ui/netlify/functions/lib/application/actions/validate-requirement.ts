/**
 * AI Action: Validate Requirement (Lightweight Gate)
 *
 * A fast, cheap LLM call (~100 tokens) that determines whether an input
 * text is a legitimate software requirement before the expensive
 * Understanding → ImpactMap → Blueprint → Estimation pipeline runs.
 *
 * Uses gpt-4o-mini with temperature 0 for deterministic classification.
 */

import { z } from 'zod';
import { getDefaultProvider } from '../../infrastructure/llm/openai-client';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
} from '../../infrastructure/cache/ai-cache';
import type { CacheConfig } from '../../infrastructure/cache/ai-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Cache profile — 24 h (validation is deterministic, safe to cache longer)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VALIDATE: CacheConfig = {
    prefix: 'ai:validate-req',
    ttlSeconds: 24 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidateRequirementRequest {
    /** Sanitized requirement description */
    description: string;
    /** Skip cache for testing */
    testMode?: boolean;
}

export interface ValidateRequirementResponse {
    isValid: boolean;
    confidence: number;
    reason: string;
    category: 'valid' | 'nonsense' | 'too_vague' | 'not_software' | 'off_topic';
    suggestions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for LLM output validation
// ─────────────────────────────────────────────────────────────────────────────

const LLMOutputSchema = z.object({
    isValid: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(500),
    category: z.enum(['valid', 'nonsense', 'too_vague', 'not_software', 'off_topic']),
    suggestions: z.array(z.string().max(200)).max(3).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un filtro di qualità per requisiti software in un sistema di stima effort.

**IL TUO COMPITO**: Determinare se l'input dell'utente descrive un requisito software reale e stimabile.

**CLASSIFICA IN UNA DI QUESTE CATEGORIE**:
- "valid": è un requisito software comprensibile e stimabile (anche se generico)
- "nonsense": testo senza senso, test, placeholder, frasi casuali, parole inventate
- "too_vague": contiene un concetto software ma è troppo generico per essere un requisito (es. solo "login", "database")
- "not_software": descrive qualcosa di reale ma non è un requisito software (es. ricetta, articolo, poesia)
- "off_topic": completamente fuori contesto per uno strumento di stima software

**REGOLE**:
1. Rispondi SEMPRE con JSON valido secondo lo schema
2. Scrivi "reason" nella STESSA LINGUA dell'input
3. Sii generoso: se c'è un minimo intent software, classifica come "valid" o "too_vague"
4. "suggestions" è opzionale — forniscilo solo per "too_vague" (max 3 suggerimenti brevi)
5. "confidence" deve riflettere quanto sei sicuro della classificazione (0.0-1.0)

**SCHEMA OUTPUT**: { "isValid": bool, "confidence": 0.0-1.0, "reason": "string", "category": "valid|nonsense|too_vague|not_software|off_topic", "suggestions": ["string"] }`;

// OpenAI response_format for structured output
const RESPONSE_SCHEMA = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'requirement_validation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                isValid: { type: 'boolean' },
                confidence: { type: 'number' },
                reason: { type: 'string' },
                category: { type: 'string', enum: ['valid', 'nonsense', 'too_vague', 'not_software', 'off_topic'] },
                suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
            required: ['isValid', 'confidence', 'reason', 'category', 'suggestions'],
            additionalProperties: false,
        },
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main action
// ─────────────────────────────────────────────────────────────────────────────

export async function validateRequirement(
    request: ValidateRequirementRequest
): Promise<ValidateRequirementResponse> {
    const { description, testMode } = request;

    console.log('[validate-requirement] Input:', description.substring(0, 80));

    // ── Cache lookup ────────────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey([description.slice(0, 200)], CACHE_VALIDATE);
        const cached = await getCachedResponse<ValidateRequirementResponse>(cacheKey, CACHE_VALIDATE);
        if (cached) {
            console.log('[validate-requirement] Cache hit');
            return cached;
        }
    }

    // ── LLM call ────────────────────────────────────────────────────────
    const provider = getDefaultProvider();
    const responseContent = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 200,
        responseFormat: RESPONSE_SCHEMA as any,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: description.substring(0, 2000),
    });

    if (!responseContent) {
        throw new Error('No response from LLM for requirement validation');
    }

    const raw = JSON.parse(responseContent);
    const validated = LLMOutputSchema.parse(raw);

    const result: ValidateRequirementResponse = {
        isValid: validated.isValid,
        confidence: validated.confidence,
        reason: validated.reason,
        category: validated.category,
        suggestions: validated.suggestions?.length ? validated.suggestions : undefined,
    };

    // ── Cache store ─────────────────────────────────────────────────────
    if (!testMode) {
        const cacheKey = buildCacheKey([description.slice(0, 200)], CACHE_VALIDATE);
        await setCachedResponse(cacheKey, result, CACHE_VALIDATE);
    }

    console.log(`[validate-requirement] Result: ${result.category} (confidence: ${result.confidence})`);
    return result;
}
