/**
 * Netlify Function: AI Suggestions (Utility actions only)
 *
 * Multi-action endpoint for:
 * - generate-title: Generate a title from description
 * - normalize-requirement: Normalize and validate requirement text
 *
 * NOTE (STEP 4): The suggest-activities action has been removed.
 * Activity selection now happens exclusively via the pipeline
 * (ai-requirement-interview + ai-estimate-from-interview).
 *
 * POST /.netlify/functions/ai-suggest
 */

import { createAIHandler } from './lib/handler';
import { generateTitle } from './lib/ai/actions/generate-title';
import { normalizeRequirement } from './lib/ai/actions/normalize-requirement';

interface RequestBody {
    action: 'generate-title' | 'normalize-requirement';
    description: string;
    testMode?: boolean;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-suggest',
    requireAuth: true,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description) {
            return 'Missing required field: description';
        }
        if (!body.action || !['generate-title', 'normalize-requirement'].includes(body.action)) {
            return 'Invalid or missing action. Allowed: generate-title, normalize-requirement';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const sanitizedDescription = ctx.sanitize(body.description);
        console.log(`[ai-suggest] Action: ${body.action}, Description length: ${sanitizedDescription.length}`);

        if (body.action === 'generate-title') {
            return generateTitle({ description: sanitizedDescription });
        }

        return normalizeRequirement({
            description: sanitizedDescription,
            testMode: body.testMode
        });
    }
});
