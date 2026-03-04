import { createClient } from '@supabase/supabase-js';

// Configurable security controls
const REQUIRE_AUTH = process.env.AI_REQUIRE_AUTH !== 'false'; // default: require auth

// Supabase client for token validation (server-side)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServer = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface AuthResult {
    ok: boolean;
    statusCode?: number;
    message?: string;
    userId?: string | null;
}

/**
 * Validates authentication token from request header
 * @param authHeader - Authorization header from request
 * @returns Authentication result with user ID if successful
 */
export async function validateAuthToken(authHeader: string | undefined): Promise<AuthResult> {
    const hasToken = authHeader && authHeader.toLowerCase().startsWith('bearer ');

    if (!REQUIRE_AUTH && !hasToken) {
        // Auth not required and no token provided → anonymous access OK
        return { ok: true, userId: null };
    }

    if (!hasToken) {
        if (!REQUIRE_AUTH) {
            return { ok: true, userId: null };
        }
        return { ok: false, statusCode: 401, message: 'Missing bearer token' };
    }

    if (!supabaseServer) {
        if (!REQUIRE_AUTH) {
            // Can't validate token but auth isn't required → allow through
            console.warn('Supabase server client not configured; skipping optional auth');
            return { ok: true, userId: null };
        }
        console.error('Supabase server client not configured');
        return { ok: false, statusCode: 500, message: 'Server auth not configured' };
    }

    // Token present → always try to extract userId (even if auth not required)
    const token = authHeader!.slice(7);
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error || !data?.user) {
        if (!REQUIRE_AUTH) {
            // Auth not required → allow through as anonymous despite invalid token
            console.warn('Supabase token validation failed (auth optional, continuing as anonymous):', error?.message);
            return { ok: true, userId: null };
        }
        console.warn('Supabase token validation failed', error);
        return { ok: false, statusCode: 401, message: 'Invalid or expired token' };
    }

    return { ok: true, userId: data.user.id };
}

/**
 * Logs debug information about environment configuration
 */
export function logAuthDebugInfo(): void {
    console.log('DEBUG ENV - SUPABASE_URL present:', !!process.env.SUPABASE_URL);
    console.log('DEBUG ENV - SUPABASE_ANON_KEY present:', !!process.env.SUPABASE_ANON_KEY);
    console.log('DEBUG ENV - AI_REQUIRE_AUTH:', process.env.AI_REQUIRE_AUTH ?? 'undefined');
    console.log('DEBUG ENV - supabaseServer configured:', !!supabaseServer);
}
