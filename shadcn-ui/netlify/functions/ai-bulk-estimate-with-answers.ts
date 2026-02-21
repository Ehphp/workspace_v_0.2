/**
 * Netlify Function: AI Bulk Estimate from Interview
 * 
 * Generates estimations for multiple requirements based on interview answers.
 * Each answer can impact multiple requirements depending on its scope.
 * 
 * POST /.netlify/functions/ai-bulk-estimate-with-answers
 */

import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';
import { createBulkEstimatePrompt } from './lib/ai/prompt-templates';
import { searchSimilarActivities, isVectorSearchEnabled } from './lib/ai/vector-search';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-bulk-estimate-with-answers',
    requireAuth: false, // Auth is optional, logged but not enforced
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.requirements || !Array.isArray(body.requirements) || body.requirements.length === 0) {
            return 'Almeno un requisito è obbligatorio.';
        }
        if (!body.answers || Object.keys(body.answers).length === 0) {
            return 'Le risposte all\'intervista sono obbligatorie.';
        }
        if (!body.activities || body.activities.length === 0) {
            return 'Il catalogo delle attività è obbligatorio.';
        }
        return null;
    },

    handler: async (body, ctx) => {
        // Get OpenAI client with bulk timeout (28s)
        const openai = getOpenAIClient({ timeout: 28000, maxRetries: 0 });
        // Use vector search for more relevant activities (Phase 2)
        let activitiesToUse: Activity[] = body.activities;
        let searchMethod = 'frontend-provided';

        if (isVectorSearchEnabled() && body.techCategory) {
            try {
                console.log('[ai-bulk-estimate] Using vector search for activity retrieval');

                // Combine all requirement descriptions for a comprehensive search
                const combinedContext = body.requirements
                    .map(r => `${r.title}: ${r.description || ''}`)
                    .join('\n')
                    .substring(0, 2000); // Limit combined context

                const techCategories = [body.techCategory, 'MULTI'];
                const searchResult = await searchSimilarActivities(
                    combinedContext,
                    techCategories,
                    25, // Top-25 for bulk (limited for speed)
                    0.4
                );

                if (searchResult.results.length > 0) {
                    activitiesToUse = searchResult.results.map(r => ({
                        code: r.code,
                        name: r.name,
                        description: r.description || '',
                        base_hours: r.base_hours,
                        group: r.group,
                        tech_category: r.tech_category,
                    }));
                    searchMethod = searchResult.metrics.usedFallback ? 'vector-fallback' : 'vector';
                    console.log(`[ai-bulk-estimate] Vector search returned ${activitiesToUse.length} activities in ${searchResult.metrics.latencyMs}ms`);
                }
            } catch (err) {
                console.warn('[ai-bulk-estimate] Vector search failed, using provided activities:', err);
            }
        }

        console.log('[ai-bulk-estimate] Processing request:', {
            requirementsCount: body.requirements.length,
            answersCount: Object.keys(body.answers).length,
            activitiesCount: activitiesToUse.length,
            techCategory: body.techCategory,
            searchMethod,
        });

        // Build system prompt using shared templates
        const systemPrompt = createBulkEstimatePrompt(body.techCategory, body.requirements.length);

        // Build user prompt - ULTRA COMPACT with count
        const requirementsText = formatRequirementsForPrompt(body.requirements);
        const answersText = formatAnswersForPrompt(body.answers);
        const activitiesText = formatActivitiesForPrompt(activitiesToUse);

        const userPrompt = `${body.requirements.length} REQ(stima TUTTI 0-${body.requirements.length - 1}):\n${requirementsText}\nA:${answersText}\nC:${activitiesText}`;

        console.log('[ai-bulk-estimate] Prompt length:', {
            system: systemPrompt.length,
            user: userPrompt.length,
        });

        // Calculate dynamic max_tokens based on requirements count
        // Each estimation needs ~60 tokens, plus overhead
        const maxTokens = Math.min(4000, 500 + body.requirements.length * 80);

        // Call OpenAI - NO structured output for speed
        const startTime = Date.now();
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

        // Return data directly (createAIHandler wraps with statusCode/headers)
        return {
            success: true,
            ...result,
        };
    }
});
