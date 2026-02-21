// CACHE DISABLED - All functions are no-op
// Original implementation was in-memory cache with 24h TTL
// Disabled to ensure fresh AI responses on every request

/**
 * Generate cache key (kept for compatibility)
 */
export function getCacheKey(description: string, presetId: string, activityCodes: string[]): string {
    return ''; // No-op, cache disabled
}

/**
 * Get cached response - DISABLED
 * Always returns null to force fresh AI call
 */
export function getCachedResponse(_key: string): any | null {
    return null; // Cache disabled
}

/**
 * Set cached response - DISABLED
 * Does nothing, cache disabled
 */
export function setCachedResponse(_key: string, _response: any): void {
    // No-op, cache disabled
}

/**
 * Clear all cached responses - DISABLED
 */
export function clearCache(): void {
    // No-op, cache disabled
}
