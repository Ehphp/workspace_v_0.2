/**
 * Shared Activity utilities for AI endpoints
 *
 * Extracted from ai-estimate-from-interview.ts so that both the
 * interview-planner and the estimation endpoint can reuse the same
 * server-side activity fetching and ranking logic.
 */

import { createClient } from '@supabase/supabase-js';

import type { ActivityBiases } from './domain/estimation/project-context-rules';
import { applyActivityBiases } from './domain/estimation/project-context-integration';

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
    /** Multiplier for LOW complexity (default 0.50) */
    sm_multiplier?: number;
    /** Multiplier for HIGH complexity (default 2.00) */
    lg_multiplier?: number;
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
// Project-scoped activity type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A project-scoped activity (from `project_activities` table).
 * Extends the base Activity shape with project-specific metadata.
 */
export interface ProjectActivity extends Activity {
    /** UUID from project_activities.id */
    id: string;
    /** The project this activity belongs to */
    project_id: string;
    /** Intervention type: NEW, MODIFY, CONFIGURE, MIGRATE */
    intervention_type: string;
    /** Effort adjustment multiplier (0–2) */
    effort_modifier: number;
    /** Soft link to global activity code (traceability) */
    source_activity_code: string | null;
    /** Blueprint component this maps to */
    blueprint_node_name: string | null;
    /** Type of blueprint node */
    blueprint_node_type: 'component' | 'dataDomain' | 'integration' | null;
    /** AI reasoning for creation */
    ai_rationale: string | null;
    /** Confidence score 0–1 */
    confidence: number | null;
}

