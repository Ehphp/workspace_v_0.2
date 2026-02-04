/**
 * Rate Limiter with Redis Backend
 * Uses Lua script for atomic operations
 */

import { createClient, RedisClientType } from 'redis';

// Configurable rate limiting
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 50);
const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client singleton
let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    redisClient = createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => {
                if (retries > 3) return new Error('Redis connection failed');
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('error', (err) => {
        console.error('[rate-limiter] Redis error:', err);
    });

    await redisClient.connect();
    return redisClient;
}

// Fallback in-memory rate limiting (if Redis unavailable)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
}

/**
 * Lua script for atomic rate limit check
 * Returns: [current_count, ttl] or nil if allowed
 */
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local max = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('GET', key)
if current == false then
    redis.call('SETEX', key, window, 1)
    return {1, window}
end

current = tonumber(current)
if current >= max then
    local ttl = redis.call('TTL', key)
    return {current, ttl}
end

redis.call('INCR', key)
return {current + 1, window}
`;

/**
 * Check if request is within rate limit (Redis-backed)
 * Falls back to in-memory if Redis unavailable
 * 
 * @param key - Identifier for rate limiting (user ID or IP)
 * @returns Rate limit result with retry-after if exceeded
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
    try {
        const client = await getRedisClient();

        // Execute Lua script atomically
        const result = await client.eval(RATE_LIMIT_SCRIPT, {
            keys: [`ratelimit:${key}`],
            arguments: [RATE_LIMIT_MAX.toString(), Math.ceil(RATE_LIMIT_WINDOW_MS / 1000).toString()]
        }) as [number, number];

        const [currentCount, ttl] = result;

        if (currentCount > RATE_LIMIT_MAX) {
            return {
                allowed: false,
                retryAfter: ttl
            };
        }

        return { allowed: true };

    } catch (error) {
        console.warn('[rate-limiter] Redis error, falling back to in-memory:', error);
        return checkRateLimitInMemory(key);
    }
}

/**
 * Fallback in-memory rate limiter
 */
function checkRateLimitInMemory(key: string): RateLimitResult {
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

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}
