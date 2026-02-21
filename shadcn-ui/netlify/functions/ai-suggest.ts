/**
 * Netlify Function: AI Suggestions
 * 
 * Multi-action endpoint for:
 * - suggest-activities: Suggest activities for a requirement
 * - generate-title: Generate a title from description
 * - normalize-requirement: Normalize and validate requirement text
 * 
 * POST /.netlify/functions/ai-suggest
 */

import { createAIHandler, AIHandlerContext } from './lib/handler';
import { suggestActivities } from './lib/ai/actions/suggest-activities';
import { generateTitle } from './lib/ai/actions/generate-title';
import { normalizeRequirement } from './lib/ai/actions/normalize-requirement';

interface RequestBody {
    action?: 'suggest-activities' | 'generate-title' | 'normalize-requirement';
    description: string;
    preset?: {
        id: string;
        name: string;
        description: string;
        tech_category: string;
        default_activity_codes: string[];
        default_driver_values: Record<string, string>;
        default_risks: string[];
    };
    activities?: Array<{
        code: string;
        name: string;
        description: string;
        base_hours: number;
        group: string;
        tech_category: string;
    }>;
    testMode?: boolean;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-suggest',
    requireAuth: true,
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.description) {
            return 'Missing required field: description';
        }

        const action = body.action || 'suggest-activities';
        if (action === 'suggest-activities') {
            if (!body.preset) return 'Missing required field: preset';
            if (!body.activities) return 'Missing required field: activities';
        }

        return null;
    },

    handler: async (body, ctx) => {
        const action = body.action || 'suggest-activities';
        const sanitizedDescription = ctx.sanitize(body.description);

        console.log(`[ai-suggest] Action: ${action}, Description length: ${sanitizedDescription.length}`);

        // Handle title generation
        if (action === 'generate-title') {
            return generateTitle({ description: sanitizedDescription });
        }

        // Handle requirement normalization
        if (action === 'normalize-requirement') {
            return normalizeRequirement({
                description: sanitizedDescription,
                testMode: body.testMode
            });
        }

        // Handle activity suggestions (default)
        console.log(`[ai-suggest] Preset: ${body.preset!.name}, Activities: ${body.activities!.length}`);

        return suggestActivities({
            description: sanitizedDescription,
            preset: body.preset!,
            activities: body.activities!,
            testMode: body.testMode
        });
    }
});
