/**
 * Netlify Function: AI Generate Preset
 * 
 * Endpoint for generating technology presets based on user's description and interview answers.
 * This is Stage 2 of the two-stage AI preset generation flow.
 * 
 * POST /.netlify/functions/ai-generate-preset
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { checkRateLimit } from './lib/security/rate-limiter';
import { generatePreset } from './lib/ai/actions/generate-preset';

interface RequestBody {
    description: string;
    answers: Record<string, any>;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
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
        timeout: 30000, // 30 second timeout for preset generation (longer than questions)
    });
}

/**
 * Initialize Supabase client for activity catalog access
 */
function getSupabaseClient(): ReturnType<typeof createClient> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
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
    console.log('[ai-generate-preset] Request received');

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
        console.warn('[ai-generate-preset] Blocked origin:', originHeader);
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
    const rateKey = `preset:${authResult.userId || 'anonymous'}`;
    const rateStatus = checkRateLimit(rateKey);

    if (!rateStatus.allowed) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
                error: 'Rate limit exceeded',
                message: 'Hai raggiunto il limite di generazione preset. Riprova tra un\'ora.',
                retryAfter: rateStatus.retryAfter,
            }),
        };
    }

    try {
        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');

        console.log('[ai-generate-preset] Request body:', {
            hasDescription: !!body.description,
            descriptionLength: body.description?.length,
            hasAnswers: !!body.answers,
            answersCount: body.answers ? Object.keys(body.answers).length : 0,
            suggestedTechCategory: body.suggestedTechCategory
        });

        // Validate required fields
        if (!body.description || typeof body.description !== 'string') {
            console.error('[ai-generate-preset] Invalid description:', typeof body.description);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing or invalid description field',
                    message: 'Il campo "description" è obbligatorio.'
                }),
            };
        }

        if (!body.answers || typeof body.answers !== 'object') {
            console.error('[ai-generate-preset] Invalid answers:', typeof body.answers);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing or invalid answers field',
                    message: 'Il campo "answers" è obbligatorio e deve essere un oggetto.'
                }),
            };
        }

        // Sanitize description
        const sanitizedDescription = sanitizePromptInput(body.description);

        if (!sanitizedDescription || sanitizedDescription.length < 20) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Description too short',
                    message: 'La descrizione deve contenere almeno 20 caratteri.',
                }),
            };
        }

        // Check environment configuration
        if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error('[ai-generate-preset] Missing environment configuration');
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({
                    error: 'Service configuration error',
                    message: 'Il servizio non è configurato correttamente. Contatta il supporto.',
                }),
            };
        }

        // Initialize clients
        const openai = getOpenAIClient();
        const supabase = getSupabaseClient();

        // Generate preset
        console.log('[ai-generate-preset] Calling generatePreset...');
        const result = await generatePreset(
            {
                description: sanitizedDescription,
                answers: body.answers,
                suggestedTechCategory: body.suggestedTechCategory,
                userId: authResult.userId || 'anonymous'
            },
            openai,
            supabase
        );

        // Log metadata (no PII)
        console.log('[ai-generate-preset] Result:', {
            success: result.success,
            hasPreset: !!result.preset,
            activities: result.metadata?.totalActivities,
            estimatedDays: result.metadata?.estimatedDays,
            confidence: result.preset?.confidence,
            generationTime: result.metadata?.generationTimeMs,
        });

        // Return response
        return {
            statusCode: result.success ? 200 : 400,
            headers,
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error('[ai-generate-preset] Unhandled error:', error);

        // Determine if it's an OpenAI error
        const isOpenAIError = error && typeof error === 'object' && 'status' in error;
        const statusCode = isOpenAIError ? (error as any).status : 500;

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: 'Si è verificato un errore durante la generazione del preset. Riprova.',
                details: process.env.NODE_ENV === 'development' && error instanceof Error
                    ? error.message
                    : undefined
            }),
        };
    }
};