export interface ProjectActivityFetchResult {
    activities: ProjectActivity[];
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
// Technology resolution (adapter: techPresetId → technology_id)
// ─────────────────────────────────────────────────────────────────────────────

interface TechnologyRecord {
    id: string;
    code: string;
    tech_category: string;
}

/**
 * Resolve the MULTI technology id (cached after first call).
 */
let _cachedMultiTechId: string | null | undefined;

async function resolveMultiTechId(
    supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
    if (_cachedMultiTechId !== undefined) return _cachedMultiTechId;
    const { data } = await supabase
        .from('technologies')
        .select('id')
        .eq('code', 'MULTI')
        .limit(1);
    _cachedMultiTechId = data?.[0]?.id ?? null;
    return _cachedMultiTechId;
}

/**
 * Resolve techPresetId → technology row.
 * techPresetId is a technologies.id UUID — this is a simple lookup,
 * not a translation.
 */
async function resolveTechnology(
    supabase: ReturnType<typeof createClient>,
    techPresetId: string,
): Promise<TechnologyRecord | null> {
    const { data, error } = await supabase
        .from('technologies')
        .select('id, code, tech_category')
        .eq('id', techPresetId)
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical activity fetch by technology_id FK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch activities filtered by technology_id FK.
 * Returns all active activities whose technology_id matches
 * the given technology or the MULTI technology.
 */
async function fetchActivitiesByTechnologyId(
    supabase: ReturnType<typeof createClient>,
    technologyId: string,
    multiTechId: string | null,
): Promise<Activity[]> {
    const filterParts = [`technology_id.eq.${technologyId}`];
    if (multiTechId) {
        filterParts.push(`technology_id.eq.${multiTechId}`);
    }

    const { data, error } = await supabase
        .from('activities')
        .select('code, name, description, base_hours, group, tech_category, technology_id')
        .eq('active', true)
        .or(filterParts.join(','));

    if (error) {
        console.error('[fetch-by-fk] Supabase error:', error.message);
        return [];
    }
    return (data ?? []) as Activity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy fallback (emergency only — FORCE_LEGACY_ACTIVITY_FETCH=true)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legacy fetch using tech_category string matching.
 * Only invoked when FORCE_LEGACY_ACTIVITY_FETCH=true.
 */
async function fetchActivitiesLegacy(
    supabase: ReturnType<typeof createClient>,
    techCategory: string,
): Promise<Activity[]> {
    console.warn('[LEGACY-FETCH] Using tech_category string filter — this path is deprecated');
    const { data, error } = await supabase
        .from('activities')
        .select('code, name, description, base_hours, group, tech_category, technology_id')
        .eq('active', true)
        .or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`);

    if (error) {
        console.error('[LEGACY-FETCH] Supabase error:', error.message);
        return [];
    }
    return (data ?? []) as Activity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side Activity Fetch (public API — signature unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch activities from Supabase server-side, filtered by technology.
 *
 * Canonical path: resolves techPresetId → technology_id FK → filters by FK.
 * Emergency rollback: set FORCE_LEGACY_ACTIVITY_FETCH=true to revert to
 * tech_category string matching (does NOT require a deploy change).
 */
export async function fetchActivitiesServerSide(
    techCategory: string,
    techPresetId: string,
    clientActivities?: Activity[]
): Promise<ActivityFetchResult> {
    const start = Date.now();
    const supabase = getServerSupabase();

    if (!supabase) {
        // DB unavailable — client-provided fallback
        if (clientActivities && clientActivities.length > 0) {
            console.warn(`[server-fetch] No Supabase client — using ${clientActivities.length} client-provided activities`);
            return { activities: clientActivities, source: 'client', fetchMs: Date.now() - start };
        }
        console.error('[server-fetch] CRITICAL: No Supabase client and no client activities');
        return { activities: [], source: 'fallback', fetchMs: Date.now() - start };
    }

    try {
        // ── Emergency rollback gate ──────────────────────────────────
        if (process.env.FORCE_LEGACY_ACTIVITY_FETCH === 'true') {
            const activities = await fetchActivitiesLegacy(supabase, techCategory);
            console.log(`[server-fetch] LEGACY path: ${activities.length} activities in ${Date.now() - start}ms`, {
                techCategory,
                techPresetId,
                candidateCount: activities.length,
            });
            if (activities.length === 0) {
                console.error('[server-fetch] CRITICAL: Empty candidate set from LEGACY path', { techCategory, techPresetId });
                throw new Error(`Empty candidate set — no activities found for tech_category="${techCategory}"`);
            }
            return { activities, source: 'server', fetchMs: Date.now() - start };
        }

        // ── Canonical path: technology_id FK ─────────────────────────
        // If techPresetId is empty (e.g. debug dashboard, quick-estimate without preset),
        // fall back to legacy category-based fetch instead of throwing.
        if (!techPresetId) {
            const activities = await fetchActivitiesLegacy(supabase, techCategory);
            console.log(`[server-fetch] No techPresetId — legacy category fallback: ${activities.length} activities`, { techCategory });
            if (activities.length === 0) {
                throw new Error(`Empty candidate set — no activities found for tech_category="${techCategory}"`);
            }
            return { activities, source: 'server', fetchMs: Date.now() - start };
        }
        const technology = await resolveTechnology(supabase, techPresetId);
        if (!technology) {
            console.error('[server-fetch] CRITICAL: Cannot resolve technology', { techPresetId, techCategory });
            throw new Error(`Cannot resolve techPresetId="${techPresetId}" to a technology row`);
        }

        const multiTechId = await resolveMultiTechId(supabase);
        const activities = await fetchActivitiesByTechnologyId(supabase, technology.id, multiTechId);

        // ── Aggressive logging ───────────────────────────────────────
        console.log('[server-fetch] Canonical FK fetch complete', {
            technologyId: technology.id,
            technologyCode: technology.code,
            multiTechId,
            candidateCount: activities.length,
            fetchMs: Date.now() - start,
        });

        // ── Guardrail: empty candidate set is a hard error ──────────
        if (activities.length === 0) {
            console.error('[server-fetch] CRITICAL: Empty candidate set', {
                technologyId: technology.id,
                technologyCode: technology.code,
                techPresetId,
            });
            throw new Error(`Empty candidate set — no activities found for technology "${technology.code}" (id=${technology.id})`);
        }

        return { activities, source: 'server', fetchMs: Date.now() - start };

    } catch (err) {
        // Re-throw guardrail errors — they must surface to the caller
        if (err instanceof Error && err.message.startsWith('Empty candidate set')) throw err;
        if (err instanceof Error && err.message.startsWith('Cannot resolve techPresetId')) throw err;

        console.error('[server-fetch] Unexpected DB failure:', err);

        // Last resort: client-provided activities
        if (clientActivities && clientActivities.length > 0) {
            console.warn(`[server-fetch] Using ${clientActivities.length} client-provided activities after DB failure`);
            return { activities: clientActivities, source: 'client', fetchMs: Date.now() - start };
        }

        throw new Error('Activity fetch failed — no DB, no client fallback');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project-scoped Activity Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch project-scoped activities for a given projectId.
 * Returns an empty array if projectId is missing or no project activities exist.
 * These are domain-calibrated activities that should receive priority in estimation.
 */
export async function fetchProjectActivities(
    projectId: string | undefined | null,
): Promise<ProjectActivityFetchResult> {
    const start = Date.now();

    if (!projectId) {
        return { activities: [], fetchMs: 0 };
    }

    // Use service role key to bypass RLS — server-side trusted context
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.warn('[project-activities] No Supabase credentials — skipping project activity fetch');
        return { activities: [], fetchMs: Date.now() - start };
    }
    const supabase = createClient(url, key);

    try {
        const { data, error } = await supabase
            .from('project_activities')
            .select('id, project_id, code, name, description, base_hours, "group", sm_multiplier, lg_multiplier, intervention_type, effort_modifier, source_activity_code, blueprint_node_name, blueprint_node_type, ai_rationale, confidence')
            .eq('project_id', projectId)
            .eq('is_enabled', true)
            .order('position', { ascending: true });

        if (error) {
            console.error('[project-activities] Supabase error:', error.message);
            return { activities: [], fetchMs: Date.now() - start };
        }

        // project_activities table has no tech_category column — inject default
        const activities = (data ?? []).map(row => ({
            ...row,
            tech_category: 'PROJECT' as string,
        })) as ProjectActivity[];

        console.log('[project-activities] Fetched', {
            projectId,
            count: activities.length,
            fetchMs: Date.now() - start,
        });

        return { activities, fetchMs: Date.now() - start };
    } catch (err) {
        console.error('[project-activities] Unexpected error:', err);
        return { activities: [], fetchMs: Date.now() - start };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword-based Ranking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic keyword-based ranking to select the most relevant activities.
 * Scores each activity by keyword overlap with the requirement + optional interview answers,
 * then returns the top N (default 20).
 *
 * When an estimation blueprint is provided, its components, integrations, and
 * data entities are extracted as additional keywords and each match gets a
 * boosted weight (+2 per keyword) so that structurally relevant activities
 * rank higher.
 *
 * When activityBiases are provided (from project-context rules), additional
 * scoring adjustments are applied: variant preference (_SM/_LG), group boost,
 * and keyword boost. These are additive and never exclude activities.
 */
export function selectTopActivities(
    activities: Activity[],
    description: string,
    answers: Record<string, InterviewAnswerRecord> | undefined,
    topN: number = 20,
    blueprint?: Record<string, unknown>,
    activityBiases?: ActivityBiases,
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

    // Blueprint-boosted keywords (higher weight for structural matches)
    const blueprintKeywords = new Set<string>();
    if (blueprint && typeof blueprint === 'object') {
        const bpParts: string[] = [];
        if (Array.isArray(blueprint.components)) {
            for (const c of blueprint.components) {
                if (c && typeof c === 'object') {
                    if (c.name) bpParts.push(String(c.name));
                    if (c.layer) bpParts.push(String(c.layer));
                    if (c.interventionType) bpParts.push(String(c.interventionType));
                    if (c.description) bpParts.push(String(c.description));
                }
            }
        }
        if (Array.isArray(blueprint.integrations)) {
            for (const i of blueprint.integrations) {
                if (i && typeof i === 'object') {
                    if (i.systemName) bpParts.push(String(i.systemName));
                    if (i.protocol) bpParts.push(String(i.protocol));
                }
            }
        }
        if (Array.isArray(blueprint.dataEntities)) {
            for (const d of blueprint.dataEntities) {
                if (d && typeof d === 'object') {
                    if (d.name) bpParts.push(String(d.name));
                    if (Array.isArray(d.operations)) bpParts.push(d.operations.join(' '));
                }
            }
        }
        if (Array.isArray(blueprint.testingScope)) {
            for (const t of blueprint.testingScope) {
                if (t && typeof t === 'object') {
                    if (t.area) bpParts.push(String(t.area));
                }
            }
        }
        const bpText = bpParts.join(' ').toLowerCase();
        for (const w of bpText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2)) {
            blueprintKeywords.add(w);
        }
    }

    // Score each activity
    const scored = activities.map(a => {
        const activityText = `${a.code} ${a.name} ${a.description || ''} ${a.group}`.toLowerCase();
        const activityWords = activityText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length > 2);
        let score = 0;
        for (const word of activityWords) {
            if (keywordSet.has(word)) score += 1;
            // Blueprint keywords get a stronger boost (structural relevance)
            if (blueprintKeywords.has(word)) score += 2;
        }
        // Boost MULTI activities slightly (cross-cutting concerns)
        if (a.tech_category === 'MULTI') score += 0.5;
        return { activity: a, score };
    });

    // Apply project-context biases (additive, never excludes)
    const finalScored = activityBiases
        ? applyActivityBiases(scored, activityBiases)
        : scored;

    // Sort by score descending, take top N
    finalScored.sort((a, b) => b.score - a.score);
    const selected = finalScored.slice(0, topN).map(s => s.activity);

    console.log(`[ranking] Selected ${selected.length}/${activities.length} activities (top scores: ${finalScored.slice(0, 5).map(s => `${s.activity.code}=${s.score}`).join(', ')})${activityBiases ? ' [project-context biases applied]' : ''}`);
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
