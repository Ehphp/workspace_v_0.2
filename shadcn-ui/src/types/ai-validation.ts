import { z } from 'zod';

/**
 * Schema di validazione per le risposte AI
 * Protegge da injection attacks e dati malformati
 */
export const AIActivitySuggestionSchema = z.object({
    isValidRequirement: z
        .boolean()
        .describe('Whether the requirement description is valid and makes sense'),

    activityCodes: z
        .array(z.string().regex(/^[A-Z0-9_]{3,50}$/, 'Invalid activity code format'))
        .max(50, 'Too many activities suggested'),
    // Allow empty array when GPT can't suggest activities (e.g., description too short)

    reasoning: z
        .string()
        .max(2000, 'Reasoning too long')
        .optional()
});

export type ValidatedAISuggestion = z.infer<typeof AIActivitySuggestionSchema>;

/**
 * Valida e sanitizza una suggestion AI contro i dati master disponibili
 */
export function validateAISuggestion(
    rawData: unknown,
    availableActivityCodes: string[],
    availableDriverCodes: string[],
    availableRiskCodes: string[]
): ValidatedAISuggestion {
    // Step 1: Validate schema structure
    const parsed = AIActivitySuggestionSchema.parse(rawData);

    // Step 2: Cross-validate against available master data
    const validActivityCodes = parsed.activityCodes.filter(code =>
        availableActivityCodes.includes(code)
    );

    // Allow empty array - GPT may legitimately suggest no activities
    // for invalid/insufficient requirements

    // Step 3: Return validated and sanitized data (only activity codes)
    return {
        isValidRequirement: parsed.isValidRequirement,
        activityCodes: validActivityCodes,
        reasoning: parsed.reasoning?.trim()
    };
}

/**
 * Sanitizza input per prevenire injection attacks
 */
export function sanitizePromptInput(text: string): string {
    return text
        .replace(/[<>]/g, '')           // Remove HTML-like tags
        .replace(/[{}]/g, '')            // Remove JSON delimiters
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .slice(0, 5000)                  // Limit length
        .trim();
}

/**
 * Schema per validazione generazione titolo
 */
export const AITitleGenerationSchema = z.object({
    title: z
        .string()
        .min(5, 'Title too short')
        .max(200, 'Title too long')
        .refine(
            (title) => title.split(' ').length <= 20,
            'Title should not exceed 20 words'
        )
});

export type ValidatedAITitle = z.infer<typeof AITitleGenerationSchema>;

/**
 * Valida titolo generato da AI
 */
export function validateAITitle(rawData: unknown): ValidatedAITitle {
    return AITitleGenerationSchema.parse(rawData);
}
