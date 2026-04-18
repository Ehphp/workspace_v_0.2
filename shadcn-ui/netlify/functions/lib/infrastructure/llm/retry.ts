/**
 * Retry with exponential backoff + jitter for transient errors.
 *
 * Designed to wrap OpenAI SDK calls. The retry layer sits *inside*
 * the circuit breaker so that only exhausted-retry failures count
 * towards the CB failure threshold.
 *
 * @module retry
 * @since Sprint 3 (S3-2)
 */

export interface RetryOptions {
    /** Max number of retries (default: 2) */
    maxRetries?: number;
    /** Initial delay in ms (default: 1000) */
    initialDelayMs?: number;
    /** Backoff multiplier (default: 2) */
    backoffMultiplier?: number;
    /** Max delay cap in ms (default: 10000) */
    maxDelayMs?: number;
    /** Predicate to decide if an error should be retried */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    /** Name for logging */
    name?: string;
}

/**
 * Default predicate: retry on transient / rate-limit / network errors
 * from the OpenAI SDK or raw network layer.
 */
export const DEFAULT_SHOULD_RETRY = (error: unknown): boolean => {
    if (!error) return false;
    const err = error as any;

    // OpenAI rate limit
    if (err.status === 429) return true;
    // OpenAI server errors
    if (err.status >= 500 && err.status < 600) return true;
    // Network timeout / reset
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return true;
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return true;
    // OpenAI SDK timeout wrapper
    if (err.message?.includes('timeout')) return true;
    // Empty model output (retryable — may succeed on second attempt)
    if (err.message === 'Empty model output') return true;

    return false;
};

/**
 * Execute `fn` with exponential backoff retry.
 *
 * Jitter of ±25 % is applied to each delay to prevent thundering-herd
 * when multiple Netlify Function instances retry simultaneously after
 * a shared 429.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = 2,
        initialDelayMs = 1000,
        backoffMultiplier = 2,
        maxDelayMs = 10_000,
        shouldRetry = DEFAULT_SHOULD_RETRY,
        name = 'retry',
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
                throw error; // No more retries or non-retryable error
            }

            const baseDelay = Math.min(
                initialDelayMs * backoffMultiplier ** attempt,
                maxDelayMs,
            );
            // Add jitter (±25 %) to prevent thundering herd
            const jitter = baseDelay * (0.75 + Math.random() * 0.5);
            const roundedDelay = Math.round(jitter);

            console.warn(
                `[${name}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${(error as Error)?.message?.substring(0, 120)}. Retrying in ${roundedDelay}ms…`,
            );

            await new Promise((resolve) => setTimeout(resolve, roundedDelay));
        }
    }

    throw lastError;
}
