// Configurable rate limiting
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 50);
const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);

// Simple in-memory rate limiting (per IP or user)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
}

/**
 * Check if request is within rate limit
 * @param key - Identifier for rate limiting (user ID or IP)
 * @returns Rate limit result with retry-after if exceeded
 */
export function checkRateLimit(key: string): RateLimitResult {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry) {
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return { allowed: true };
    }

    const elapsed = now - entry.windowStart;
    if (elapsed > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return { allowed: true };
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
        return { allowed: false, retryAfter };
    }

    entry.count += 1;
    rateLimitMap.set(key, entry);
    return { allowed: true };
}
