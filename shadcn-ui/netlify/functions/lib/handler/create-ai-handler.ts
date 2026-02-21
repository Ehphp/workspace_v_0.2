/**
 * AI Handler Factory
 * 
 * Creates standardized Netlify function handlers with common middleware:
 * - CORS handling
 * - OPTIONS preflight
 * - HTTP method validation
 * - Origin allowlist
 * - Authentication (optional)
 * - Rate limiting (optional)
 * - OpenAI configuration check
 * - Request body parsing
 * - Standardized error responses
 * 
 * Usage:
 * ```typescript
 * export const handler = createAIHandler({
 *   name: 'ai-suggest',
 *   requireAuth: true,
 *   handler: async (body, ctx) => {
 *     return { success: true, data: ... };
 *   }
 * });
 * ```
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { validateAuthToken, logAuthDebugInfo } from '../auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from '../security/cors';
import { checkRateLimit } from '../security/rate-limiter';
import { isOpenAIConfigured } from '../ai/openai-client';
import { sanitizePromptInput } from '../sanitize';

/**
 * Context passed to handler business logic
 */
export interface AIHandlerContext {
    /** Validated user ID (if auth enabled and successful) */
    userId?: string;
    /** Original request event */
    event: HandlerEvent;
    /** Netlify context */
    netlifyContext: HandlerContext;
    /** CORS headers to include in response */
    headers: Record<string, string>;
    /** Sanitize user input for prompts */
    sanitize: (input: string) => string;
}

/**
 * Standard error response format
 */
export interface AIErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
    };
}

/**
 * Configuration for creating an AI handler
 */
export interface AIHandlerConfig<TBody = any, TResponse = any> {
    /** Handler name for logging */
    name: string;
    /** Require valid auth token (default: false) */
    requireAuth?: boolean;
    /** Enable rate limiting (default: false, disabled in dev) */
    rateLimit?: boolean;
    /** Check OpenAI API key is configured (default: true) */
    requireOpenAI?: boolean;
    /** Custom body validator (return error message or null if valid) */
    validateBody?: (body: TBody) => string | null;
    /** Business logic handler */
    handler: (body: TBody, ctx: AIHandlerContext) => Promise<TResponse>;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
    code: string,
    message: string,
    details?: any
): AIErrorResponse {
    return {
        success: false,
        error: { code, message, details }
    };
}

/**
 * Create an AI handler with standard middleware
 */
export function createAIHandler<TBody = any, TResponse = any>(
    config: AIHandlerConfig<TBody, TResponse>
): Handler {
    const {
        name,
        requireAuth = false,
        rateLimit = false,
        requireOpenAI = true,
        validateBody,
        handler: businessLogic
    } = config;

    return async (event: HandlerEvent, context: HandlerContext) => {
        const originHeader = event.headers.origin || event.headers.Origin;
        const headers = getCorsHeaders(originHeader);

        // Debug logging
        logAuthDebugInfo();
        console.log(`[${name}] Request received - ${event.httpMethod}`);

        // 1. Handle preflight requests
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        // 2. Only allow POST
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', 'Method Not Allowed')),
            };
        }

        // 3. Origin allowlist check
        if (!isOriginAllowed(originHeader)) {
            console.warn(`[${name}] Blocked origin:`, originHeader);
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify(createErrorResponse('ORIGIN_NOT_ALLOWED', 'Origin not allowed')),
            };
        }

        // 4. Auth validation
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const authResult = await validateAuthToken(authHeader as string | undefined);

        if (requireAuth && !authResult.ok) {
            return {
                statusCode: authResult.statusCode || 401,
                headers,
                body: JSON.stringify(createErrorResponse('UNAUTHORIZED', authResult.message || 'Unauthorized')),
            };
        }

        // 5. Rate limiting (if enabled)
        if (rateLimit) {
            const rateKey =
                authResult.userId ||
                (event.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
                event.headers['client-ip'] ||
                'anonymous';

            const rateStatus = await checkRateLimit(rateKey);
            if (!rateStatus.allowed) {
                return {
                    statusCode: 429,
                    headers: {
                        ...headers,
                        'Retry-After': String(rateStatus.retryAfter ?? 60),
                    },
                    body: JSON.stringify(createErrorResponse('RATE_LIMITED', 'Rate limit exceeded')),
                };
            }
        }

        // 6. Check OpenAI API key (if required)
        if (requireOpenAI && !isOpenAIConfigured()) {
            console.error(`[${name}] OPENAI_API_KEY not configured`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify(createErrorResponse('OPENAI_NOT_CONFIGURED', 'OpenAI API key not configured')),
            };
        }

        try {
            // 7. Parse request body
            let body: TBody;
            try {
                body = JSON.parse(event.body || '{}');
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify(createErrorResponse('INVALID_JSON', 'Invalid JSON in request body')),
                };
            }

            // 8. Custom body validation
            if (validateBody) {
                const validationError = validateBody(body);
                if (validationError) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify(createErrorResponse('VALIDATION_ERROR', validationError)),
                    };
                }
            }

            // 9. Create handler context
            const ctx: AIHandlerContext = {
                userId: authResult.userId ?? undefined,
                event,
                netlifyContext: context,
                headers,
                sanitize: sanitizePromptInput,
            };

            // 10. Execute business logic
            console.log(`[${name}] Executing business logic...`);
            const result = await businessLogic(body, ctx);

            // 11. Return success response
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result),
            };
        } catch (error: any) {
            // 12. Handle errors
            console.error(`[${name}] Error:`, error?.message || error);
            console.error(`[${name}] Error details:`, {
                type: error?.constructor?.name,
                code: error?.code,
                status: error?.status,
            });

            // Check for timeout errors
            const isTimeout = error?.code === 'ETIMEDOUT' ||
                error?.code === 'ECONNABORTED' ||
                error?.message?.includes('timeout');

            return {
                statusCode: isTimeout ? 504 : (error?.status || 500),
                headers,
                body: JSON.stringify(createErrorResponse(
                    isTimeout ? 'TIMEOUT' : (error?.code || 'INTERNAL_ERROR'),
                    error?.message || 'An unexpected error occurred',
                    process.env.NODE_ENV === 'development' ? {
                        stack: error?.stack,
                        details: error?.response?.data
                    } : undefined
                )),
            };
        }
    };
}

/**
 * Type helper for typed body validation
 */
export function createBodyValidator<T>(
    requiredFields: (keyof T)[],
    customValidation?: (body: T) => string | null
): (body: T) => string | null {
    return (body: T) => {
        // Check required fields
        for (const field of requiredFields) {
            if (body[field] === undefined || body[field] === null) {
                return `Missing required field: ${String(field)}`;
            }
        }
        // Run custom validation
        if (customValidation) {
            return customValidation(body);
        }
        return null;
    };
}
