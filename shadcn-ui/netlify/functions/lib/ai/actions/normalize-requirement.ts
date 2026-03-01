import { getDefaultProvider } from '../openai-client';
import { createNormalizationSchema, createNormalizationSystemPrompt } from '../prompt-builder';
import { getPrompt } from '../prompt-registry';

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

    return result;
}
