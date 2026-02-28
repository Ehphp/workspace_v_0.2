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
        const model = params.model;
        const isNewModel = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');

        if (isNewModel) {
            return this.generateContentResponsesAPI(client, params);
        }
        return this.generateContentChatCompletions(client, params);
    }

    // ── Responses API (gpt-5, o-series) ────────────────────────────────────
    private async generateContentResponsesAPI(
        client: OpenAI,
        params: GenerateContentParams,
    ): Promise<string> {
        const model = params.model;
        const tokenLimit = params.maxTokens ?? 1000;

        // Build text.format for Responses API
        let textFormat: Record<string, any> = { type: 'text' };
        if (params.responseFormat?.type === 'json_schema' && params.responseFormat.json_schema) {
            textFormat = {
                type: 'json_schema',
                ...params.responseFormat.json_schema,   // name, strict, schema
            };
        } else if (params.responseFormat?.type === 'json_object') {
            textFormat = { type: 'json_object' };
        }

        const instructions = params.systemPrompt;
        const input = params.userPrompt;

        console.log(`[openai-client] Responses API call — model=${model}, max_output_tokens=${tokenLimit}, format=${textFormat.type}`);

        let response: any;
        let lastError: any;
        const maxAttempts = 2;       // 1 retry on empty output

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                response = await (client as any).responses.create({
                    model,
                    instructions,
                    input,
                    max_output_tokens: tokenLimit,
                    text: { format: textFormat },
                });
            } catch (apiError: any) {
                console.error(`[openai-client] Responses API error (attempt ${attempt}):`, apiError?.message || apiError);
                lastError = apiError;
                if (attempt < maxAttempts) continue;
                throw apiError;
            }

            // Log request id and status for debugging
            const requestId = response?.id || response?.request_id || 'unknown';
            const status = response?.status || 'unknown';
            console.log(`[openai-client] Responses API request_id=${requestId}, status=${status}`);

            // Detect incomplete response (max_output_tokens exhausted by reasoning)
            if (response?.status === 'incomplete' && response?.incomplete_details?.reason) {
                console.warn(`[openai-client] Response incomplete: ${response.incomplete_details.reason}`);
            }

            // Extract text — Responses API returns output_text (string)
            let text: string | undefined | null = response?.output_text;

            // Fallback: iterate output items
            if (!text && Array.isArray(response?.output)) {
                for (const item of response.output) {
                    if (item?.type === 'message' && Array.isArray(item.content)) {
                        for (const part of item.content) {
                            if (part?.type === 'output_text' && part.text) {
                                text = part.text;
                                break;
                            }
                        }
                    }
                    if (text) break;
                }
            }

            if (text && text.trim()) {
                return text;
            }

            console.warn(`[openai-client] Empty output on attempt ${attempt}/${maxAttempts}. Raw response keys:`, Object.keys(response || {}));
            if (attempt < maxAttempts) {
                console.log('[openai-client] Retrying...');
            }
            lastError = new Error('Empty model output');
        }

        // All attempts exhausted
        console.error('[openai-client] Raw OpenAI response:', JSON.stringify(response, null, 2).substring(0, 2000));
        throw lastError || new Error('Empty model output after retries');
    }

    // ── Chat Completions API (gpt-4o-mini, gpt-4o legacy) ─────────────────
    private async generateContentChatCompletions(
        client: OpenAI,
        params: GenerateContentParams,
    ): Promise<string> {
        const model = params.model;
        const tokenLimit = params.maxTokens ?? 1000;

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: params.systemPrompt },
                { role: 'user', content: params.userPrompt },
            ],
            temperature: params.temperature ?? 0.7,
            max_tokens: tokenLimit,
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

