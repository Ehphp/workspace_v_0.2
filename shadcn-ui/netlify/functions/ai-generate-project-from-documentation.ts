/**
 * Netlify Function: AI Generate Project from Documentation
 *
 * Dedicated authenticated endpoint that extracts project metadata
 * and a technical blueprint from user-provided documentation text.
 *
 * Two-pass AI pipeline:
 *   Pass 1 → Project draft (name, description, context fields)
 *   Pass 2 → Technical blueprint (components, integrations, data domains)
 *
 * Does NOT persist anything — returns structured output for user review.
 *
 * POST /.netlify/functions/ai-generate-project-from-documentation
 */

import { createAIHandler } from './lib/handler';
import { generateProjectFromDocumentation } from './lib/ai/actions/generate-project-from-documentation';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RequestBody {
    sourceText: string;
    testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-generate-project-from-documentation',
    requireAuth: true,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.sourceText) {
            return 'Missing required field: sourceText';
        }
        if (typeof body.sourceText !== 'string') {
            return 'Field sourceText must be a string';
        }
        const trimmed = body.sourceText.trim();
        if (trimmed.length < 50) {
            return 'Source text must be at least 50 characters (Il testo deve contenere almeno 50 caratteri)';
        }
        if (trimmed.length > 20000) {
            return 'Source text must be at most 20000 characters (Il testo è troppo lungo, max 20000 caratteri)';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const startMs = Date.now();

        const sanitizedText = ctx.sanitizeDocument(body.sourceText);

        // Load technology catalog from Supabase for AI matching
        let technologyCatalog: Array<{ id: string; code: string; name: string }> = [];
        let activityCatalog: Array<{ code: string; name: string; group: string }> = [];
        try {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);

                // Load technologies
                const { data: techData } = await supabase
                    .from('technologies')
                    .select('id, code, name')
                    .order('name');
                if (techData) {
                    technologyCatalog = techData;
                }

                // Load activity catalog (names + groups, max 60 for prompt budget)
                const { data: actData } = await supabase
                    .from('activities')
                    .select('code, name, group')
                    .eq('active', true)
                    .order('group')
                    .limit(60);
                if (actData) {
                    activityCatalog = actData;
                }
            }
        } catch (err) {
            console.warn('[ai-generate-project-from-documentation] Failed to load catalogs:', err);
        }

        console.log(
            `[ai-generate-project-from-documentation] Source text: ${sanitizedText.length} chars, technologies: ${technologyCatalog.length}, activities: ${activityCatalog.length}`,
        );

        const result = await generateProjectFromDocumentation({
            sourceText: sanitizedText,
            technologyCatalog,
            activityCatalog,
            testMode: body.testMode,
        });

        const totalMs = Date.now() - startMs;

        return {
            success: true,
            result: {
                projectDraft: result.projectDraft,
                technicalBlueprint: result.technicalBlueprint,
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                model: 'gpt-5-mini+gpt-5',
                sourceTextLength: sanitizedText.length,
            },
            metrics: {
                totalMs,
                pass1Ms: result.metrics.pass1Ms,
                pass2Ms: result.metrics.pass2Ms,
                model: 'gpt-5-mini+gpt-5',
            },
        };
    },
});
