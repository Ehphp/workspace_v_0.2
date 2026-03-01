/**
 * Shared Redis Client Singleton
 * 
 * Extracted from rate-limiter.ts to be reused across rate limiting,
 * AI caching, and other Redis-backed features.
 */

import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client singleton
let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client singleton.
 * 
 * Reuses existing connection if open; otherwise creates a new one.
 * Consumers should handle errors gracefully — Redis being down
 * should never break the main application flow.
 */
export async function getRedisClient(): Promise<RedisClientType> {
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
        console.error('[redis-client] Redis error:', err);
    });

    await redisClient.connect();
    return redisClient;
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
