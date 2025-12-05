import { getOpenAIClient } from '../openai-client';
import { getCachedResponse, setCachedResponse, getCacheKey } from '../ai-cache';
import {
    createDescriptivePrompt,
    createActivitySchema,
    createActivitySuggestionSystemPrompt,
    Activity
} from '../prompt-builder';
import { validateAISuggestion } from '../../../../../src/types/ai-validation';
import { validateRequirementDescription } from '../../validation/requirement-validator';

export interface Preset {
    id: string;
    name: string;
    description: string;
    tech_category: string;
    default_activity_codes: string[];
    default_driver_values: Record<string, string>;
    default_risks: string[];
}

export interface SuggestActivitiesRequest {
    description: string;
    preset: Preset;
    activities: Activity[];
    testMode?: boolean;
}

export interface AIActivitySuggestion {
    isValidRequirement: boolean;
    activityCodes: string[];
    reasoning?: string;
}

/**
 * Suggest activities for a requirement
 * @param request - Request with description, preset, and activities
 * @returns AI activity suggestion
 */
export async function suggestActivities(request: SuggestActivitiesRequest): Promise<AIActivitySuggestion> {
    const { description, preset, activities, testMode } = request;

    // Validate requirement description
    const descriptionCheck = validateRequirementDescription(description);
    if (!descriptionCheck.isValid) {
        console.warn('Requirement rejected by deterministic validation:', descriptionCheck.reason);
        return {
            isValidRequirement: false,
            activityCodes: [],
            reasoning: descriptionCheck.reason || 'Requirement description is too vague or looks like test data',
        };
    }

    // Filter activities relevant to the preset's tech category
    const relevantActivities = activities.filter(
        (a) => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
    );

    console.log('Filtered activities:', relevantActivities?.length);

    // Check cache first (skip in test mode)
    const relevantActivityCodes = relevantActivities.map(a => a.code);
    const cacheKey = getCacheKey(description, preset.id, relevantActivityCodes);
    if (!testMode) {
        const cached = getCachedResponse(cacheKey);
        if (cached) {
            console.log('Using cached AI suggestion');
            return cached;
        }
    } else {
        console.log('Test mode: cache disabled');
    }

    // Build DESCRIPTIVE system prompt with full activity details
    console.log('Creating descriptive prompt with full activity details...');
    const descriptiveData = createDescriptivePrompt(relevantActivities);
    console.log('Descriptive prompt created, length:', descriptiveData?.length);

    const systemPrompt = createActivitySuggestionSystemPrompt(
        preset.name,
        preset.tech_category,
        descriptiveData
    );

    const userPrompt = description.substring(0, 1000); // Limit to 1000 chars

    console.log('Calling OpenAI API with structured outputs...');
    console.log('Model: gpt-4o-mini');
    console.log('Test mode:', testMode ? 'enabled (temp=0.7, no cache)' : 'disabled (temp=0.0, cached)');

    // Generate strict JSON schema with enum of valid activity codes
    const responseSchema = createActivitySchema(relevantActivityCodes);
    console.log('Using structured outputs with', relevantActivities.length, 'valid activity codes in enum');

    // Call OpenAI API with structured outputs
    const openai = getOpenAIClient();
    const temperature = testMode ? 0.7 : 0.0;
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        response_format: responseSchema,
        temperature,
        max_tokens: 500,
    });

    console.log('Using temperature:', temperature, '(determinism level:', temperature === 0 ? 'maximum' : 'test mode', ')');
    console.log('OpenAI response received');

    const message = response.choices[0]?.message;
    const parsedContent = message?.content;

    if (!parsedContent) {
        throw new Error('No response from OpenAI');
    }

    // Parse structured output
    let suggestion: any;
    try {
        suggestion = JSON.parse(parsedContent);
    } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from AI');
    }

    console.log('Structured output received and validated by OpenAI');

    // Keep basic Zod validation for extra safety
    const validatedSuggestion = validateAISuggestion(
        suggestion,
        relevantActivityCodes,
        [],
        []
    );

    const finalSuggestion: AIActivitySuggestion = validatedSuggestion.isValidRequirement
        ? validatedSuggestion
        : {
            ...validatedSuggestion,
            activityCodes: [],
            reasoning: validatedSuggestion.reasoning || 'Requirement description is invalid or too vague',
        };

    console.log('Validated suggestion:', JSON.stringify(finalSuggestion, null, 2));

    // Cache the validated result (skip in test mode)
    if (!testMode) {
        setCachedResponse(cacheKey, finalSuggestion);
        console.log('Cached response for future use');
    }

    return finalSuggestion;
}
