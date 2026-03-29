/**
 * Netlify Function: AI Requirement Understanding
 *
 * Dedicated authenticated endpoint that generates a structured
 * Requirement Understanding artifact from a raw requirement description.
 *
 * This artifact captures what the AI understood: objective, perimeter,
 * actors, state transition, assumptions, and complexity — giving the
 * user an inspectable "contract" before proceeding to estimation.
 *
 * POST /.netlify/functions/ai-requirement-understanding
 */

import { createAIHandler } from './lib/handler';
import { generateRequirementUnderstanding } from './lib/ai/actions/generate-understanding';

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
    normalizationResult?: {
        normalizedDescription: string;
    };
    testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-requirement-understanding',
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

        // Use normalizedDescription as semantic input if available,
        // otherwise fall back to the raw description
        const semanticDescription = body.normalizationResult?.normalizedDescription
            ? ctx.sanitize(body.normalizationResult.normalizedDescription)
            : ctx.sanitize(body.description);

        const inputDescriptionLength = body.description.length;

        console.log(`[ai-requirement-understanding] Description: ${inputDescriptionLength} chars, tech: ${body.techCategory ?? 'none'}, normalized: ${!!body.normalizationResult}`);

        const result = await generateRequirementUnderstanding({
            description: semanticDescription,
            techCategory: body.techCategory,
            projectContext: body.projectContext,
            testMode: body.testMode,
        });

        const totalMs = Date.now() - startMs;

        return {
            success: true,
            understanding: {
                ...result,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    model: 'gpt-4o-mini',
                    techCategory: body.techCategory,
                    inputDescriptionLength,
                },
            },
            metrics: {
                totalMs,
                llmMs: totalMs, // Action-level timing not surfaced separately; total is a safe proxy
                model: 'gpt-4o-mini',
            },
        };
    },
});
