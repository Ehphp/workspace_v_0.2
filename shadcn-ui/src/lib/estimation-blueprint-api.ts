/**
 * API Client for Estimation Blueprint Generation
 *
 * Frontend wrapper for the ai-estimation-blueprint Netlify function.
 * Mirrors the style of impact-map-api.ts.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type {
    EstimationBlueprintRequest,
    EstimationBlueprintResponse,
} from '@/types/estimation-blueprint';

/**
 * Generate a structured Estimation Blueprint from a description.
 *
 * If requirementUnderstanding and/or impactMap are provided, the backend
 * will use them as enriched context for higher-quality decomposition.
 *
 * @param request - Description + optional tech/understanding/impactMap context
 * @returns Typed response with blueprint artifact or error
 */
export async function generateEstimationBlueprint(
    request: EstimationBlueprintRequest
): Promise<EstimationBlueprintResponse> {
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
        const response = await fetch(buildFunctionUrl('ai-estimation-blueprint'), {
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
                impactMap: request.impactMap,
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

        console.log('[blueprint-api] Estimation blueprint generated:', {
            confidence: data.blueprint?.overallConfidence,
            componentsCount: data.blueprint?.components?.length,
            integrationsCount: data.blueprint?.integrations?.length,
            hasUnderstanding: !!request.requirementUnderstanding,
            hasImpactMap: !!request.impactMap,
        });

        return data as EstimationBlueprintResponse;

    } catch (error) {
        console.error('[blueprint-api] Network error:', error);
        return {
            success: false,
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}
