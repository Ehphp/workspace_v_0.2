import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { sanitizePromptInput } from '../../src/types/ai-validation';

// Import modular components
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { checkRateLimit } from './lib/security/rate-limiter';
import { isOpenAIConfigured } from './lib/ai/openai-client';
import { suggestActivities } from './lib/ai/actions/suggest-activities';
import { generateTitle } from './lib/ai/actions/generate-title';
import { normalizeRequirement } from './lib/ai/actions/normalize-requirement';

interface RequestBody {
    action?: 'suggest-activities' | 'generate-title' | 'normalize-requirement';
    description: string;
    preset?: {
        id: string;
        name: string;
        description: string;
        tech_category: string;
        default_activity_codes: string[];
        default_driver_values: Record<string, string>;
        default_risks: string[];
    };
    activities?: Array<{
        code: string;
        name: string;
        description: string;
        base_days: number;
        group: string;
        tech_category: string;
    }>;
    // Test mode: disable cache and increase temperature
    testMode?: boolean;
}

interface AIActivitySuggestion {
    isValidRequirement: boolean;
    activityCodes: string[];
    reasoning?: string;
}

export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    // Debug: print presence of important environment variables (mask actual values)
    logAuthDebugInfo();
    console.log('DEBUG ENV - OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

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
        console.warn('Blocked origin', originHeader);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Origin not allowed' }),
        };
    }

    // Auth validation (if enabled)
    const authHeader = event.headers.authorization || (event.headers.Authorization as string | undefined);
    const authResult = await validateAuthToken(authHeader);
    if (!authResult.ok) {
        return {
            statusCode: authResult.statusCode || 401,
            headers,
            body: JSON.stringify({ error: authResult.message || 'Unauthorized' }),
        };
    }

    // Basic rate limiting by user or IP
    const rateKey =
        authResult.userId ||
        (event.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        event.headers['client-ip'] ||
        'anonymous';
    const rateStatus = checkRateLimit(rateKey);
    if (!rateStatus.allowed) {
        return {
            statusCode: 429,
            headers: {
                ...headers,
                'Retry-After': String(rateStatus.retryAfter ?? 60),
            },
            body: JSON.stringify({ error: 'Rate limit exceeded' }),
        };
    }

    // Check API key is configured
    if (!isOpenAIConfigured()) {
        console.error('OPENAI_API_KEY not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'OpenAI API key not configured on server',
            }),
        };
    }

    try {
        console.log('=== AI Suggest Function Called ===');
        console.log('HTTP Method:', event.httpMethod);
        console.log('API Key configured:', isOpenAIConfigured());

        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');
        const action = body.action || 'suggest-activities';

        // Handle title generation
        if (action === 'generate-title') {
            const { description } = body;

            if (!description) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing description' }),
                };
            }

            const sanitizedDescription = sanitizePromptInput(description);
            const result = await generateTitle({ description: sanitizedDescription });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result),
            };
        }

        // Handle requirement normalization
        if (action === 'normalize-requirement') {
            const { description, testMode } = body;

            if (!description) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing description' }),
                };
            }

            const sanitizedDescription = sanitizePromptInput(description);
            const result = await normalizeRequirement({
                description: sanitizedDescription,
                testMode
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result),
            };
        }

        // Handle activity suggestions
        const { description, preset, activities, testMode } = body;

        if (!description || !preset || !activities) {
            console.error('Validation failed - missing fields');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing required fields: description, preset, activities',
                }),
            };
        }

        const sanitizedDescription = sanitizePromptInput(description);
        console.log('Request body parsed:');
        console.log('- Description length:', sanitizedDescription?.length);
        console.log('- Preset:', preset?.name);
        console.log('- Activities count:', activities?.length);

        const result = await suggestActivities({
            description: sanitizedDescription,
            preset,
            activities,
            testMode
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error('=== ERROR in ai-suggest function ===');
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);
        console.error('Error code:', error?.code);
        console.error('Error status:', error?.status);
        console.error('Error response:', error?.response?.data);
        console.error('Full error:', JSON.stringify(error, null, 2));

        // Return error response
        return {
            statusCode: error?.status || 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate AI suggestions',
                message: error.message || 'Unknown error',
                code: error?.code,
                status: error?.status,
            }),
        };
    }
};
