import OpenAI from 'openai';

// Initialize OpenAI with server-side API key
let openaiInstance: OpenAI | null = null;

/**
 * Get configured OpenAI client instance
 * @returns OpenAI client
 * @throws Error if API key is not configured
 */
export function getOpenAIClient(): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured on server');
    }

    if (!openaiInstance) {
        openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    return openaiInstance;
}

/**
 * Check if OpenAI is configured
 * @returns true if API key is present
 */
export function isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}
