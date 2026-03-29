/**
 * Netlify Function: AI Estimation Blueprint
 *
 * Dedicated authenticated endpoint that generates a structured
 * Estimation Blueprint artifact from a requirement description,
 * optionally enriched by Requirement Understanding and Impact Map.
 *
 * The Blueprint decomposes the requirement into technical components,
 * integrations, data entities, testing scope, assumptions, exclusions,
 * and uncertainties — creating a formal intermediate representation
 * between AI reasoning and activity selection.
 *
 * POST /.netlify/functions/ai-estimation-blueprint
 */

import { createAIHandler } from './lib/handler';
import { generateEstimationBlueprint } from './lib/ai/actions/generate-estimation-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
    projectType?: string;
    domain?: string;
    scope?: string;
    teamSize?: number;
    deadlinePressure?: string;
    methodology?: string;
}

interface RequestBody {
    description: string;
    techCategory?: string;
    techPresetId?: string;
    projectContext?: ProjectContext;
    requirementUnderstanding?: Record<string, unknown>;
    impactMap?: Record<string, unknown>;
    testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-estimation-blueprint',
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
            `[ai-estimation-blueprint] Description: ${inputDescriptionLength} chars, tech: ${body.techCategory ?? 'none'}, understanding: ${!!body.requirementUnderstanding}, impactMap: ${!!body.impactMap}`,
        );

        const result = await generateEstimationBlueprint({
            description: semanticDescription,
            techCategory: body.techCategory,
            projectContext: body.projectContext,
            requirementUnderstanding: body.requirementUnderstanding,
            impactMap: body.impactMap,
            testMode: body.testMode,
        });

        const totalMs = Date.now() - startMs;

        return {
            success: true,
            blueprint: result,
            metadata: {
                generatedAt: new Date().toISOString(),
                model: 'gpt-4o-mini',
                techCategory: body.techCategory,
                inputDescriptionLength,
                hasRequirementUnderstanding: !!body.requirementUnderstanding,
                hasImpactMap: !!body.impactMap,
            },
            metrics: {
                totalMs,
                llmMs: totalMs,
                model: 'gpt-4o-mini',
            },
        };
    },
});
