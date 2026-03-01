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

// S4-3: PromptRecord represents a single row in ai_prompts (with versioning)
export interface PromptRecord {
    id: string;           // UUID — needed for tracking
    prompt_key: string;
    version: number;
    variant: string;      // 'default' | 'A' | 'B' | etc.
    traffic_pct: number;
    system_prompt: string;
    is_active: boolean;
}

// S4-3: Result returned by getPromptWithMeta()
export interface PromptResult {
    promptId: string;       // UUID — for feedback tracking
    systemPrompt: string;
    variant: string;
    version: number;
}

interface CacheEntry {
    records: PromptRecord[];
    fetchedAt: number;
}

// S4-3: Legacy single-prompt cache entry (backward compat)
interface LegacyCacheEntry {
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
 * S4-3: Weighted random selection based on traffic_pct.
 * If only one variant, returns it directly.
 * traffic_pct values are normalized (don't need to sum to 100).
 */
function selectVariant(records: PromptRecord[]): PromptRecord {
    if (records.length === 1) return records[0];

    const totalTraffic = records.reduce((sum, r) => sum + r.traffic_pct, 0);
    let random = Math.random() * totalTraffic;

    for (const record of records) {
        random -= record.traffic_pct;
        if (random <= 0) return record;
    }

    return records[0]; // fallback
}

function toPromptResult(record: PromptRecord): PromptResult {
    return {
        promptId: record.id,
        systemPrompt: record.system_prompt,
        variant: record.variant,
        version: record.version,
    };
}

/**
 * S4-3: Get a prompt with full metadata (ID, variant, version).
 * Use this for new code — enables A/B tracking and feedback.
 *
 * Resolution order:
 *   1. In-memory cache (if not expired) → select variant
 *   2. Supabase `ai_prompts` table (ALL active for key) → select variant
 *   3. Local fallback constant
 */
export async function getPromptWithMeta(key: string): Promise<PromptResult> {
    // 1. Cache hit?
    const ttl = getCacheTtl();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < ttl && cached.records.length > 0) {
        const selected = selectVariant(cached.records);
        return toPromptResult(selected);
    }

    // 2. Try Supabase — fetch ALL active records for this key
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('ai_prompts')
                .select('id, prompt_key, version, variant, traffic_pct, system_prompt, is_active')
                .eq('prompt_key', key)
                .eq('is_active', true);

            if (!error && data && data.length > 0) {
                const records: PromptRecord[] = data as PromptRecord[];
                cache.set(key, { records, fetchedAt: Date.now() });
                const selected = selectVariant(records);
                return toPromptResult(selected);
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
        // Cache as single-record array
        const record: PromptRecord = {
            id: `local-${key}`,
            prompt_key: key,
            version: 0,
            variant: 'local-fallback',
            traffic_pct: 100,
            system_prompt: fallback,
            is_active: true,
        };
        cache.set(key, { records: [record], fetchedAt: Date.now() });
    } else {
        console.warn(`[prompt-registry] No prompt found for key "${key}" (no DB entry, no local fallback).`);
    }

    return {
        promptId: `local-${key}`,
        systemPrompt: fallback || '',
        variant: 'local-fallback',
        version: 0,
    };
}

/**
 * Get a prompt by its unique key.
 *
 * Resolution order:
 *   1. In-memory cache (if not expired)
 *   2. Supabase `ai_prompts` table (SELECT WHERE prompt_key = key AND is_active)
 *   3. Local fallback constant
 *
 * @deprecated Use getPromptWithMeta for new code (enables A/B tracking)
 * @param key - Unique prompt key (e.g. 'normalization', 'question_generation')
 * @returns The prompt text (template), or null if not found anywhere
 */
export async function getPrompt(key: string): Promise<string | null> {
    const result = await getPromptWithMeta(key);
    return result.systemPrompt || null;
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
 * S4-3: now groups by prompt_key for variant-aware caching.
 */
export async function warmPromptCache(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('ai_prompts')
            .select('id, prompt_key, version, variant, traffic_pct, system_prompt, is_active')
            .eq('is_active', true);

        if (error) {
            console.warn('[prompt-registry] Cache warm-up failed:', error.message);
            return;
        }

        // Group records by prompt_key
        const now = Date.now();
        const grouped = new Map<string, PromptRecord[]>();
        for (const row of data || []) {
            if (row.prompt_key && row.system_prompt) {
                const record: PromptRecord = row as PromptRecord;
                const existing = grouped.get(row.prompt_key) || [];
                existing.push(record);
                grouped.set(row.prompt_key, existing);
            }
        }

        for (const [key, records] of grouped) {
            cache.set(key, { records, fetchedAt: now });
        }
        console.log(`[prompt-registry] Cache warmed with ${data?.length ?? 0} prompts across ${grouped.size} keys.`);
    } catch (err) {
        console.warn('[prompt-registry] Cache warm-up error:', err);
    }
}
