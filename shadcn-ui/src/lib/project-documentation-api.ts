/**
 * API Client for Project Documentation Analysis
 *
 * Frontend wrapper for the ai-generate-project-from-documentation Netlify function.
 * Mirrors the style of requirement-understanding-api.ts and impact-map-api.ts.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type { GenerateProjectFromDocumentationResponse } from '@/types/project-technical-blueprint';

/**
 * Generate a project draft and technical blueprint from documentation text.
 *
 * @param sourceText - Raw documentation text to analyze
 * @returns Typed response with projectDraft + technicalBlueprint or error
 */
export async function generateProjectFromDocumentation(
    sourceText: string,
): Promise<GenerateProjectFromDocumentationResponse> {
    // 1. Client-side sanitization
    const sanitizedText = sanitizePromptInput(sourceText);

    // 2. Basic validation
    if (!sanitizedText || sanitizedText.trim().length < 50) {
        return {
            success: false,
            error: 'Il testo della documentazione deve contenere almeno 50 caratteri.',
        };
    }

    if (sanitizedText.length > 20000) {
        return {
            success: false,
            error: 'Il testo è troppo lungo (max 20000 caratteri).',
        };
    }

    // 3. Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend endpoint
    try {
        const response = await fetch(
            buildFunctionUrl('ai-generate-project-from-documentation'),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeader,
                },
                body: JSON.stringify({ sourceText: sanitizedText }),
            },
        );

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
                    error: 'Timeout del servizio. Prova con un testo più conciso.',
                };
            }

            return {
                success: false,
                error: errorData.message || `Errore del server (${response.status}). Riprova.`,
            };
        }

        // 6. Parse and return response
        const data = await response.json();

        console.log('[project-documentation-api] Project generated:', {
            draftConfidence: data.result?.projectDraft?.confidence,
            blueprintConfidence: data.result?.technicalBlueprint?.confidence,
            componentsCount: data.result?.technicalBlueprint?.components?.length,
        });

        return data as GenerateProjectFromDocumentationResponse;
    } catch (error) {
        console.error('[project-documentation-api] Network error:', error);
        return {
            success: false,
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}
