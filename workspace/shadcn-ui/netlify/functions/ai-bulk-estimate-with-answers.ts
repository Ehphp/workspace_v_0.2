/**
 * Netlify Function: AI Bulk Estimate from Interview
 * 
 * Generates estimations for multiple requirements based on interview answers.
 * Each answer can impact multiple requirements depending on its scope.
 * 
 * POST /.netlify/functions/ai-bulk-estimate-with-answers
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';

interface RequirementInput {
    id: string;
    reqId: string;
    title: string;
    description: string;
    techPresetId: string | null;
}

interface BulkInterviewAnswer {
    questionId: string;
    scope: 'global' | 'multi-requirement' | 'specific';
    affectedRequirementIds: string[];
    category: string;
    value: string | string[] | number;
}

interface Activity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
}

interface RequestBody {
    requirements: RequirementInput[];
    techCategory: string;
    answers: Record<string, BulkInterviewAnswer>;
    activities: Activity[];
}

/**
 * System prompt for generating bulk estimates - ULTRA FAST
 */
const SYSTEM_PROMPT = `Stima TUTTI i {TECH_CATEGORY} req (idx 0 a N-1). Per OGNI req: attività + totalBaseDays=sum(h)/8.
JSON:{"estimations":[{"idx":0,"activities":[{"code":"X","baseHours":4}],"totalBaseDays":0.5,"confidenceScore":0.8},{"idx":1,...},...]}`;

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
        timeout: 28000, // 28s - must finish before 30s lambda limit
        maxRetries: 0,
    });
}

/**
 * Format requirements for prompt - INDEX BASED (no UUIDs)
 */
function formatRequirementsForPrompt(requirements: RequirementInput[]): string {
    return requirements.map((req, i) => `${i}:${req.title.slice(0, 30)}`).join('|');
}

/**
 * Format answers for prompt - ULTRA COMPACT
 */
function formatAnswersForPrompt(answers: Record<string, BulkInterviewAnswer>): string {
    return Object.values(answers).map(a => {
        const v = Array.isArray(a.value) ? a.value.join(',') : String(a.value);
        const scope = a.scope === 'global' ? 'G' : a.scope === 'multi-requirement' ? 'M' : 'S';
        return `${scope}:${v}`;
    }).join(';');
}

/**
 * Format activities catalog for prompt - TOP 20 ONLY
 */
function formatActivitiesForPrompt(activities: Activity[]): string {
    // Take only first 20 activities to reduce tokens
    return activities.slice(0, 20).map(a => `${a.code}:${a.base_hours}`).join(',');
}

/**
 * Main handler
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    // Only POST allowed
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    // Check origin
    if (!isOriginAllowed(origin)) {
        console.warn('[ai-bulk-estimate] Blocked request from origin:', origin);
        return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Origin not allowed' }),
        };
    }

    try {
        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');

        // Validate requirements
        if (!body.requirements || !Array.isArray(body.requirements) || body.requirements.length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Almeno un requisito è obbligatorio.'
                }),
            };
        }

        // Validate answers
        if (!body.answers || Object.keys(body.answers).length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Le risposte all\'intervista sono obbligatorie.'
                }),
            };
        }

        // Validate activities
        if (!body.activities || body.activities.length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Il catalogo delle attività è obbligatorio.'
                }),
            };
        }

        // Validate auth
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (authHeader) {
            const authResult = await validateAuthToken(authHeader);
            if (!authResult.ok) {
                console.log('[ai-bulk-estimate] Auth validation:', authResult.message);
            }
        }

        console.log('[ai-bulk-estimate] Processing request:', {
            requirementsCount: body.requirements.length,
            answersCount: Object.keys(body.answers).length,
            activitiesCount: body.activities.length,
            techCategory: body.techCategory,
        });

        // Build system prompt
        const systemPrompt = SYSTEM_PROMPT.replace(/{TECH_CATEGORY}/g, body.techCategory);

        // Build user prompt - ULTRA COMPACT with count
        const requirementsText = formatRequirementsForPrompt(body.requirements);
        const answersText = formatAnswersForPrompt(body.answers);
        const activitiesText = formatActivitiesForPrompt(body.activities);

        const userPrompt = `${body.requirements.length} REQ(stima TUTTI 0-${body.requirements.length - 1}):\n${requirementsText}\nA:${answersText}\nC:${activitiesText}`;

        console.log('[ai-bulk-estimate] Prompt length:', {
            system: systemPrompt.length,
            user: userPrompt.length,
        });

        // Call OpenAI - NO structured output for speed
        const openai = getOpenAIClient();
        const startTime = Date.now();

        // Calculate dynamic max_tokens based on requirements count
        // Each estimation needs ~60 tokens, plus overhead
        const maxTokens = Math.min(4000, 500 + body.requirements.length * 80);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
        });

        const elapsed = Date.now() - startTime;
        console.log('[ai-bulk-estimate] OpenAI response received:', {
            elapsed: `${elapsed}ms`,
            tokens: response.usage?.total_tokens,
        });

        // Parse response
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const result = JSON.parse(content);

        // Ensure estimations array exists and map indices back to UUIDs
        const rawEstimations = result.estimations || [];
        result.estimations = rawEstimations.map((e: any) => {
            const idx = e.idx ?? e.index ?? 0;
            const req = body.requirements[idx];
            return {
                requirementId: req?.id || '',
                reqCode: req?.reqId || `REQ-${idx}`,
                activities: e.activities || [],
                totalBaseDays: e.totalBaseDays || 0,
                confidenceScore: e.confidenceScore || 0.8,
                success: true,
            };
        });

        // Fill in missing requirements with empty estimations
        const estimatedIds = new Set(result.estimations.map((e: any) => e.requirementId));
        for (const req of body.requirements) {
            if (!estimatedIds.has(req.id)) {
                result.estimations.push({
                    requirementId: req.id,
                    reqCode: req.reqId,
                    activities: [],
                    totalBaseDays: 0,
                    confidenceScore: 0.5,
                    success: false,
                });
            }
        }

        // Build summary
        const totalDays = result.estimations.reduce((sum: number, e: any) => sum + (e.totalBaseDays || 0), 0);
        const avgConf = result.estimations.length > 0
            ? result.estimations.reduce((sum: number, e: any) => sum + (e.confidenceScore || 0.8), 0) / result.estimations.length
            : 0;
        result.summary = {
            totalRequirements: body.requirements.length,
            successfulEstimations: result.estimations.filter((e: any) => e.success !== false).length,
            failedEstimations: result.estimations.filter((e: any) => e.success === false).length,
            totalBaseDays: Math.round(totalDays * 10) / 10,
            avgConfidenceScore: Math.round(avgConf * 100) / 100,
        };

        console.log('[ai-bulk-estimate] Estimations generated:', {
            total: result.estimations.length,
            successful: result.summary.successfulEstimations,
            failed: result.summary.failedEstimations,
            totalDays: result.summary.totalBaseDays,
            avgConfidence: result.summary.avgConfidenceScore,
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                ...result,
            }),
        };

    } catch (error) {
        console.error('[ai-bulk-estimate] Error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');

        return {
            statusCode: isTimeout ? 504 : 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                estimations: [],
                summary: {
                    totalRequirements: 0,
                    successfulEstimations: 0,
                    failedEstimations: 0,
                    totalBaseDays: 0,
                    avgConfidenceScore: 0,
                },
                error: isTimeout
                    ? 'Timeout durante la generazione delle stime. Prova con meno requisiti.'
                    : `Errore durante la generazione: ${errorMessage}`,
            }),
        };
    }
};
