/**
 * Netlify Function: AI Generate Questions
 * 
 * Endpoint for generating interview questions based on user's technology description.
 * This is Stage 1 of the two-stage AI preset generation flow.
 * 
 * POST /.netlify/functions/ai-generate-questions
 */

import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';
import { generateQuestions } from './lib/ai/actions/generate-questions';

interface RequestBody {
    description: string;
    userId: string;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-generate-questions',
    requireAuth: true,
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'Missing or invalid description field';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const sanitizedDescription = ctx.sanitize(body.description);

        if (sanitizedDescription.length < 20) {
            throw new Error('La descrizione deve contenere almeno 20 caratteri significativi.');
        }

        if (sanitizedDescription.length > 1000) {
            throw new Error('La descrizione è troppo lunga (max 1000 caratteri).');
        }

        // Initialize OpenAI client with 'quick' preset (20s timeout)
        const openai = getOpenAIClient('quick');

        // Generate questions
        console.log('[ai-generate-questions] Calling generateQuestions...');
        const result = await generateQuestions(
            {
                description: sanitizedDescription,
                userId: ctx.userId || body.userId || 'anonymous'
            },
            openai
        );

        // Log metadata (no PII)
        console.log('[ai-generate-questions] Result:', {
            success: result.success,
            questionCount: result.questions.length,
            hasReasoning: !!result.reasoning,
            suggestedCategory: result.suggestedTechCategory,
            descriptionLength: sanitizedDescription.length,
        });

        return result;
    }
});
