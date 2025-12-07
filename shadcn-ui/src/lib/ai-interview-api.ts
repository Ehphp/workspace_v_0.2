/**
 * API Client for AI Interview System
 * 
 * Handles communication with question generation endpoint.
 */

import {
    QuestionGenerationResponse,
    QuestionGenerationResponseSchema,
} from '../types/ai-interview';
import { sanitizePromptInput } from '../types/ai-validation';

/**
 * Generate interview questions based on technology description
 */
export async function generateInterviewQuestions(
    description: string,
    supabaseToken?: string
): Promise<QuestionGenerationResponse> {
    // 1. Client-side sanitization
    const sanitizedDescription = sanitizePromptInput(description);

    // 2. Basic validation
    if (!sanitizedDescription || sanitizedDescription.length < 20) {
        throw new Error('La descrizione deve contenere almeno 20 caratteri significativi.');
    }

    if (sanitizedDescription.length > 1000) {
        throw new Error('La descrizione è troppo lunga (max 1000 caratteri).');
    }

    // 3. Call backend endpoint
    const response = await fetch('/.netlify/functions/ai-generate-questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {}),
        },
        body: JSON.stringify({
            description: sanitizedDescription,
        }),
    });

    // 4. Handle HTTP errors
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
            throw new Error(
                errorData.message || 'Hai raggiunto il limite di richieste. Riprova più tardi.'
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error('Non sei autorizzato. Effettua il login e riprova.');
        }

        throw new Error(
            errorData.message || `Errore del server (${response.status}). Riprova.`
        );
    }

    // 5. Parse and validate response
    const data = await response.json();

    try {
        const validated = QuestionGenerationResponseSchema.parse(data) as QuestionGenerationResponse;
        return validated;
    } catch (validationError) {
        console.error('[ai-interview-api] Validation failed:', validationError);
        throw new Error('Risposta del server non valida. Riprova.');
    }
}

/**
 * Type guard to check if response has questions
 */
export function hasQuestions(response: QuestionGenerationResponse): boolean {
    return response.success && response.questions.length >= 3;
}

/**
 * Get suggested tech category with fallback
 */
export function getSuggestedCategory(
    response: QuestionGenerationResponse
): 'FRONTEND' | 'BACKEND' | 'MULTI' {
    return response.suggestedTechCategory || 'MULTI';
}
