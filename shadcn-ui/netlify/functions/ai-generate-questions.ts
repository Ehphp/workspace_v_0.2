/**
 * Netlify Function: AI Generate Questions
 * 
 * Endpoint for generating interview questions based on user's technology description.
 * This is Stage 1 of the two-stage AI preset generation flow.
 * 
 * POST /.netlify/functions/ai-generate-questions
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { checkRateLimit } from './lib/security/rate-limiter';
import { generateQuestions } from './lib/ai/actions/generate-questions';

interface RequestBody {
    description: string;
    userId: string;
}

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    return new OpenAI({
        apiKey,
        timeout: 15000, // 15 second timeout for question generation
    });
}

/**
 * Main handler
 */
export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    // Debug logging
    logAuthDebugInfo();
    console.log('[ai-generate-questions] Request received');

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // Origin allowlist check
    if (!isOriginAllowed(originHeader)) {
        console.warn('[ai-generate-questions] Blocked origin:', originHeader);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Origin not allowed' }),
        };
    }

    // Auth validation
    const authHeader = event.headers.authorization || (event.headers.Authorization as string | undefined);
    const authResult = await validateAuthToken(authHeader);

    if (!authResult.ok) {
        return {
            statusCode: authResult.statusCode || 401,
            headers,
            body: JSON.stringify({ error: authResult.message || 'Unauthorized' }),
        };
    }

    // Rate limiting - uses global AI_RATE_LIMIT_MAX from env
    const rateKey = `questions:${authResult.userId || 'anonymous'}`;
    const rateStatus = checkRateLimit(rateKey);

    if (!rateStatus.allowed) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
                error: 'Rate limit exceeded',
                message: 'Hai raggiunto il limite di generazione domande. Riprova tra un\'ora.',
                retryAfter: rateStatus.retryAfter,
            }),
        };
    }

    try {
        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');

        // Validate required fields
        if (!body.description || typeof body.description !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing or invalid description field',
                    message: 'Il campo "description" è obbligatorio e deve essere una stringa.'
                }),
            };
        }

        // Sanitize description (client should have done this, but defense in depth)
        const sanitizedDescription = sanitizePromptInput(body.description);

        if (!sanitizedDescription || sanitizedDescription.length < 20) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Description too short',
                    message: 'La descrizione deve contenere almeno 20 caratteri significativi.',
                }),
            };
        }

        if (sanitizedDescription.length > 1000) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Description too long',
                    message: 'La descrizione è troppo lunga (max 1000 caratteri).',
                }),
            };
        }

        // Check OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            console.error('[ai-generate-questions] OPENAI_API_KEY not configured');
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({
                    error: 'Service configuration error',
                    message: 'Il servizio AI non è configurato correttamente. Contatta il supporto.',
                }),
            };
        }

        // Initialize OpenAI client
        const openai = getOpenAIClient();

        // Generate questions
        console.log('[ai-generate-questions] Calling generateQuestions...');
        const result = await generateQuestions(
            {
                description: sanitizedDescription,
                userId: authResult.userId || body.userId || 'anonymous'
            },
            openai
        );

        // Log metadata (no PII)
        console.log('[ai-generate-questions] Result:', {
            success: result.success,
            questionCount: result.questions.length,
            hasReasoning: !!result.reasoning,
            suggestedCategory: result.suggestedTechCategory,
            descriptionLength: sanitizedDescription.length,
        });

        // Return response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error('[ai-generate-questions] Unhandled error:', error);

        // Determine if it's an OpenAI error
        const isOpenAIError = error && typeof error === 'object' && 'status' in error;
        const statusCode = isOpenAIError ? (error as any).status : 500;

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: 'Si è verificato un errore durante la generazione delle domande. Riprova.',
                details: process.env.NODE_ENV === 'development' && error instanceof Error
                    ? error.message
                    : undefined
            }),
        };
    }
};
