/**
 * Netlify Function: AI Generate Preset
 * 
 * Endpoint for generating technology presets based on user's description and interview answers.
 * This is Stage 2 of the two-stage AI preset generation flow.
 * 
 * HYBRID APPROACH: AI can select activities from catalog OR create new ones.
 * 
 * POST /.netlify/functions/ai-generate-preset
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { checkRateLimit } from './lib/security/rate-limiter';

interface RequestBody {
    description: string;
    answers: Record<string, any>;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI' | 'POWER_PLATFORM';
}

interface CatalogActivity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    tech_category: string;
    group: string;
}

/**
 * Initialize Supabase client for fetching activity catalog
 */
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch activities from catalog filtered by tech category
 * Returns activities for the specified category + MULTI (cross-stack)
 */
async function fetchCatalogActivities(
    techCategory: string
): Promise<CatalogActivity[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('[ai-generate-preset] Supabase not configured, skipping catalog fetch');
        return [];
    }

    try {
        const categories = [techCategory, 'MULTI'];
        const { data, error } = await supabase
            .from('activities')
            .select('code, name, description, base_hours, tech_category, group')
            .in('tech_category', categories)
            .eq('active', true)
            .order('group')
            .order('base_hours');

        if (error) {
            console.error('[ai-generate-preset] Error fetching activities:', error);
            return [];
        }

        console.log(`[ai-generate-preset] Fetched ${data?.length || 0} activities for categories: ${categories.join(', ')}`);
        return data || [];
    } catch (err) {
        console.error('[ai-generate-preset] Exception fetching activities:', err);
        return [];
    }
}

/**
 * Format activities catalog in compact format for AI prompt
 * Groups by phase (group) and uses compact notation to minimize tokens
 */
function formatCatalogForPrompt(activities: CatalogActivity[]): string {
    if (activities.length === 0) {
        return 'CATALOG: No activities available - create all activities as new.';
    }

    // Group by phase
    const byGroup: Record<string, CatalogActivity[]> = {};
    for (const act of activities) {
        const group = act.group || 'OTHER';
        if (!byGroup[group]) byGroup[group] = [];
        byGroup[group].push(act);
    }

    const lines: string[] = ['ACTIVITY CATALOG (select by code when applicable):'];

    for (const [group, acts] of Object.entries(byGroup)) {
        lines.push(`\n[${group}]`);
        for (const a of acts) {
            // Compact format: CODE|hours|name - description (truncated)
            const desc = a.description?.slice(0, 80) || '';
            lines.push(`- ${a.code}|${a.base_hours}h|${a.name}: ${desc}`);
        }
    }

    return lines.join('\n');
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

        // Fetch activity catalog filtered by tech category (HYBRID APPROACH)
        const techCategory = body.suggestedTechCategory || 'MULTI';
        const catalogActivities = await fetchCatalogActivities(techCategory);
        const catalogForPrompt = formatCatalogForPrompt(catalogActivities);

        console.log('[ai-generate-preset] Calling OpenAI for preset generation...', {
            requestId,
            catalogSize: catalogActivities.length,
            techCategory
        });

        const systemPrompt = `You are a Technical Estimator creating ACTIVITY PRESETS for estimating SOFTWARE REQUIREMENTS. Respond with JSON only.

**GOAL**:
Generate a list of standard activities for implementing SINGLE REQUIREMENTS using the specified technology.
Focus on ATOMIC WORK UNITS, not project phases.

**HYBRID ACTIVITY SELECTION** (IMPORTANT):
1. FIRST check the ACTIVITY CATALOG below - if a suitable activity exists, SELECT IT by code
2. ONLY create NEW activities if nothing in the catalog fits the need
3. For existing activities, you can suggest different hours if context requires it
4. Prefer catalog activities for consistency and reusability

**CONTEXT AWARENESS (LIFECYCLE)**:
- **Greenfield**: Include setup/scaffolding activities if relevant
- **Brownfield**: Focus on Integration, Refactoring, Extending existing code

**ACTIVITY TYPES IN OUTPUT**:
- FOR EXISTING (from catalog): set "existingCode" to the activity code
- FOR NEW (AI-generated): set "isNew": true and provide title/description

**CRITICAL RULES**:
1. Activities must be REUSABLE building blocks
2. Language: SAME AS USER INPUT
3. Select 8-15 activities total (prefer 60%+ from catalog if applicable)
4. **group** MUST be one of: ANALYSIS, DEV, TEST, OPS, GOVERNANCE (never use QA, TESTING, or other values)

**OUTPUT FORMAT (valid JSON)**:
{
  "success": true,
  "preset": {
    "name": "Technology name (max 50 chars)",
    "description": "Tech stack description (80-120 chars)",
    "detailedDescription": "Technical details (150-200 words MAX)",
    "techCategory": "FRONTEND" | "BACKEND" | "MULTI" | "POWER_PLATFORM",
    "activities": [
      {
        "existingCode": "PP_DV_FORM_SM",
        "title": "Configurazione form Dataverse (Simple)",
        "description": "Form con pochi campi e layout standard",
        "group": "DEV",
        "estimatedHours": 16,
        "priority": "core",
        "confidence": 0.9,
        "reasoning": "Selected from catalog - matches form requirements"
      },
      {
        "isNew": true,
        "title": "Custom Activity Name",
        "description": "What is done in this activity",
        "group": "TEST",
        "estimatedHours": 8,
        "priority": "recommended",
        "confidence": 0.7,
        "reasoning": "Created new - no catalog match for this specific need"
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
Suggested Category: ${techCategory}

${catalogForPrompt}

Generate a preset with 8-15 activities. Prefer selecting from the catalog above when appropriate. Return JSON only.`;

        const startTime = Date.now();

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.2,
            max_tokens: 2000, // Slightly increased to accommodate catalog + hybrid output
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

            // Track hybrid activity breakdown
            const existingCount = result.preset.activities.filter((a: any) => a.existingCode).length;
            const newCount = result.preset.activities.filter((a: any) => a.isNew).length;
            console.log('[ai-generate-preset] Hybrid activity breakdown:', {
                total: result.preset.activities.length,
                fromCatalog: existingCount,
                newlyCreated: newCount,
                catalogPercentage: ((existingCount / result.preset.activities.length) * 100).toFixed(0) + '%',
                requestId
            });
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
