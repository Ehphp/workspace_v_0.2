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
import { randomUUID } from 'crypto';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { checkRateLimit } from './lib/security/rate-limiter';

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
        timeout: 50000, // 50 second timeout (increased for preset generation)
        maxRetries: 1, // One retry for timeout cases
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

    // Rate limiting - DISABLED FOR DEVELOPMENT
    // const rateKey = `preset:${authResult.userId || 'anonymous'}`;
    // const rateStatus = await checkRateLimit(rateKey);

    // if (!rateStatus.allowed) {
    //     return {
    //         statusCode: 429,
    //         headers,
    //         body: JSON.stringify({
    //             error: 'Rate limit exceeded',
    //             message: 'Hai raggiunto il limite di generazione preset. Riprova tra un\'ora.',
    //             retryAfter: rateStatus.retryAfter,
    //         }),
    //     };
    // }

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
        if (!process.env.OPENAI_API_KEY) {
            console.error('[ai-generate-preset] Missing OpenAI API key');
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({
                    error: 'Service configuration error',
                    message: 'Il servizio non è configurato correttamente. Contatta il supporto.',
                }),
            };
        }

        // Initialize OpenAI client
        const openai = getOpenAIClient();

        // Generate unique request ID
        const requestId = randomUUID();

        // SIMPLIFIED: Single-pass generation with reduced output
        console.log('[ai-generate-preset] Calling OpenAI for preset generation...', { requestId });

        const systemPrompt = `You are a Technical Estimator creating ACTIVITY PRESETS for estimating SOFTWARE REQUIREMENTS. Respond with JSON only.

**GOAL**:
Generate a list of standard activities that a developer performs when implementing a SINGLE REQUIREMENT (e.g., "Add Login Form", "Create API", "Fix Bug") using the specified technology.
DO NOT generate high-level project phases (like "Project Setup", "Infrastructure", "Deployment"). Focus on ATOMIC WORK UNITS.

**CONTEXT AWARENESS (LIFECYCLE)**:
- **Greenfield (New Project)**: Include basic setup/scaffolding activities IF RELEVANT for single features (e.g. "Create new Component", "Setup Route").
- **Brownfield (Existing Project)**: Focus on Integration, Refactoring, and Extending existing code.
- **Custom Inputs**: If user provided custom answers ("Other: ..."), incorporate them into the activity descriptions.

**CRITICAL RULES**:
1. Activities must be REUSABLE building blocks for estimating features (e.g., "Develop UI", "Implement Business Logic", "Write Tests").
2. Language: SAME AS USER INPUT.
3. Preset Description: Describe the TECHNOLOGY/STACK context (e.g "Microservices Java Stack"), NOT the preset itself.

**Examples of Good Requirement Activities**:
- "Sviluppo parziale API Backend" (Generic, reusable)
- "Implementazione logica Frontend"
- "Stesura Unit Test"
- "Analisi e Design Tecnico"
- "Refactoring e Code Review" (Essential for Brownfield)
- "Integrazione con Legacy System" (If context suggests legacy)

**Examples of BAD (Project-level) Activities**:
- "Project Initialization" (Happens once per project, not per requirement)
- "Server Provisioning"
- "Release to Production"

**OUTPUT FORMAT (valid JSON)**:
{
  "success": true,
  "preset": {
    "name": "Technology name (max 50 chars)",
    "description": "Tech stack description (80-120 chars)",
    "detailedDescription": "Technical details about the stack (150-200 words MAX)",
    "techCategory": "FRONTEND" | "BACKEND" | "MULTI",
    "activities": [
      {
        "title": "Activity Name (e.g. 'Sviluppo UI Component')",
        "description": "What is done in this step",
        "group": "DEV" | "ANALYSIS" | "TEST" | "GOVERNANCE",
        "estimatedHours": 2-8,
        "priority": "core"
      }
    ],
    "driverValues": {"COMPLEXITY": 0.5},
    "riskCodes": ["RISK_TECH"],
    "reasoning": "Why these activities fit this stack",
    "confidence": 0.8
  }
}`;

        const userPrompt = `Context Description: ${sanitizedDescription}

Questions & Answers: ${JSON.stringify(body.answers)}
Suggested Category: ${body.suggestedTechCategory || 'MULTI'}

Generate a preset with 6-10 ATOMIC ESTIMATION ACTIVITIES optimized for estimating requirements in this stack. Return JSON only.`;

        const startTime = Date.now();

        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            temperature: 0.2, // Lower for faster, more deterministic responses
            max_tokens: 1500, // Further reduced for speed
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        }); const generationTimeMs = Date.now() - startTime;
        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No content in OpenAI response');
        }

        const result = JSON.parse(content);

        // Validate activity genericness (post-generation check)
        if (result.preset && result.preset.activities) {
            const { validateActivities, logValidationResults } = await import('./lib/validation/activity-genericness-validator');

            const validationResults = validateActivities(
                result.preset.activities.map((a: any) => ({
                    title: a.title || '',
                    description: a.description || ''
                }))
            );

            logValidationResults(validationResults, {
                requestId,
                techCategory: body.suggestedTechCategory
            });

            // Add validation metadata to response
            result.preset.validationScore = validationResults.averageScore;
            result.preset.genericityCheck = {
                passed: validationResults.summary.passed,
                failed: validationResults.summary.failed,
                warnings: validationResults.summary.warnings
            };

            // Log warning if quality is low
            if (validationResults.averageScore < 70) {
                console.warn('[ai-generate-preset] Low genericity score:', {
                    averageScore: validationResults.averageScore,
                    failedCount: validationResults.summary.failed,
                    requestId
                });
            }
        }

        // Log metadata (no PII)
        console.log('[ai-generate-preset] Generation complete:', {
            success: result.success,
            hasPreset: !!result.preset,
            activities: result.preset?.activities.length,
            validationScore: result.preset?.validationScore?.toFixed(1),
            generationTimeMs,
            requestId
        });

        // Return response
        return {
            statusCode: result.success ? 200 : 400,
            headers,
            body: JSON.stringify({
                ...result,
                metadata: {
                    cached: false,
                    attempts: 1,
                    modelPasses: ['gpt-4o-mini'],
                    generationTimeMs
                }
            }),
        };

    } catch (error) {
        console.error('[ai-generate-preset] Unhandled error:', error);

        // Handle different error types
        let statusCode = 500;
        let errorMessage = 'Si è verificato un errore durante la generazione del preset. Riprova.';

        if (error && typeof error === 'object') {
            // Timeout error
            if (error.constructor?.name === 'APIConnectionTimeoutError' ||
                (error as any).message?.includes('timed out')) {
                statusCode = 504;
                errorMessage = 'La richiesta ha impiegato troppo tempo. Riprova con una descrizione più breve o semplifica le risposte.';
                console.error('[ai-generate-preset] Timeout error detected');
            }
            // OpenAI API error with status
            else if ('status' in error && typeof (error as any).status === 'number') {
                statusCode = (error as any).status;
            }
        }

        return {
            statusCode: statusCode || 500, // Ensure we always have a valid statusCode
            headers,
            body: JSON.stringify({
                error: statusCode === 504 ? 'Gateway Timeout' : 'Internal server error',
                message: errorMessage,
                details: process.env.NODE_ENV === 'development' && error instanceof Error
                    ? error.message
                    : undefined
            }),
        };
    }
};
