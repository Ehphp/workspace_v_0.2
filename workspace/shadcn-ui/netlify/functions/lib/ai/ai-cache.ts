// In-memory cache for AI responses (24h TTL, resets on cold start)
const aiCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
// Ensures same requirement returns same result within the TTL window

/**
 * Generate cache key with activity codes hash
 * @param description - Requirement description
 * @param presetId - Preset ID
 * @param activityCodes - Array of activity codes
 * @returns Cache key string
 */
export function getCacheKey(description: string, presetId: string, activityCodes: string[]): string {
    const normalizedDesc = description.trim().toLowerCase().substring(0, 200);
    const activitiesHash = activityCodes.sort().join(',');
    return `${presetId}:${normalizedDesc}:${activitiesHash}`;
}

/**
 * Get cached response if available and not expired
 * @param key - Cache key
 * @returns Cached response or null
 */
export function getCachedResponse(key: string): any | null {
    const cached = aiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.response;
    }
    if (cached) {
        aiCache.delete(key); // Remove expired
    }
    return null;
}

/**
 * Set cached response
 * @param key - Cache key
 * @param response - Response to cache
 */
export function setCachedResponse(key: string, response: any): void {
    aiCache.set(key, { response, timestamp: Date.now() });
}

/**
 * Clear all cached responses
 */
export function clearCache(): void {
    aiCache.clear();
}
