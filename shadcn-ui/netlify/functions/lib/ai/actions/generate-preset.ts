/**
 * Preset Generation Action
 * 
 * This module handles the logic for generating technology presets
 * based on user's description, answers, and activity catalog.
 */

import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
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

interface Activity {
    code: string;
    name: string;
    description?: string;
    group: string;
    base_hours: number;
    tech_category: string;
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
 * Load activities from Supabase
 */
async function loadActivities(
    supabase: SupabaseClient,
    techCategory?: string
): Promise<Activity[]> {
    console.log('[generate-preset] Loading activities, techCategory:', techCategory);

    console.log('[generate-preset] Supabase URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('[generate-preset] Supabase Key:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

    // First, try to get all columns to see what's available (no filters)
    const { data: testData, error: testError } = await supabase
        .from('activities')
        .select('*')
        .limit(5);

    console.log('[generate-preset] Test query result:', {
        hasData: !!testData,
        dataLength: testData?.length,
        testError: testError?.message,
        columns: testData?.[0] ? Object.keys(testData[0]) : [],
        firstRow: testData?.[0],
        activeValues: testData?.map(d => d.active)
    });

    // Query without active filter to see all records
    let query = supabase
        .from('activities')
        .select('*');

    // Optionally filter by tech category
    if (techCategory && techCategory !== 'MULTI') {
        query = query.or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`);
    }

    const { data, error } = await query; console.log('[generate-preset] Query result:', {
        dataCount: data?.length,
        error: error?.message,
        firstActivity: data?.[0]
    });

    if (error) {
        console.error('[generate-preset] Failed to load activities:', error);
        throw new Error('Failed to load activity catalog');
    }

    if (!data || data.length === 0) {
        throw new Error('No activities found in catalog');
    }

    return data;
}

/**
 * Validate generated preset structure
 */
function validatePreset(preset: any, validActivityCodes: string[]): { valid: boolean; error?: string } {
    if (!preset) {
        return { valid: false, error: 'Preset is null or undefined' };
    }

    // Check required fields
    const requiredFields = ['name', 'description', 'techCategory', 'activities', 'driverValues', 'riskCodes', 'reasoning', 'confidence'];
    for (const field of requiredFields) {
        if (!(field in preset)) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }

    // Validate activities
    if (!Array.isArray(preset.activities) || preset.activities.length < 3) {
        return { valid: false, error: 'Must have at least 3 activities' };
    }

    if (preset.activities.length > 20) {
        return { valid: false, error: 'Too many activities (max 20)' };
    }

    // Check all activity codes are valid
    const invalidCodes = preset.activities
        .map((a: any) => a.code)
        .filter((code: string) => !validActivityCodes.includes(code));

    if (invalidCodes.length > 0) {
        return {
            valid: false,
            error: `Invalid activity codes: ${invalidCodes.join(', ')}`
        };
    }

    // Validate confidence scores
    for (const activity of preset.activities) {
        if (typeof activity.confidence !== 'number' || activity.confidence < 0 || activity.confidence > 1) {
            return {
                valid: false,
                error: `Invalid confidence for ${activity.code}: ${activity.confidence}`
            };
        }

        if (!['core', 'recommended', 'optional'].includes(activity.priority)) {
            return {
                valid: false,
                error: `Invalid priority for ${activity.code}: ${activity.priority}`
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
 * Calculate metadata from preset
 */
function calculateMetadata(preset: any, generationTimeMs: number): any {
    const grouped = preset.activities.reduce((acc: any, act: any) => {
        acc[act.priority] = (acc[act.priority] || 0) + 1;
        return acc;
    }, {});

    const estimatedDays = preset.activities.reduce(
        (sum: number, act: any) => sum + ((act.baseHours || 0) / 8),
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
 * Generate technology preset using OpenAI
 */
export async function generatePreset(
    input: GeneratePresetInput,
    openaiClient: OpenAI,
    supabaseClient: SupabaseClient
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

        // 2. Load activity catalog
        console.log('[generate-preset] Loading activities...');
        const activities = await loadActivities(supabaseClient, input.suggestedTechCategory);
        console.log(`[generate-preset] Loaded ${activities.length} activities`);

        const validActivityCodes = activities.map(a => a.code);

        // 3. Build enriched prompt
        const activitiesForPrompt = activities.map(a => ({
            code: a.code,
            name: a.name,
            description: a.description,
            group: a.group,
            baseDays: a.base_hours / 8,
            techCategory: a.tech_category
        }));

        const userPrompt = buildPresetGenerationPrompt(
            sanitizedDescription,
            input.answers,
            activitiesForPrompt
        );

        console.log('[generate-preset] Calling OpenAI for preset generation...');
        console.log('[generate-preset] Prompt length:', userPrompt.length);

        // 4. Call OpenAI with structured output
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

        // 5. Parse response
        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error('Empty response from OpenAI');
        }

        const aiResponse: PresetGenerationResponse = JSON.parse(responseContent);

        // 6. Validate response
        if (!aiResponse.success || !aiResponse.preset) {
            console.warn('[generate-preset] AI marked success=false:', aiResponse.error);
            return {
                success: false,
                error: aiResponse.error || 'Failed to generate preset'
            };
        }

        // 7. Post-validation
        const validation = validatePreset(aiResponse.preset, validActivityCodes);
        if (!validation.valid) {
            console.error('[generate-preset] Validation failed:', validation.error);
            return {
                success: false,
                error: `Preset validation failed: ${validation.error}`
            };
        }

        // 8. Calculate metadata
        const metadata = calculateMetadata(aiResponse.preset, duration);

        // 9. Success - return validated preset
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
