import { getOpenAIClient } from '../openai-client';
import { getCachedResponse, setCachedResponse } from '../ai-cache';
import { createNormalizationSchema, createNormalizationSystemPrompt } from '../prompt-builder';

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

    // Check cache first (skip in test mode)
    const cacheKey = `normalize:${description.substring(0, 200)}`;
    if (!testMode) {
        const cached = getCachedResponse(cacheKey);
        if (cached) {
            console.log('Using cached normalization');
            return cached;
        }
    }

    const systemPrompt = createNormalizationSystemPrompt();
    const userPrompt = description.substring(0, 2000);
    const responseSchema = createNormalizationSchema();

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        response_format: responseSchema,
        temperature: 0.2, // Low temperature for consistency
        max_tokens: 1000,
    });

    const parsedContent = completion.choices[0]?.message?.content;
    if (!parsedContent) {
        throw new Error('No response from OpenAI for normalization');
    }

    const result = JSON.parse(parsedContent);

    // Cache the result (skip in test mode)
    if (!testMode) {
        setCachedResponse(cacheKey, result);
    }

    return result;
}
