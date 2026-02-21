export interface Activity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
}

export interface Driver {
    code: string;
    options?: Array<{ multiplier: number }>;
}

export interface Risk {
    code: string;
    weight: number;
}

/**
 * Create descriptive prompt with full activity details
 * This provides GPT with complete context to make accurate suggestions
 * @param activities - Array of activities
 * @returns Formatted string with activity details
 */
export function createDescriptivePrompt(activities: Activity[]): string {
    // Format: CODE: Name | Description | Effort | Group
    const activitiesStr = activities.map(a =>
        `CODE: ${a.code}\n` +
        `NAME: ${a.name}\n` +
        `DESCRIPTION: ${a.description}\n` +
        `EFFORT: ${(a.base_hours / 8).toFixed(1)} days (${a.base_hours}h) | GROUP: ${a.group}\n` +
        `---`
    ).join('\n\n');

    return `AVAILABLE ACTIVITIES:\n\n${activitiesStr}`;
}

/**
 * Create JSON schema with strict validation for structured outputs
 * This ensures GPT can ONLY return valid activity codes (no invented codes possible)
 * @param validActivityCodes - Array of valid activity codes
 * @returns JSON schema object for OpenAI structured outputs
 */
export function createActivitySchema(validActivityCodes: string[]) {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "activity_suggestion_response",
            strict: true,  // CRITICAL: Enforces strict schema adherence by OpenAI
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: {
                        type: "boolean",
                        description: "Whether the requirement description is valid and estimable"
                    },
                    activityCodes: {
                        type: "array",
                        description: "Array of relevant activity codes for this requirement",
                        items: {
                            type: "string",
                            enum: validActivityCodes  //  GPT can ONLY return codes from this list
                        }
                    },
                    reasoning: {
                        type: "string",
                        description: "Brief explanation of the activity selection (max 500 characters)"
                    },
                    generatedTitle: {
                        type: "string",
                        description: "Concise title for the requirement (3-8 words, same language as input)"
                    }
                },
                required: ["isValidRequirement", "activityCodes", "reasoning", "generatedTitle"],
                additionalProperties: false  //  No extra fields allowed
            }
        }
    };
}

/**
 * Create normalization JSON schema for structured outputs
 * @returns JSON schema object for requirement normalization
 */
export function createNormalizationSchema() {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "normalization_response",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: { type: "boolean" },
                    confidence: { type: "number" },
                    originalDescription: { type: "string" },
                    normalizedDescription: { type: "string" },
                    validationIssues: {
                        type: "array",
                        items: { type: "string" }
                    },
                    transformNotes: {
                        type: "array",
                        items: { type: "string" }
                    },
                    generatedTitle: { type: "string" }
                },
                required: ["isValidRequirement", "confidence", "originalDescription", "normalizedDescription", "validationIssues", "transformNotes", "generatedTitle"],
                additionalProperties: false
            }
        }
    };
}

import { createActivitySuggestionPrompt as createActivitySuggestionPromptIT } from './prompt-templates';

/**
 * Create system prompt for activity suggestions (Italian)
 * @param presetName - Preset name
 * @param techCategory - Technology category
 * @param descriptiveData - Formatted activity data
 * @returns System prompt string in Italian
 */
export function createActivitySuggestionSystemPrompt(
    presetName: string,
    techCategory: string,
    descriptiveData: string
): string {
    return createActivitySuggestionPromptIT(presetName, techCategory, descriptiveData);
}

import { NORMALIZATION_PROMPT } from './prompt-templates';

/**
 * Create system prompt for requirement normalization (Italian)
 * @returns System prompt string in Italian
 */
export function createNormalizationSystemPrompt(): string {
    return NORMALIZATION_PROMPT;
}

/**
 * Legacy compact function (kept for reference - can be removed later)
 * @param activities - Array of activities
 * @param drivers - Array of drivers
 * @param risks - Array of risks
 * @returns Compact prompt string
 */
export function createCompactPrompt(activities: Activity[], drivers: Driver[], risks: Risk[]): string {
    const activitiesStr = activities.map(a => `${a.code}(${(a.base_hours / 8).toFixed(1)}d,${a.group})`).join(', ');
    const driversStr = drivers.map(d => {
        if (!d.options || !Array.isArray(d.options) || d.options.length === 0) {
            return `${d.code}(1.0)`;
        }
        const multipliers = d.options.map((o: any) => o.multiplier).filter((m: any) => typeof m === 'number');
        if (multipliers.length === 0) {
            return `${d.code}(1.0)`;
        }
        const minMax = `${Math.min(...multipliers)}-${Math.max(...multipliers)}`;
        return `${d.code}(${minMax})`;
    }).join(', ');
    const risksStr = risks.map(r => `${r.code}(${r.weight})`).join(', ');

    return `Activities: ${activitiesStr}\nDrivers: ${driversStr}\nRisks: ${risksStr}`;
}
