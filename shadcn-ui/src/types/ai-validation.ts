import { z } from 'zod';

/**
 * Schema di validazione per le risposte AI
 * Protegge da injection attacks e dati malformati
 */
export const AIActivitySuggestionSchema = z.object({
    activityCodes: z
        .array(z.string().regex(/^[A-Z0-9_]{3,50}$/, 'Invalid activity code format'))
        .min(1, 'At least one activity is required')
        .max(50, 'Too many activities suggested'),

    suggestedDrivers: z
        .record(
            z.string().regex(/^[A-Z_]{3,20}$/, 'Invalid driver code format'),
            z.string().regex(/^[A-Z_]{2,20}$/, 'Invalid driver value format')
        )
        .optional(),

    suggestedRisks: z
        .array(z.string().regex(/^R_[A-Z_]{3,50}$/, 'Invalid risk code format'))
        .max(20, 'Too many risks suggested')
        .optional(),

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

    if (validActivityCodes.length === 0) {
        throw new Error('No valid activity codes in AI suggestion');
    }

    // Step 3: Validate and filter drivers
    const validDrivers: Record<string, string> = {};
    if (parsed.suggestedDrivers) {
        for (const [code, value] of Object.entries(parsed.suggestedDrivers)) {
            if (availableDriverCodes.includes(code)) {
                validDrivers[code] = value;
            } else {
                console.warn(`Invalid driver code suggested by AI: ${code}`);
            }
        }
    }

    // Step 4: Validate and filter risks
    const validRisks = parsed.suggestedRisks?.filter(code => {
        const isValid = availableRiskCodes.includes(code);
        if (!isValid) {
            console.warn(`Invalid risk code suggested by AI: ${code}`);
        }
        return isValid;
    }) || [];

    // Step 5: Return validated and sanitized data
    return {
        activityCodes: validActivityCodes,
        suggestedDrivers: Object.keys(validDrivers).length > 0 ? validDrivers : undefined,
        suggestedRisks: validRisks.length > 0 ? validRisks : undefined,
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
