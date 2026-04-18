/**
 * Netlify Function: AI Suggestions (Utility actions only)
 *
 * Single-action endpoint for:
 * - generate-title: Generate a title from description
 *
 * POST /.netlify/functions/ai-suggest
 */

import { createAIHandler } from './lib/handler';
import { generateTitle } from './lib/application/actions/generate-title';

interface RequestBody {
    action: 'generate-title';
    description: string;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-suggest',
    requireAuth: true,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description) {
            return 'Missing required field: description';
        }
        if (!body.action || body.action !== 'generate-title') {
            return 'Invalid or missing action. Allowed: generate-title';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const sanitizedDescription = ctx.sanitize(body.description);
        console.log(`[ai-suggest] Action: ${body.action}, Description length: ${sanitizedDescription.length}`);

        return generateTitle({ description: sanitizedDescription });
    }
});
