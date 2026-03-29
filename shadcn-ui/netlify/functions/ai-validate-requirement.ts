/**
 * Netlify Function: AI Validate Requirement
 *
 * Lightweight gate that checks whether user input is a legitimate
 * software requirement before the expensive estimation pipeline runs.
 *
 * Uses gpt-4o-mini with ~100 tokens — fast and cheap.
 *
 * POST /.netlify/functions/ai-validate-requirement
 */

import { createAIHandler } from './lib/handler';
import { validateRequirement } from './lib/ai/actions/validate-requirement';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RequestBody {
    description: string;
    testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-validate-requirement',
    requireAuth: true,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description) {
            return 'Missing required field: description';
        }
        if (typeof body.description !== 'string') {
            return 'Field description must be a string';
        }
        if (body.description.trim().length < 1) {
            return 'Description must not be empty';
        }
        if (body.description.length > 2000) {
            return 'Description must be at most 2000 characters';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const startMs = Date.now();
        const sanitizedDescription = ctx.sanitize(body.description);

        console.log(`[ai-validate-requirement] Description: ${sanitizedDescription.length} chars`);

        const result = await validateRequirement({
            description: sanitizedDescription,
            testMode: body.testMode,
        });

        const durationMs = Date.now() - startMs;
        console.log(`[ai-validate-requirement] Done in ${durationMs}ms — category: ${result.category}`);

        return {
            success: true,
            validation: result,
            durationMs,
        };
    },
});
