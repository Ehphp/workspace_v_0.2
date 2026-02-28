import OpenAI from 'openai';

/**
 * Agnostic LLM Gateway Interface
 * Allows switching providers (e.g., OpenAI, Anthropic, Bedrock) transparently.
 */
export interface ILLMProvider {
    /**
     * Given a system prompt, user prompt, and an optional structured output schema,
     * returns the generated content as a string.
     */
    generateContent(params: GenerateContentParams): Promise<string>;
}

export interface GenerateContentParams {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: Record<string, any>;
    options?: LLMClientOptions;
}

/**
 * LLM client configuration options
 */
export interface LLMClientOptions {
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Max retries on failure (default: 0 for fail-fast) */
    maxRetries?: number;
}

/**
 * Preset configurations for common use cases
 */
export const LLM_PRESETS = {
    /** Quick operations like title generation (20s timeout) */
    quick: { timeout: 20000, maxRetries: 0 },
    /** Standard operations like questions, suggestions (30s timeout) */
    standard: { timeout: 30000, maxRetries: 0 },
    /** Bulk operations with multiple items (28s for Lambda limit) */
    bulk: { timeout: 28000, maxRetries: 0 },
    /** Complex operations like preset generation (50s timeout) */
    complex: { timeout: 50000, maxRetries: 0 },
    /** Long-running operations near Netlify limit (55s timeout) */
    extended: { timeout: 55000, maxRetries: 0 },
} as const;

// Cache for client instances by config key
const clientCache = new Map<string, OpenAI>();

/**
 * OpenAI implementation of the ILLMProvider
 */
export class OpenAIProvider implements ILLMProvider {
    private getClient(options?: LLMClientOptions | keyof typeof LLM_PRESETS): OpenAI {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured on server');
        }

        const resolvedOptions: LLMClientOptions =
            typeof options === 'string'
                ? LLM_PRESETS[options]
                : options ?? LLM_PRESETS.standard;

        const timeout = resolvedOptions.timeout ?? 30000;
        const maxRetries = resolvedOptions.maxRetries ?? 0;

        const cacheKey = `${timeout}-${maxRetries}`;

        if (clientCache.has(cacheKey)) {
            return clientCache.get(cacheKey)!;
        }

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout,
            maxRetries,
        });

        clientCache.set(cacheKey, client);
        return client;
    }

    async generateContent(params: GenerateContentParams): Promise<string> {
        const client = this.getClient(params.options);

        const response = await client.chat.completions.create({
            model: params.model,
            messages: [
                { role: 'system', content: params.systemPrompt },
                { role: 'user', content: params.userPrompt },
            ],
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 1000,
            ...(params.responseFormat ? { response_format: params.responseFormat as any } : {}),
        });

        const output = response.choices[0]?.message?.content;
        if (!output) {
            throw new Error('No content returned from OpenAI');
        }

        return output;
    }
}

/**
 * Check if the LLM provider is configured
 * @returns true if API key is present
 */
export function isLLMConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Clear the client cache (useful for testing)
 */
export function clearLLMClientCache(): void {
    clientCache.clear();
}

/**
 * Gets a configured instance of the preferred LLM Provider.
 */
export function getDefaultProvider(): ILLMProvider {
    return new OpenAIProvider();
}

