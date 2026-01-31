/**
 * Preset Generation Action
 * 
 * This module handles the logic for generating technology presets
 * using AI-generated custom activities (no catalog needed).
 */

import OpenAI from 'openai';
import {
    PRESET_GENERATION_SYSTEM_PROMPT,
    buildPresetGenerationPrompt,
    createPresetGenerationSchema
} from '../prompts/preset-generation';
import { sanitizePromptInput } from '../../../../../src/types/ai-validation';

interface GeneratePresetInput {
    description: string;
    answers: Record<string, any>;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
    userId: string;
}

interface PresetGenerationResponse {
    success: boolean;
    preset?: any;
    error?: string;
    metadata?: {
        totalActivities: number;
        coreActivities: number;
        recommendedActivities: number;
        optionalActivities: number;
        estimatedDays: number;
        generationTimeMs: number;
    };
}

/**
 * Validate generated preset structure (for custom activities)
 */
function validatePreset(preset: any): { valid: boolean; error?: string } {
    if (!preset) {
        return { valid: false, error: 'Preset is null or undefined' };
    }

    // Check required fields
    const requiredFields = ['name', 'description', 'detailedDescription', 'techCategory', 'activities', 'driverValues', 'riskCodes', 'reasoning', 'confidence'];
    for (const field of requiredFields) {
        if (!(field in preset)) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }

    // Validate activities
    if (!Array.isArray(preset.activities) || preset.activities.length < 5) {
        return { valid: false, error: 'Must have at least 5 activities' };
    }

    if (preset.activities.length > 20) {
        return { valid: false, error: 'Too many activities (max 20)' };
    }

    // Check all activities have required fields (custom generated activities)
    for (const activity of preset.activities) {
        // Required fields for custom activities
        if (!activity.title || typeof activity.title !== 'string') {
            return { valid: false, error: 'Activity missing title' };
        }

        if (!activity.description || typeof activity.description !== 'string') {
            return { valid: false, error: `Activity ${activity.title} missing description` };
        }

        if (!activity.group || !['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'].includes(activity.group)) {
            return { valid: false, error: `Invalid group for ${activity.title}: ${activity.group}` };
        }

        if (typeof activity.estimatedHours !== 'number' || activity.estimatedHours < 1 || activity.estimatedHours > 320) {
            return { valid: false, error: `Invalid estimatedHours for ${activity.title}: ${activity.estimatedHours}` };
        }

        if (typeof activity.confidence !== 'number' || activity.confidence < 0 || activity.confidence > 1) {
            return {
                valid: false,
                error: `Invalid confidence for ${activity.title}: ${activity.confidence}`
            };
        }

        if (!['core', 'recommended', 'optional'].includes(activity.priority)) {
            return {
                valid: false,
                error: `Invalid priority for ${activity.title}: ${activity.priority}`
            };
        }
    }

    // Validate overall confidence
    if (typeof preset.confidence !== 'number' || preset.confidence < 0 || preset.confidence > 1) {
        return { valid: false, error: `Invalid overall confidence: ${preset.confidence}` };
    }

    return { valid: true };
}

/**
 * Calculate metadata from preset (with custom activities)
 */
function calculateMetadata(preset: any, generationTimeMs: number): any {
    const grouped = preset.activities.reduce((acc: any, act: any) => {
        acc[act.priority] = (acc[act.priority] || 0) + 1;
        return acc;
    }, {});

    const estimatedDays = preset.activities.reduce(
        (sum: number, act: any) => sum + ((act.estimatedHours || 0) / 8),
        0
    );

    return {
        totalActivities: preset.activities.length,
        coreActivities: grouped.core || 0,
        recommendedActivities: grouped.recommended || 0,
        optionalActivities: grouped.optional || 0,
        estimatedDays: Math.round(estimatedDays * 10) / 10,
        generationTimeMs
    };
}

/**
 * Generate technology preset using OpenAI (with custom generated activities)
 */
export async function generatePreset(
    input: GeneratePresetInput,
    openaiClient: OpenAI
): Promise<PresetGenerationResponse> {
    const startTime = Date.now();

    try {
        // 1. Sanitize description (answers already validated)
        const sanitizedDescription = sanitizePromptInput(input.description);

        if (!sanitizedDescription || sanitizedDescription.length < 20) {
            return {
                success: false,
                error: 'Description too short or invalid'
            };
        }

        // 2. Build enriched prompt (no catalog needed)
        const userPrompt = buildPresetGenerationPrompt(
            sanitizedDescription,
            input.answers,
            input.suggestedTechCategory
        );

        console.log('[generate-preset] Calling OpenAI for preset generation...');
        console.log('[generate-preset] Prompt length:', userPrompt.length);

        // 3. Call OpenAI with structured output
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2, // Low temperature for consistency
            max_tokens: 4000, // Allow for detailed response
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: PRESET_GENERATION_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        });

        const duration = Date.now() - startTime;
        console.log(`[generate-preset] OpenAI call completed in ${duration}ms`);

        // 4. Parse response
        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error('Empty response from OpenAI');
        }

        const aiResponse: PresetGenerationResponse = JSON.parse(responseContent);

        // 5. Validate response
        if (!aiResponse.success || !aiResponse.preset) {
            console.warn('[generate-preset] AI marked success=false:', aiResponse.error);
            return {
                success: false,
                error: aiResponse.error || 'Failed to generate preset'
            };
        }

        // 6. Post-validation (no code validation needed - custom activities)
        const validation = validatePreset(aiResponse.preset);
        if (!validation.valid) {
            console.error('[generate-preset] Validation failed:', validation.error);
            return {
                success: false,
                error: `Preset validation failed: ${validation.error}`
            };
        }

        // 7. Calculate metadata
        const metadata = calculateMetadata(aiResponse.preset, duration);

        // 8. Success - return validated preset
        console.log('[generate-preset] Successfully generated preset:', {
            name: aiResponse.preset.name,
            activities: metadata.totalActivities,
            estimatedDays: metadata.estimatedDays,
            confidence: aiResponse.preset.confidence
        });

        return {
            success: true,
            preset: aiResponse.preset,
            metadata
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[generate-preset] Error after', duration, 'ms:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during preset generation'
        };
    }
}
