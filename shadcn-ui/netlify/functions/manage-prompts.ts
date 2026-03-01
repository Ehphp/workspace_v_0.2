/**
 * Netlify Function: Manage AI Prompts — S4-3
 *
 * Admin CRUD for ai_prompts with A/B variant support.
 * Operations:
 *   GET    — list all active prompts with stats
 *   POST   — create a new variant
 *   PATCH  — update content, traffic_pct, or toggle active
 *   POST /promote — promote a variant to 'default' (deactivate others)
 *
 * Protected: requires admin/owner role (enforced by RLS).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

export const handler = async (event: any) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Auth: extract user from Bearer token
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = authHeader?.replace('Bearer ', '');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify user and role
    let userId: string | null = null;
    if (token) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            userId = user.id;
        }
    }

    if (!userId) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Autenticazione richiesta.' }),
        };
    }

    // Check admin/owner role
    const { data: memberData } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'owner'])
        .limit(1)
        .single();

    if (!memberData) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Solo admin/owner possono gestire i prompt.' }),
        };
    }

    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const path = event.path || '';

        // ── GET: list all active prompts with stats ──────────────────
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('ai_prompts')
                .select('id, prompt_key, version, variant, traffic_pct, system_prompt, is_active, usage_count, avg_confidence, promoted_at, created_at, updated_at')
                .order('prompt_key')
                .order('variant');

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, prompts: data }),
            };
        }

        // ── POST /promote: promote a variant ─────────────────────────
        if (event.httpMethod === 'POST' && path.endsWith('/promote')) {
            const { promptId } = body;
            if (!promptId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'promptId richiesto.' }),
                };
            }

            // Get the prompt to promote
            const { data: prompt, error: fetchError } = await supabase
                .from('ai_prompts')
                .select('*')
                .eq('id', promptId)
                .single();

            if (fetchError || !prompt) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Prompt non trovato.' }),
                };
            }

            // Deactivate all other variants for this prompt_key
            await supabase
                .from('ai_prompts')
                .update({ is_active: false })
                .eq('prompt_key', prompt.prompt_key)
                .neq('id', promptId);

            // Set promoted variant as default with 100% traffic
            const { error: updateError } = await supabase
                .from('ai_prompts')
                .update({
                    variant: 'default',
                    traffic_pct: 100,
                    is_active: true,
                    promoted_at: new Date().toISOString(),
                })
                .eq('id', promptId);

            if (updateError) throw updateError;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: `Variante promossa per ${prompt.prompt_key}.` }),
            };
        }

        // ── POST: create new variant ─────────────────────────────────
        if (event.httpMethod === 'POST') {
            const { prompt_key, variant, system_prompt, traffic_pct, description } = body;

            if (!prompt_key || !system_prompt) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'prompt_key e system_prompt sono obbligatori.' }),
                };
            }

            // Get next version number for this key
            const { data: existing } = await supabase
                .from('ai_prompts')
                .select('version')
                .eq('prompt_key', prompt_key)
                .order('version', { ascending: false })
                .limit(1);

            const nextVersion = (existing?.[0]?.version || 0) + 1;

            const { data: newPrompt, error: insertError } = await supabase
                .from('ai_prompts')
                .insert({
                    prompt_key,
                    variant: variant || `v${nextVersion}`,
                    version: nextVersion,
                    system_prompt,
                    traffic_pct: traffic_pct ?? 0, // Start with 0% traffic by default
                    description: description || null,
                    is_active: true,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, prompt: newPrompt }),
            };
        }

        // ── PATCH: update prompt ─────────────────────────────────────
        if (event.httpMethod === 'PATCH') {
            const { promptId, system_prompt, traffic_pct, is_active, description } = body;

            if (!promptId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'promptId richiesto.' }),
                };
            }

            const updates: Record<string, any> = {};
            if (system_prompt !== undefined) updates.system_prompt = system_prompt;
            if (traffic_pct !== undefined) updates.traffic_pct = traffic_pct;
            if (is_active !== undefined) updates.is_active = is_active;
            if (description !== undefined) updates.description = description;

            // Bump version if system_prompt changed
            if (system_prompt !== undefined) {
                const { data: current } = await supabase
                    .from('ai_prompts')
                    .select('version')
                    .eq('id', promptId)
                    .single();

                if (current) {
                    updates.version = current.version + 1;
                }
            }

            const { data: updated, error: updateError } = await supabase
                .from('ai_prompts')
                .update(updates)
                .eq('id', promptId)
                .select()
                .single();

            if (updateError) throw updateError;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, prompt: updated }),
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Metodo non supportato.' }),
        };
    } catch (err) {
        console.error('[manage-prompts] Error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: err instanceof Error ? err.message : 'Errore interno.',
            }),
        };
    }
};
