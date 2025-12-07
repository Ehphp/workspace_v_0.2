/**
 * Type Definitions for AI Preset Generation
 * 
 * Defines types for the Stage 2 of AI wizard: preset generation from answers.
 */

import { z } from 'zod';

/**
 * Activity with confidence and priority
 */
export interface SuggestedActivity {
    code: string;
    name: string;
    description?: string;
    group: string; // ANALYSIS, DEV, TEST, OPS, GOVERNANCE
    baseDays: number;
    confidence: number; // 0.0 to 1.0
    priority: 'core' | 'recommended' | 'optional';
    reasoning?: string; // Why this activity was selected
}

/**
 * Driver suggestion
 */
export interface SuggestedDriver {
    code: string;
    value: string;
    reasoning?: string;
}

/**
 * Risk suggestion
 */
export interface SuggestedRisk {
    code: string;
    reasoning?: string;
}

/**
 * Generated Technology Preset (from AI)
 */
export interface GeneratedPreset {
    name: string;
    description: string; // Short summary (1-2 sentences)
    detailedDescription: string; // Detailed technical description (200-500 words)
    techCategory: 'FRONTEND' | 'BACKEND' | 'MULTI';
    activities: SuggestedActivity[];
    driverValues: Record<string, string>; // { COMPLEXITY: "HIGH", ... }
    riskCodes: string[];
    suggestedDrivers?: SuggestedDriver[];
    suggestedRisks?: SuggestedRisk[];
    reasoning: string; // Overall explanation of preset composition
    confidence: number; // 0.0 to 1.0 - overall confidence in this preset
}

/**
 * Preset Generation Response (from backend)
 */
export interface PresetGenerationResponse {
    success: boolean;
    preset?: GeneratedPreset;
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
 * Preset Generation Request (to backend)
 */
export interface PresetGenerationRequest {
    description: string;
    answers: Record<string, string | string[] | number>;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
}

/**
 * Zod Schemas for Validation
 */

export const SuggestedActivitySchema = z.object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    group: z.enum(['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE']),
    baseDays: z.number().min(0),
    confidence: z.number().min(0).max(1),
    priority: z.enum(['core', 'recommended', 'optional']),
    reasoning: z.string().optional(),
});

export const SuggestedDriverSchema = z.object({
    code: z.string(),
    value: z.string(),
    reasoning: z.string().optional(),
});

export const SuggestedRiskSchema = z.object({
    code: z.string(),
    reasoning: z.string().optional(),
});

export const GeneratedPresetSchema = z.object({
    name: z.string().min(3).max(255),
    description: z.string().min(10).max(500), // Short summary
    detailedDescription: z.string().min(100).max(2000), // Detailed technical description
    techCategory: z.enum(['FRONTEND', 'BACKEND', 'MULTI']),
    activities: z.array(SuggestedActivitySchema).min(3),
    driverValues: z.record(z.string()),
    riskCodes: z.array(z.string()),
    suggestedDrivers: z.array(SuggestedDriverSchema).optional(),
    suggestedRisks: z.array(SuggestedRiskSchema).optional(),
    reasoning: z.string().min(20).max(1000),
    confidence: z.number().min(0).max(1),
});

export const PresetGenerationResponseSchema = z.object({
    success: z.boolean(),
    preset: GeneratedPresetSchema.optional(),
    error: z.string().optional(),
    metadata: z.object({
        totalActivities: z.number(),
        coreActivities: z.number(),
        recommendedActivities: z.number(),
        optionalActivities: z.number(),
        estimatedDays: z.number(),
        generationTimeMs: z.number(),
    }).optional(),
});

/**
 * Helper to calculate total estimated days
 */
export function calculateEstimatedDays(activities: SuggestedActivity[]): number {
    return activities.reduce((sum, activity) => sum + activity.baseDays, 0);
}

/**
 * Helper to group activities by priority
 */
export function groupActivitiesByPriority(activities: SuggestedActivity[]): {
    core: SuggestedActivity[];
    recommended: SuggestedActivity[];
    optional: SuggestedActivity[];
} {
    return {
        core: activities.filter(a => a.priority === 'core'),
        recommended: activities.filter(a => a.priority === 'recommended'),
        optional: activities.filter(a => a.priority === 'optional'),
    };
}

/**
 * Helper to group activities by group
 */
export function groupActivitiesByGroup(activities: SuggestedActivity[]): Record<string, SuggestedActivity[]> {
    const grouped: Record<string, SuggestedActivity[]> = {};
    activities.forEach(activity => {
        if (!grouped[activity.group]) {
            grouped[activity.group] = [];
        }
        grouped[activity.group].push(activity);
    });
    return grouped;
}

/**
 * Helper to filter activities by confidence threshold
 */
export function filterByConfidence(
    activities: SuggestedActivity[],
    minConfidence: number = 0.5
): SuggestedActivity[] {
    return activities.filter(a => a.confidence >= minConfidence);
}
