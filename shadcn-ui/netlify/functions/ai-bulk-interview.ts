/**
 * Netlify Function: AI Bulk Interview - Question Generation
 * 
 * Analyzes multiple requirements and generates aggregated questions.
 * Questions are optimized to:
 * - Reduce total questions (6-10 instead of N × 4-6)
 * - Cover common themes across requirements
 * - Identify ambiguous requirements that need clarification
 * 
 * POST /.netlify/functions/ai-bulk-interview
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

interface RequestBody {
    requirements: RequirementInput[];
    techCategory: string;
    techPresetId?: string;
    projectContext?: {
        name: string;
        description: string;
    };
}

/**
 * System prompt for generating aggregated interview questions - ULTRA FAST
 */
const SYSTEM_PROMPT = `Genera 6-8 domande per stimare requisiti {TECH_CATEGORY}.
Scope: global(tutti), multi-requirement(subset), specific(ambigui).
Tipi: single-choice, multiple-choice, range.
{TECH_SPECIFIC_GUIDANCE}`;

/**
 * Technology-specific guidance for bulk interview - MINIMAL
 */
const TECH_SPECIFIC_GUIDANCE: Record<string, string> = {
    'POWER_PLATFORM': `Focus: Dataverse, Power Apps, Power Automate, Security`,
    'BACKEND': `Focus: API, DB, Integrazioni, Testing`,
    'FRONTEND': `Focus: UI, State, API, Responsive`,
    'MULTI': `Focus: Frontend/Backend/Integration`
};

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
        timeout: 28000, // 28s timeout - must finish before 30s lambda limit
        maxRetries: 0, // No retries to avoid exceeding timeout
    });
}

/**
 * Format requirements list for prompt - ULTRA COMPACT (just IDs and short titles)
 */
function formatRequirementsForPrompt(requirements: RequirementInput[]): string {
    return requirements.map((req) =>
        `${req.reqId}:${req.title.slice(0, 60)}`
    ).join('|');
}

/**
 * JSON schema for response - minimal
 */
const OUTPUT_SCHEMA = `JSON:{"questions":[{"id":"q1","scope":"global|multi-requirement|specific","affectedRequirementIds":[],"type":"single-choice|multiple-choice|range","category":"INTEGRATION|DATA|SECURITY|TESTING|DEPLOYMENT","question":"...","options":[{"id":"o1","label":"..."}]}],"analysis":[{"reqCode":"REQ-001","complexity":"LOW|MEDIUM|HIGH"}]}`;

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
        console.warn('[ai-bulk-interview] Blocked request from origin:', origin);
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

        if (body.requirements.length > 50) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Massimo 50 requisiti per sessione di interview.'
                }),
            };
        }

        // Validate tech category
        if (!body.techCategory) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'La categoria tecnologica è obbligatoria.'
                }),
            };
        }

        // Validate auth (optional but recommended)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (authHeader) {
            const authResult = await validateAuthToken(authHeader);
            if (!authResult.ok) {
                console.log('[ai-bulk-interview] Auth validation:', authResult.message);
            }
        }

        console.log('[ai-bulk-interview] Processing request:', {
            requirementsCount: body.requirements.length,
            techCategory: body.techCategory,
            hasProjectContext: !!body.projectContext,
        });

        // Get tech-specific guidance
        const techGuidance = TECH_SPECIFIC_GUIDANCE[body.techCategory] || TECH_SPECIFIC_GUIDANCE['MULTI'];

        const openai = getOpenAIClient();
        const startTime = Date.now();

        // Build ultra-minimal prompt
        const systemPrompt = SYSTEM_PROMPT
            .replace(/{TECH_CATEGORY}/g, body.techCategory)
            .replace('{TECH_SPECIFIC_GUIDANCE}', techGuidance) + '\n' + OUTPUT_SCHEMA;

        const requirementsText = formatRequirementsForPrompt(body.requirements);
        const userPrompt = `${body.requirements.length} req: ${requirementsText}`;

        console.log('[ai-bulk-interview] Prompt length:', {
            system: systemPrompt.length,
            user: userPrompt.length,
            total: systemPrompt.length + userPrompt.length,
        });

        // Single fast API call
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: 1800, // Just enough for 6-8 questions
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
        });

        const elapsed = Date.now() - startTime;
        console.log('[ai-bulk-interview] OpenAI response:', {
            elapsed: `${elapsed}ms`,
            tokens: response.usage?.total_tokens,
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
        });

        // Parse response
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const result = JSON.parse(content);

        // Normalize questions
        const questions = (result.questions || []).map((q: any, i: number) => ({
            ...q,
            id: `q${i + 1}`,
            affectedRequirementIds: (q.affectedRequirementIds || []).filter((id: string) => id !== ''),
            options: q.options || null,
            min: q.min ?? null,
            max: q.max ?? null,
            step: q.step ?? null,
            unit: q.unit ?? null,
        }));

        // Build summary
        const summary = {
            totalRequirements: body.requirements.length,
            globalQuestions: questions.filter((q: any) => q.scope === 'global').length,
            multiReqQuestions: questions.filter((q: any) => q.scope === 'multi-requirement').length,
            specificQuestions: questions.filter((q: any) => q.scope === 'specific').length,
            avgAmbiguityScore: 0.3,
        };

        // Build requirementAnalysis from analysis if present
        const requirementAnalysis = (result.analysis || []).map((a: any) => ({
            requirementId: body.requirements.find(r => r.reqId === a.reqCode)?.id || '',
            reqCode: a.reqCode,
            complexity: a.complexity || 'MEDIUM',
            relevantQuestionIds: questions.map((q: any) => q.id),
        }));

        console.log('[ai-bulk-interview] Questions generated:', {
            total: questions.length,
            global: summary.globalQuestions,
            multiReq: summary.multiReqQuestions,
            specific: summary.specificQuestions,
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                questions,
                requirementAnalysis,
                summary,
            }),
        };

    } catch (error) {
        console.error('[ai-bulk-interview] Error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');

        return {
            statusCode: isTimeout ? 504 : 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                questions: [],
                requirementAnalysis: [],
                reasoning: '',
                summary: {
                    totalRequirements: 0,
                    globalQuestions: 0,
                    multiReqQuestions: 0,
                    specificQuestions: 0,
                    avgAmbiguityScore: 0,
                },
                error: isTimeout
                    ? 'Timeout durante l\'analisi. Prova con meno requisiti.'
                    : `Errore durante l'analisi: ${errorMessage}`,
            }),
        };
    }
};
