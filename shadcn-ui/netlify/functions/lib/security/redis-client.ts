/**
 * Shared Redis Client Singleton
 * 
 * Extracted from rate-limiter.ts to be reused across rate limiting,
 * AI caching, and other Redis-backed features.
 * 
 * Provides two access patterns:
 *   - getRedisClient()     — throws if Redis is down (legacy)
 *   - tryGetRedisClient()  — returns null if Redis is down (preferred)
 */

import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client singleton
let redisClient: RedisClientType | null = null;
let connectionFailed = false;
let redisErrorLogged = false;

/**
 * Internal: create + connect a Redis client.
 * Throws on failure.
 */
async function connectRedis(): Promise<RedisClientType> {
    const client = createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => {
                if (retries > 3) {
                    connectionFailed = true;
                    return new Error('Redis connection failed');
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    client.on('error', (err) => {
        if (!redisErrorLogged) {
            console.warn(`[redis-client] Redis unavailable at ${REDIS_URL} — graceful degradation active`);
            redisErrorLogged = true;
        }
    });

    await client.connect();
    return client as any;
}

/**
 * Get or create Redis client singleton.
 * **Throws** if Redis is unavailable.
 */
export async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }
    redisClient = await connectRedis();
    connectionFailed = false;
    return redisClient;
}

/**
 * Try to get the Redis client singleton.
 * Returns **null** (instead of throwing) when Redis is unavailable.
 * After a connection failure the function short-circuits for the
 * rest of the process lifetime to avoid repeated 5 s waits.
 */
export async function tryGetRedisClient(): Promise<RedisClientType | null> {
    if (connectionFailed) return null;
    try {
        return await getRedisClient();
    } catch {
        connectionFailed = true;
        return null;
    }
}

/**
 * Close Redis connection (for graceful shutdown).
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}
