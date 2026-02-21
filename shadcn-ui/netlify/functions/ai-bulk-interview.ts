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

import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';
import { createBulkInterviewPrompt, TECH_SPECIFIC_BULK_FOCUS } from './lib/ai/prompt-templates';

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
 * Get system prompt for bulk interview using shared templates
 */
function getSystemPrompt(techCategory: string): string {
    const techFocus = TECH_SPECIFIC_BULK_FOCUS[techCategory] || TECH_SPECIFIC_BULK_FOCUS['MULTI'];
    return createBulkInterviewPrompt(techCategory, techFocus);
}

/**
 * Format requirements list for prompt - ULTRA COMPACT (just IDs and short titles)
 */
function formatRequirementsForPrompt(requirements: RequirementInput[]): string {
    return requirements.map((req) =>
        `${req.reqId}:${req.title.slice(0, 60)}`
    ).join('|');
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-bulk-interview',
    requireAuth: false, // Auth is optional but validated if present
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.requirements || !Array.isArray(body.requirements) || body.requirements.length === 0) {
            return 'Almeno un requisito è obbligatorio.';
        }
        if (body.requirements.length > 50) {
            return 'Massimo 50 requisiti per sessione di interview.';
        }
        if (!body.techCategory) {
            return 'La categoria tecnologica è obbligatoria.';
        }
        return null;
    },

    handler: async (body, ctx) => {
        console.log('[ai-bulk-interview] Processing request:', {
            requirementsCount: body.requirements.length,
            techCategory: body.techCategory,
            hasProjectContext: !!body.projectContext,
        });

        // Initialize OpenAI client with 'bulk' preset (28s timeout)
        const openai = getOpenAIClient('bulk');
        const startTime = Date.now();

        // Build system prompt using shared templates
        const systemPrompt = getSystemPrompt(body.techCategory);
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
            success: true,
            questions,
            requirementAnalysis,
            summary,
        };
    }
});
