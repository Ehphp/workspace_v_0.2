// Configurable CORS controls
const ALLOWED_ORIGINS = (process.env.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

/**
 * Check if origin is a localhost URL (for development)
 */
function isLocalhostOrigin(origin: string): boolean {
    return /^http:\/\/localhost(:\d+)?$/.test(origin);
}

/**
 * Get the appropriate allowed origin header value
 * @param originHeader - Origin header from request
 * @returns The origin to set in Access-Control-Allow-Origin
 */
export function getAllowedOrigin(originHeader: string | undefined): string {
    if (ALLOWED_ORIGINS.length === 0) return '*';
    if (originHeader && ALLOWED_ORIGINS.includes(originHeader)) return originHeader;
    // Allow any localhost in development
    if (originHeader && isLocalhostOrigin(originHeader)) return originHeader;
    // fallback to first allowed origin to avoid null header
    return ALLOWED_ORIGINS[0];
}

/**
 * Check if origin is in allowlist
 * @param originHeader - Origin header from request
 * @returns true if origin is allowed
 */
export function isOriginAllowed(originHeader: string | undefined): boolean {
    if (ALLOWED_ORIGINS.length === 0) return true;
    if (!originHeader) return false;
    if (ALLOWED_ORIGINS.includes(originHeader)) return true;
    // Allow any localhost port in development
    if (isLocalhostOrigin(originHeader)) return true;
    return false;
}

/**
 * Get standard CORS headers for responses
 * @param originHeader - Origin header from request
 * @returns Headers object with CORS settings
 */
export function getCorsHeaders(originHeader: string | undefined): Record<string, string> {
    const allowOrigin = getAllowedOrigin(originHeader);
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };
}
