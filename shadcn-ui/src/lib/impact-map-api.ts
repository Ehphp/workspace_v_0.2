/**
 * API Client for Impact Map Generation
 *
 * Frontend wrapper for the ai-impact-map Netlify function.
 * Mirrors the style of requirement-understanding-api.ts.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type {
    ImpactMapRequest,
    ImpactMapResponse,
} from '@/types/impact-map';

/**
 * Generate a structured Impact Map from a description.
 *
 * If requirementUnderstanding is provided, the backend will use it
 * as enriched semantic context for higher-quality architectural analysis.
 *
 * @param request - Description + optional tech/understanding context
 * @returns Typed response with impact map artifact or error
 */
export async function generateImpactMap(
    request: ImpactMapRequest
): Promise<ImpactMapResponse> {
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
        const response = await fetch(buildFunctionUrl('ai-impact-map'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                description: sanitizedDescription,
                techCategory: request.techCategory,
                techPresetId: request.techPresetId,
                requirementUnderstanding: request.requirementUnderstanding,
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

        console.log('[impact-map-api] Impact map generated:', {
            confidence: data.impactMap?.confidence,
            impactsCount: data.impactMap?.impacts?.length,
            hasUnderstanding: !!request.requirementUnderstanding,
        });

        return data as ImpactMapResponse;

    } catch (error) {
        console.error('[impact-map-api] Network error:', error);
        return {
            success: false,
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}
