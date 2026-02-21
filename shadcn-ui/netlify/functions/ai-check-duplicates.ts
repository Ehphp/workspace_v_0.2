/**
 * Netlify Function: Check Activity Duplicates
 * 
 * Phase 3: Semantic matching for activity deduplication.
 * When creating new custom activities, checks for semantically similar
 * existing activities to prevent catalog bloat.
 * 
 * POST /.netlify/functions/ai-check-duplicates
 * 
 * Request body:
 * {
 *   "name": "Activity name",
 *   "description": "Activity description"
 * }
 * 
 * Response:
 * {
 *   "hasDuplicates": boolean,
 *   "duplicates": [{ code, name, description, similarity }],
 *   "suggestion": "message to show user"
 * }
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { sanitizePromptInput } from './lib/sanitize';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { findDuplicateActivities, isVectorSearchEnabled } from './lib/ai/vector-search';
import { createActivitySearchText } from './lib/ai/embeddings';

interface DuplicateCheckRequest {
    name: string;
    description?: string;
}

interface DuplicateActivity {
    code: string;
    name: string;
    description: string | null;
    similarity: number;
}

interface DuplicateCheckResponse {
    hasDuplicates: boolean;
    duplicates: DuplicateActivity[];
    suggestion?: string;
    vectorSearchEnabled: boolean;
}

export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    logAuthDebugInfo();
    console.log('[ai-check-duplicates] Request received');

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only POST allowed
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // Origin check
    if (!isOriginAllowed(originHeader)) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Origin not allowed' }),
        };
    }

    // Auth validation
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const authResult = await validateAuthToken(authHeader as string | undefined);
    if (!authResult.ok) {
        return {
            statusCode: authResult.statusCode || 401,
            headers,
            body: JSON.stringify({ error: authResult.message || 'Unauthorized' }),
        };
    }

    // Check if vector search is enabled
    if (!isVectorSearchEnabled()) {
        console.log('[ai-check-duplicates] Vector search disabled');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                hasDuplicates: false,
                duplicates: [],
                suggestion: undefined,
                vectorSearchEnabled: false,
            } as DuplicateCheckResponse),
        };
    }

    try {
        // Parse request
        const body: DuplicateCheckRequest = JSON.parse(event.body || '{}');

        if (!body.name || typeof body.name !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Activity name is required' }),
            };
        }

        // Sanitize inputs
        const sanitizedName = sanitizePromptInput(body.name);
        const sanitizedDescription = body.description
            ? sanitizePromptInput(body.description)
            : '';

        // Create search text
        const searchText = createActivitySearchText({
            name: sanitizedName,
            description: sanitizedDescription,
            code: 'NEW',
        });

        console.log('[ai-check-duplicates] Searching for similar activities...');

        // Find duplicates
        const { results, metrics } = await findDuplicateActivities(searchText);

        console.log(`[ai-check-duplicates] Found ${results.length} similar activities in ${metrics.latencyMs}ms`);

        // Format response
        const duplicates: DuplicateActivity[] = results.map(r => ({
            code: r.code,
            name: r.name,
            description: r.description,
            similarity: Math.round((r.similarity || 0) * 100) / 100,
        }));

        const hasDuplicates = duplicates.length > 0;
        let suggestion: string | undefined;

        if (hasDuplicates) {
            const topMatch = duplicates[0];
            const similarityPercent = Math.round(topMatch.similarity * 100);

            if (topMatch.similarity >= 0.9) {
                suggestion = `Un'attività molto simile esiste già: "${topMatch.name}" (${similarityPercent}% corrispondenza). Ti consigliamo di riutilizzare quella esistente.`;
            } else if (topMatch.similarity >= 0.8) {
                suggestion = `Abbiamo trovato un'attività simile: "${topMatch.name}" (${similarityPercent}% corrispondenza). Vuoi riutilizzarla o creare comunque una nuova attività?`;
            }
        }

        const response: DuplicateCheckResponse = {
            hasDuplicates,
            duplicates,
            suggestion,
            vectorSearchEnabled: true,
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response),
        };
    } catch (err) {
        console.error('[ai-check-duplicates] Error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                hasDuplicates: false,
                duplicates: [],
                error: err instanceof Error ? err.message : 'Unknown error',
                vectorSearchEnabled: isVectorSearchEnabled(),
            }),
        };
    }
};
