/**
 * Shared Activity utilities for AI endpoints
 *
 * Extracted from ai-estimate-from-interview.ts so that both the
 * interview-planner and the estimation endpoint can reuse the same
 * server-side activity fetching and ranking logic.
 */

import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Activity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
    /** Canonical FK to technologies.id */
    technology_id?: string | null;
}

export interface InterviewAnswerRecord {
    questionId: string;
    category: string;
    value: string | string[] | number;
    timestamp: string;
}

export interface ActivityFetchResult {
    activities: Activity[];
    source: 'server' | 'client' | 'fallback';
    fetchMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (lazy singleton)
// ─────────────────────────────────────────────────────────────────────────────

let _supabaseClient: ReturnType<typeof createClient> | null = null;

export function getServerSupabase() {
    if (_supabaseClient) return _supabaseClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _supabaseClient = createClient(url, key);
    return _supabaseClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side Activity Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch activities from Supabase server-side, filtered by technology.
 * Falls back to client-provided activities if DB is unavailable.
 */
export async function fetchActivitiesServerSide(
    techCategory: string,
    techPresetId: string,
    clientActivities?: Activity[]
): Promise<ActivityFetchResult> {
    const start = Date.now();
    const supabase = getServerSupabase();

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('activities')
                .select('code, name, description, base_hours, group, tech_category')
                .eq('active', true)
                .or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`);

            if (!error && data && data.length > 0) {
                console.log(`[server-fetch] Loaded ${data.length} activities from DB in ${Date.now() - start}ms`);
                return { activities: data as Activity[], source: 'server', fetchMs: Date.now() - start };
            }
            console.warn('[server-fetch] DB returned empty/error, falling back:', error?.message);
        } catch (err) {
            console.warn('[server-fetch] DB query failed:', err);
        }
    }

    // Fallback to client-provided activities
    if (clientActivities && clientActivities.length > 0) {
        console.log(`[server-fetch] Using ${clientActivities.length} client-provided activities (fallback)`);
        return { activities: clientActivities, source: 'client', fetchMs: Date.now() - start };
    }

    return { activities: [], source: 'fallback', fetchMs: Date.now() - start };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword-based Ranking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic keyword-based ranking to select the most relevant activities.
 * Scores each activity by keyword overlap with the requirement + optional interview answers,
 * then returns the top N (default 20).
 */
export function selectTopActivities(
    activities: Activity[],
    description: string,
    answers: Record<string, InterviewAnswerRecord> | undefined,
    topN: number = 20
): Activity[] {
    if (activities.length <= topN) return activities;

    // Build keyword set from description + answers (lowercase)
    const textParts: string[] = [description];
    if (answers) {
        for (const a of Object.values(answers)) {
            const v = Array.isArray(a.value) ? a.value.join(' ') : String(a.value);
            textParts.push(`${a.category} ${v}`);
        }
    }
    const text = textParts.join(' ').toLowerCase();

    const keywords = text
        .split(/[^a-zA-ZÀ-ÿ0-9]+/)
        .filter(w => w.length > 2);
    const keywordSet = new Set(keywords);

    // Score each activity
    const scored = activities.map(a => {
        const activityText = `${a.code} ${a.name} ${a.description || ''} ${a.group}`.toLowerCase();
        const activityWords = activityText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2);
        let score = 0;
        for (const word of activityWords) {
            if (keywordSet.has(word)) score += 1;
        }
        // Boost MULTI activities slightly (cross-cutting concerns)
        if (a.tech_category === 'MULTI') score += 0.5;
        return { activity: a, score };
    });

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, topN).map(s => s.activity);

    console.log(`[ranking] Selected ${selected.length}/${activities.length} activities (top scores: ${scored.slice(0, 5).map(s => `${s.activity.code}=${s.score}`).join(', ')})`);
    return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format activities catalog for prompt — compact format to reduce token count.
 * Only sends code, name, base_hours, and a truncated description (max 80 chars).
 */
export function formatActivitiesCatalog(activities: Activity[]): string {
    return activities
        .map(a => {
            const shortDesc = a.description
                ? a.description.substring(0, 80) + (a.description.length > 80 ? '…' : '')
                : '';
            return `- ${a.code}: ${a.name} (${a.base_hours}h)${shortDesc ? ' — ' + shortDesc : ''}`;
        })
        .join('\n');
}

/**
 * Format activities as a compact summary for the interview planner.
 * Shows only code + name + hours, no description, to save tokens.
 */
export function formatActivitiesSummary(activities: Activity[]): string {
    return activities
        .map(a => `${a.code}: ${a.name} (${a.base_hours}h)`)
        .join('\n');
}
