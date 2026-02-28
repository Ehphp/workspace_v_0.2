/**
 * Prompt Registry - Fetches AI prompts from Supabase with in-memory caching.
 *
 * Architecture:
 *   1. Check in-memory cache (Map) — returns in < 1 ms
 *   2. If miss, fetch from Supabase `ai_prompts` table
 *   3. If DB unreachable or prompt missing → fall back to local constant
 *
 * Cache TTL: 5 minutes (configurable via PROMPT_CACHE_TTL_MS env var).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Local fallback imports
// ─────────────────────────────────────────────────────────────────────────────

import { NORMALIZATION_PROMPT, ESTIMATE_FROM_INTERVIEW_PROMPT } from './prompt-templates';
import { QUESTION_GENERATION_SYSTEM_PROMPT } from './prompts/question-generation';
import { PRESET_GENERATION_SYSTEM_PROMPT } from './prompts/preset-generation';

// ─────────────────────────────────────────────────────────────────────────────
// Fallback map — keyed by prompt_key, value is the raw template string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local fallback prompts.
 * These are used when Supabase is unreachable or the prompt is not found in DB.
 * NOTE: parameterized prompts store the *template* with {PLACEHOLDER} markers
 *       that consumers replace at runtime.
 */
const LOCAL_FALLBACKS: Record<string, string> = {
    // prompt-templates.ts — static constants
    normalization: NORMALIZATION_PROMPT,
    estimate_from_interview: ESTIMATE_FROM_INTERVIEW_PROMPT,

    // prompts/question-generation.ts
    question_generation: QUESTION_GENERATION_SYSTEM_PROMPT,

    // prompts/preset-generation.ts
    preset_generation: PRESET_GENERATION_SYSTEM_PROMPT,

    // Parameterized prompts are NOT stored here as fallbacks because they are
    // built via functions (createActivitySuggestionPrompt, etc.) that embed
    // runtime variables.  For those, the calling code will catch the "not found"
    // case and fall back to the function it already has.
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
    text: string;
    fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Default TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheTtl(): number {
    const envTtl = process.env.PROMPT_CACHE_TTL_MS;
    if (envTtl) {
        const parsed = parseInt(envTtl, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_CACHE_TTL_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (lazy singleton)
// ─────────────────────────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (_supabase) return _supabase;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.warn('[prompt-registry] SUPABASE_URL or SUPABASE_ANON_KEY not set — using local fallbacks only.');
        return null;
    }
    _supabase = createClient(url, key);
    return _supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a prompt by its unique key.
 *
 * Resolution order:
 *   1. In-memory cache (if not expired)
 *   2. Supabase `ai_prompts` table (SELECT WHERE prompt_key = key AND is_active)
 *   3. Local fallback constant
 *
 * @param key - Unique prompt key (e.g. 'normalization', 'question_generation')
 * @returns The prompt text (template), or null if not found anywhere
 */
export async function getPrompt(key: string): Promise<string | null> {
    // 1. Cache hit?
    const ttl = getCacheTtl();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < ttl) {
        return cached.text;
    }

    // 2. Try Supabase
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('ai_prompts')
                .select('system_prompt')
                .eq('prompt_key', key)
                .eq('is_active', true)
                .single();

            if (!error && data?.system_prompt) {
                const text = data.system_prompt as string;
                cache.set(key, { text, fetchedAt: Date.now() });
                return text;
            }

            if (error) {
                console.warn(`[prompt-registry] Supabase query failed for key "${key}":`, error.message);
            }
        } catch (err) {
            console.warn(`[prompt-registry] Supabase unreachable for key "${key}":`, err);
        }
    }

    // 3. Local fallback
    const fallback = LOCAL_FALLBACKS[key] ?? null;
    if (fallback) {
        console.log(`[prompt-registry] Using local fallback for key "${key}".`);
        // Populate cache with fallback so we don't hit this path repeatedly
        cache.set(key, { text: fallback, fetchedAt: Date.now() });
    } else {
        console.warn(`[prompt-registry] No prompt found for key "${key}" (no DB entry, no local fallback).`);
    }

    return fallback;
}

/**
 * Invalidate one or all cached prompts.
 * Useful for hot-reload during development.
 *
 * @param key - Optional specific key to invalidate. If omitted, clears entire cache.
 */
export function invalidatePromptCache(key?: string): void {
    if (key) {
        cache.delete(key);
        console.log(`[prompt-registry] Cache invalidated for key "${key}".`);
    } else {
        cache.clear();
        console.log('[prompt-registry] Entire prompt cache invalidated.');
    }
}

/**
 * Pre-warm the cache by fetching all active prompts from Supabase.
 * Call this once at cold-start (e.g. top-level of a Netlify function) for best latency.
 */
export async function warmPromptCache(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('ai_prompts')
            .select('prompt_key, system_prompt')
            .eq('is_active', true);

        if (error) {
            console.warn('[prompt-registry] Cache warm-up failed:', error.message);
            return;
        }

        const now = Date.now();
        for (const row of data || []) {
            if (row.prompt_key && row.system_prompt) {
                cache.set(row.prompt_key, { text: row.system_prompt, fetchedAt: now });
            }
        }
        console.log(`[prompt-registry] Cache warmed with ${data?.length ?? 0} prompts.`);
    } catch (err) {
        console.warn('[prompt-registry] Cache warm-up error:', err);
    }
}
