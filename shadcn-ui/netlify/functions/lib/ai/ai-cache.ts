/**
 * AI Response Cache — Redis-backed
 *
 * Caches deterministic AI responses (normalize, generate-title, suggest-activities)
 * to reduce OpenAI API costs for repeated identical inputs.
 *
 * Design principles:
 * - Graceful degradation: if Redis is down, returns null (cache miss) silently
 * - Feature flag: AI_CACHE_ENABLED=false disables all caching
 * - TTL differentiated per action type
 * - Cache keys are SHA-256 hashes of normalized input parts
 */

import { createHash } from 'crypto';
import { tryGetRedisClient } from '../security/redis-client';

// Feature flag — default enabled
const AI_CACHE_ENABLED = () => process.env.AI_CACHE_ENABLED !== 'false';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CacheConfig {
    /** Redis key prefix, e.g. 'ai:norm', 'ai:title', 'ai:suggest' */
    prefix: string;
    /** Time-to-live in seconds */
    ttlSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured cache profiles
// ─────────────────────────────────────────────────────────────────────────────

/** 24 hours — output is stable for same description */
export const CACHE_NORMALIZE: CacheConfig = {
    prefix: 'ai:norm',
    ttlSeconds: 24 * 60 * 60,
};

/** 24 hours — deterministic title generation */
export const CACHE_TITLE: CacheConfig = {
    prefix: 'ai:title',
    ttlSeconds: 24 * 60 * 60,
};

/** 12 hours — may change with activity catalog updates */
export const CACHE_SUGGEST: CacheConfig = {
    prefix: 'ai:suggest',
    ttlSeconds: 12 * 60 * 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from an array of string parts.
 * Returns `{prefix}:{sha256}`.
 */
export function buildCacheKey(parts: string[], config: CacheConfig): string {
    const joined = parts.join('|');
    const hash = createHash('sha256').update(joined).digest('hex');
    return `${config.prefix}:${hash}`;
}

/**
 * Retrieve a cached AI response.
 *
 * @returns Parsed value or `null` on miss / error / disabled
 */
export async function getCachedResponse<T>(
    key: string,
    config: CacheConfig,
): Promise<T | null> {
    if (!AI_CACHE_ENABLED()) return null;

    try {
        const client = await tryGetRedisClient();
        if (!client) return null;
        const raw = await client.get(key) as string | null;
        if (raw === null) {
            console.log(`[ai-cache] MISS ${config.prefix} key=${key.slice(-12)}`);
            return null;
        }
        console.log(`[ai-cache] HIT ${config.prefix} key=${key.slice(-12)}`);
        return JSON.parse(raw) as T;
    } catch (err) {
        console.warn(`[ai-cache] GET error (graceful degradation):`, err);
        return null;
    }
}

/**
 * Store an AI response in cache.
 *
 * Silently swallows errors (fire-and-forget).
 */
export async function setCachedResponse<T>(
    key: string,
    value: T,
    config: CacheConfig,
): Promise<void> {
    if (!AI_CACHE_ENABLED()) return;

    try {
        const client = await tryGetRedisClient();
        if (!client) return;
        await client.setEx(key, config.ttlSeconds, JSON.stringify(value));
        console.log(`[ai-cache] SET ${config.prefix} key=${key.slice(-12)} ttl=${config.ttlSeconds}s`);
    } catch (err) {
        console.warn(`[ai-cache] SET error (graceful degradation):`, err);
    }
}
