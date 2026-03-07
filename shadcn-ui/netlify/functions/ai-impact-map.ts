/**
 * Netlify Function: AI Impact Map
 *
 * Dedicated authenticated endpoint that generates a structured
 * Impact Map artifact from a requirement description.
 *
 * This artifact captures the AI's architectural assessment: which system
 * layers are affected, what action type is required, and which components
 * are involved — giving the user an inspectable map before proceeding
 * to the technical interview and estimation.
 *
 * POST /.netlify/functions/ai-impact-map
 */

import { createAIHandler } from './lib/handler';
import { generateImpactMap } from './lib/ai/actions/generate-impact-map';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
}

interface RequestBody {
    description: string;
    techCategory?: string;
    techPresetId?: string;
    projectContext?: ProjectContext;
    requirementUnderstanding?: Record<string, unknown>;
    testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-impact-map',
    requireAuth: true,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description) {
            return 'Missing required field: description';
        }
        if (typeof body.description !== 'string') {
            return 'Field description must be a string';
        }
        if (body.description.trim().length < 15) {
            return 'Description must be at least 15 characters (La descrizione deve contenere almeno 15 caratteri)';
        }
        if (body.description.length > 2000) {
            return 'Description must be at most 2000 characters (La descrizione è troppo lunga, max 2000 caratteri)';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const startMs = Date.now();

        const semanticDescription = ctx.sanitize(body.description);
        const inputDescriptionLength = body.description.length;

        console.log(
            `[ai-impact-map] Description: ${inputDescriptionLength} chars, tech: ${body.techCategory ?? 'none'}, understanding: ${!!body.requirementUnderstanding}`,
        );

        const result = await generateImpactMap({
            description: semanticDescription,
            techCategory: body.techCategory,
            projectContext: body.projectContext,
            requirementUnderstanding: body.requirementUnderstanding,
            testMode: body.testMode,
        });

        const totalMs = Date.now() - startMs;

        return {
            success: true,
            impactMap: result,
            metadata: {
                generatedAt: new Date().toISOString(),
                model: 'gpt-4o-mini',
                techCategory: body.techCategory,
                inputDescriptionLength,
                hasRequirementUnderstanding: !!body.requirementUnderstanding,
            },
            metrics: {
                totalMs,
                llmMs: totalMs,
                model: 'gpt-4o-mini',
            },
        };
    },
});
