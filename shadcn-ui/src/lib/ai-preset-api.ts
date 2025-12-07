/**
 * API Client for AI Preset Generation
 * 
 * Handles communication with preset generation endpoint.
 */

import {
    PresetGenerationResponse,
    PresetGenerationResponseSchema,
    PresetGenerationRequest,
} from '../types/ai-preset-generation';
import { sanitizePromptInput } from '../types/ai-validation';

/**
 * Generate technology preset based on description and interview answers
 */
export async function generateTechnologyPreset(
    request: PresetGenerationRequest,
    supabaseToken?: string
): Promise<PresetGenerationResponse> {
    // 1. Client-side sanitization
    const sanitizedDescription = sanitizePromptInput(request.description);

    // 2. Basic validation
    if (!sanitizedDescription || sanitizedDescription.length < 20) {
        throw new Error('La descrizione deve contenere almeno 20 caratteri significativi.');
    }

    if (!request.answers || Object.keys(request.answers).length === 0) {
        throw new Error('Risposte alle domande mancanti.');
    }

    // 3. Call backend endpoint
    console.log('[ai-preset-api] Sending request:', {
        description: sanitizedDescription.substring(0, 50) + '...',
        answersCount: Object.keys(request.answers).length,
        answersKeys: Object.keys(request.answers),
        suggestedTechCategory: request.suggestedTechCategory
    });

    const response = await fetch('/.netlify/functions/ai-generate-preset', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {}),
        },
        body: JSON.stringify({
            description: sanitizedDescription,
            answers: request.answers,
            suggestedTechCategory: request.suggestedTechCategory,
        }),
    });    // 4. Handle HTTP errors
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        console.error('[ai-preset-api] Error response:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });

        if (response.status === 429) {
            throw new Error(
                errorData.message || 'Hai raggiunto il limite di richieste. Riprova più tardi.'
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error('Non sei autorizzato. Effettua il login e riprova.');
        }

        throw new Error(
            errorData.message || errorData.error || `Errore del server (${response.status}). Riprova.`
        );
    }

    // 5. Parse and validate response
    const data = await response.json();

    try {
        const validated = PresetGenerationResponseSchema.parse(data);
        // Type assertion is safe here because Zod validates the structure
        return validated as PresetGenerationResponse;
    } catch (validationError) {
        console.error('[ai-preset-api] Validation failed:', validationError);
        throw new Error('Risposta del server non valida. Riprova.');
    }
}

/**
 * Type guard to check if response has preset
 */
export function hasPreset(response: PresetGenerationResponse): boolean {
    return response.success && !!response.preset;
}

/**
 * Get estimated total days from response
 */
export function getEstimatedDays(response: PresetGenerationResponse): number {
    return response.metadata?.estimatedDays || 0;
}

/**
 * Get activity count from response
 */
export function getActivityCount(response: PresetGenerationResponse): {
    total: number;
    core: number;
    recommended: number;
    optional: number;
} {
    return {
        total: response.metadata?.totalActivities || 0,
        core: response.metadata?.coreActivities || 0,
        recommended: response.metadata?.recommendedActivities || 0,
        optional: response.metadata?.optionalActivities || 0,
    };
}
