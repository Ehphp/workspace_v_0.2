/**
 * API Client for Requirement Understanding Generation
 *
 * Frontend wrapper for the ai-requirement-understanding Netlify function.
 * Mirrors the style of requirement-interview-api.ts.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type {
    RequirementUnderstandingRequest,
    RequirementUnderstandingResponse,
} from '@/types/requirement-understanding';

/**
 * Generate a structured Requirement Understanding from a description.
 *
 * If normalizationResult.normalizedDescription is provided, the backend
 * will use it as the preferred semantic input while preserving metadata
 * from the original description.
 *
 * @param request - Description + optional tech/project/normalization context
 * @returns Typed response with understanding artifact or error
 */
export async function generateRequirementUnderstanding(
    request: RequirementUnderstandingRequest
): Promise<RequirementUnderstandingResponse> {
    // 1. Client-side sanitization
    const sanitizedDescription = sanitizePromptInput(request.description);

    // 2. Basic validation
    if (!sanitizedDescription || sanitizedDescription.length < 15) {
        return {
            success: false,
            error: 'La descrizione deve contenere almeno 15 caratteri.',
        };
    }

    if (sanitizedDescription.length > 2000) {
        return {
            success: false,
            error: 'La descrizione è troppo lunga (max 2000 caratteri).',
        };
    }

    // 3. Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend endpoint
    try {
        const response = await fetch(buildFunctionUrl('ai-requirement-understanding'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                description: sanitizedDescription,
                techCategory: request.techCategory,
                techPresetId: request.techPresetId,
                projectContext: request.projectContext,
                normalizationResult: request.normalizationResult,
            }),
        });

        // 5. Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 429) {
                return {
                    success: false,
                    error: errorData.message || 'Limite richieste raggiunto. Riprova più tardi.',
                };
            }

            if (response.status === 504) {
                return {
                    success: false,
                    error: 'Timeout del servizio. Prova con una descrizione più concisa.',
                };
            }

            return {
                success: false,
                error: errorData.message || `Errore del server (${response.status}). Riprova.`,
            };
        }

        // 6. Parse and return response
        const data = await response.json();

        console.log('[requirement-understanding-api] Understanding generated:', {
            confidence: data.understanding?.confidence,
            complexity: data.understanding?.complexityAssessment?.level,
            actorsCount: data.understanding?.actors?.length,
            perimeterCount: data.understanding?.functionalPerimeter?.length,
        });

        return data as RequirementUnderstandingResponse;

    } catch (error) {
        console.error('[requirement-understanding-api] Network error:', error);
        return {
            success: false,
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}
