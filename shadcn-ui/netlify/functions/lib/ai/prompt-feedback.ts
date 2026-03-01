/**
 * Prompt Feedback — S4-3: Records confidence feedback for prompt variants.
 *
 * Called after AI response is received, using the confidence
 * score from the structured output. Enables A/B comparison.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (lazy singleton, shared with prompt-registry)
// ─────────────────────────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (_supabase) return _supabase;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    _supabase = createClient(url, key);
    return _supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record confidence feedback for a prompt variant.
 * Uses the `record_prompt_confidence` RPC which atomically updates
 * avg_confidence and usage_count.
 *
 * @param promptId - UUID of the ai_prompts row (from PromptResult.promptId)
 * @param confidence - 0.0 to 1.0 confidence score from AI response
 */
export async function recordPromptFeedback(
    promptId: string,
    confidence: number
): Promise<void> {
    // Skip local fallbacks — they don't have DB rows
    if (promptId.startsWith('local-')) return;

    try {
        const supabase = getSupabase();
        if (!supabase) {
            console.warn('[prompt-feedback] Supabase not configured, skipping feedback.');
            return;
        }

        const clampedConfidence = Math.min(1, Math.max(0, confidence));
        const { error } = await supabase.rpc('record_prompt_confidence', {
            p_prompt_id: promptId,
            p_confidence: clampedConfidence,
        });

        if (error) {
            console.error('[prompt-feedback] RPC error:', error.message);
        }
    } catch (err) {
        // Non-critical — don't fail the request
        console.error('[prompt-feedback] Failed to record:', err);
    }
}

/**
 * Increment usage count for a prompt (without confidence update).
 * Lighter-weight than recordPromptFeedback for endpoints that
 * don't produce a confidence score.
 */
export async function incrementPromptUsage(
    promptId: string
): Promise<void> {
    if (promptId.startsWith('local-')) return;

    try {
        const supabase = getSupabase();
        if (!supabase) return;

        const { error } = await supabase.rpc('increment_prompt_usage', {
            p_prompt_id: promptId,
        });

        if (error) {
            console.error('[prompt-feedback] Usage increment error:', error.message);
        }
    } catch (err) {
        console.error('[prompt-feedback] Failed to increment usage:', err);
    }
}
