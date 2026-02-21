import OpenAI from 'openai';

/**
 * OpenAI client configuration options
 */
export interface OpenAIClientOptions {
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Max retries on failure (default: 0 for fail-fast) */
    maxRetries?: number;
}

/**
 * Preset configurations for common use cases
 */
export const OPENAI_PRESETS = {
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
 * Get configured OpenAI client instance
 * 
 * @param options - Configuration options or preset name
 * @returns OpenAI client configured with specified options
 * @throws Error if API key is not configured
 * 
 * @example
 * // Using preset
 * const client = getOpenAIClient('bulk');
 * 
 * @example
 * // Using custom options
 * const client = getOpenAIClient({ timeout: 45000 });
 * 
 * @example
 * // Default configuration
 * const client = getOpenAIClient();
 */
export function getOpenAIClient(
    options?: OpenAIClientOptions | keyof typeof OPENAI_PRESETS
): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured on server');
    }

    // Resolve preset name to options
    const resolvedOptions: OpenAIClientOptions =
        typeof options === 'string'
            ? OPENAI_PRESETS[options]
            : options ?? OPENAI_PRESETS.standard;

    const timeout = resolvedOptions.timeout ?? 30000;
    const maxRetries = resolvedOptions.maxRetries ?? 0;

    // Create cache key from options
    const cacheKey = `${timeout}-${maxRetries}`;

    // Return cached instance if available
    if (clientCache.has(cacheKey)) {
        return clientCache.get(cacheKey)!;
    }

    // Create new instance
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout,
        maxRetries,
    });

    // Cache and return
    clientCache.set(cacheKey, client);
    return client;
}

/**
 * Check if OpenAI is configured
 * @returns true if API key is present
 */
export function isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Clear the client cache (useful for testing)
 */
export function clearOpenAIClientCache(): void {
    clientCache.clear();
}
