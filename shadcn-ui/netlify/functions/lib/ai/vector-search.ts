/**
 * Vector Search Utilities
 * 
 * Provides semantic search capabilities using pgvector.
 * Includes fallback to full catalog when vector search is unavailable.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding, createActivitySearchText, createRequirementSearchText } from './embeddings';

// Feature toggle for vector search
const USE_VECTOR_SEARCH = process.env.USE_VECTOR_SEARCH !== 'false';

// Search configuration
const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_MATCH_COUNT = 30;
const DEDUP_SIMILARITY_THRESHOLD = 0.8;

export interface ActivitySearchResult {
    id: string;
    code: string;
    name: string;
    description: string | null;
    base_hours: number;
    tech_category: string;
    group: string;
    similarity?: number;
}

export interface RequirementSearchResult {
    id: string;
    req_id: string;
    title: string;
    description: string | null;
    similarity: number;
}

export interface VectorSearchMetrics {
    method: 'vector' | 'fallback';
    latencyMs: number;
    resultCount: number;
    usedFallback: boolean;
    fallbackReason?: string;
}

/**
 * Get Supabase client for vector operations
 */
function getSupabaseClient(): SupabaseClient | null {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Search for similar activities using vector similarity
 * Falls back to category-based filtering if vector search fails
 * 
 * @param queryText - Text to search for (requirement description)
 * @param techCategories - Tech categories to filter by
 * @param matchCount - Maximum number of results
 * @param matchThreshold - Minimum similarity score (0-1)
 */
export async function searchSimilarActivities(
    queryText: string,
    techCategories: string[],
    matchCount: number = DEFAULT_MATCH_COUNT,
    matchThreshold: number = DEFAULT_MATCH_THRESHOLD
): Promise<{ results: ActivitySearchResult[]; metrics: VectorSearchMetrics }> {
    const startTime = Date.now();
    const metrics: VectorSearchMetrics = {
        method: 'vector',
        latencyMs: 0,
        resultCount: 0,
        usedFallback: false,
    };

    const supabase = getSupabaseClient();

    // Check if vector search is enabled and Supabase is available
    if (!USE_VECTOR_SEARCH) {
        metrics.usedFallback = true;
        metrics.fallbackReason = 'Vector search disabled by feature toggle';
        return {
            results: await fallbackActivitySearch(supabase, techCategories, matchCount),
            metrics: finalizeMetrics(metrics, startTime),
        };
    }

    if (!supabase) {
        metrics.usedFallback = true;
        metrics.fallbackReason = 'Supabase not configured';
        return {
            results: [],
            metrics: finalizeMetrics(metrics, startTime),
        };
    }

    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(queryText);

        // Call the search function
        const { data, error } = await supabase.rpc('search_similar_activities', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: matchThreshold,
            match_count: matchCount,
            tech_categories: techCategories,
        });

        if (error) {
            throw new Error(`Vector search RPC failed: ${error.message}`);
        }

        if (!data || data.length === 0) {
            // No results from vector search - fall back
            console.log('[vector-search] No results from vector search, using fallback');
            metrics.usedFallback = true;
            metrics.fallbackReason = 'No vector search results';
            return {
                results: await fallbackActivitySearch(supabase, techCategories, matchCount),
                metrics: finalizeMetrics(metrics, startTime),
            };
        }

        metrics.resultCount = data.length;
        console.log(`[vector-search] Found ${data.length} similar activities`);

        return {
            results: data as ActivitySearchResult[],
            metrics: finalizeMetrics(metrics, startTime),
        };
    } catch (err) {
        console.error('[vector-search] Error:', err);
        metrics.usedFallback = true;
        metrics.method = 'fallback';
        metrics.fallbackReason = err instanceof Error ? err.message : 'Unknown error';

        return {
            results: await fallbackActivitySearch(supabase, techCategories, matchCount),
            metrics: finalizeMetrics(metrics, startTime),
        };
    }
}

/**
 * Fallback: standard category-based activity search
 */
async function fallbackActivitySearch(
    supabase: SupabaseClient | null,
    techCategories: string[],
    limit: number
): Promise<ActivitySearchResult[]> {
    if (!supabase) {
        console.warn('[vector-search] No Supabase client for fallback');
        return [];
    }

    const { data, error } = await supabase
        .from('activities')
        .select('id, code, name, description, base_hours, tech_category, group')
        .in('tech_category', techCategories)
        .eq('active', true)
        .order('group')
        .order('base_hours')
        .limit(limit);

    if (error) {
        console.error('[vector-search] Fallback query failed:', error);
        return [];
    }

    return (data || []) as ActivitySearchResult[];
}

/**
 * Search for similar requirements (RAG for few-shot prompting)
 * 
 * @param queryText - Requirement description to search for
 * @param userId - Optional user ID to filter by user's own requirements
 * @param matchCount - Maximum number of results
 */
export async function searchSimilarRequirements(
    queryText: string,
    userId?: string,
    matchCount: number = 5
): Promise<{ results: RequirementSearchResult[]; metrics: VectorSearchMetrics }> {
    const startTime = Date.now();
    const metrics: VectorSearchMetrics = {
        method: 'vector',
        latencyMs: 0,
        resultCount: 0,
        usedFallback: false,
    };

    if (!USE_VECTOR_SEARCH) {
        metrics.usedFallback = true;
        metrics.fallbackReason = 'Vector search disabled';
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        metrics.usedFallback = true;
        metrics.fallbackReason = 'Supabase not configured';
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }

    try {
        const queryEmbedding = await generateEmbedding(queryText);

        const { data, error } = await supabase.rpc('search_similar_requirements', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            user_id_filter: userId || null,
            match_threshold: 0.6,
            match_count: matchCount,
        });

        if (error) {
            throw new Error(`Requirement search failed: ${error.message}`);
        }

        metrics.resultCount = data?.length || 0;
        return {
            results: (data || []) as RequirementSearchResult[],
            metrics: finalizeMetrics(metrics, startTime),
        };
    } catch (err) {
        console.error('[vector-search] Requirement search error:', err);
        metrics.usedFallback = true;
        metrics.fallbackReason = err instanceof Error ? err.message : 'Unknown error';
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }
}

/**
 * Find semantically similar activities for deduplication
 * Used when creating new custom activities
 * 
 * @param activityText - Combined name and description of new activity
 * @returns Similar activities with >80% similarity
 */
export async function findDuplicateActivities(
    activityText: string
): Promise<{ results: ActivitySearchResult[]; metrics: VectorSearchMetrics }> {
    const startTime = Date.now();
    const metrics: VectorSearchMetrics = {
        method: 'vector',
        latencyMs: 0,
        resultCount: 0,
        usedFallback: false,
    };

    if (!USE_VECTOR_SEARCH) {
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }

    try {
        const queryEmbedding = await generateEmbedding(activityText);

        const { data, error } = await supabase.rpc('find_duplicate_activities', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            similarity_threshold: DEDUP_SIMILARITY_THRESHOLD,
        });

        if (error) {
            throw new Error(`Duplicate search failed: ${error.message}`);
        }

        metrics.resultCount = data?.length || 0;
        return {
            results: (data || []) as ActivitySearchResult[],
            metrics: finalizeMetrics(metrics, startTime),
        };
    } catch (err) {
        console.error('[vector-search] Duplicate search error:', err);
        return { results: [], metrics: finalizeMetrics(metrics, startTime) };
    }
}

/**
 * Generate embedding for a new activity and save it
 * Called when creating new custom activities
 */
export async function saveActivityWithEmbedding(
    supabase: SupabaseClient,
    activityId: string,
    activity: { name: string; description?: string | null; code: string; group?: string }
): Promise<void> {
    if (!USE_VECTOR_SEARCH) {
        return;
    }

    try {
        const searchText = createActivitySearchText({
            name: activity.name,
            description: activity.description,
            code: activity.code,
            group: activity.group,
        });

        const embedding = await generateEmbedding(searchText);
        const vectorString = `[${embedding.join(',')}]`;

        await supabase
            .from('activities')
            .update({
                embedding: vectorString,
                embedding_updated_at: new Date().toISOString(),
            })
            .eq('id', activityId);

        console.log(`[vector-search] Saved embedding for activity ${activity.code}`);
    } catch (err) {
        console.error('[vector-search] Failed to save activity embedding:', err);
        // Non-fatal: don't block activity creation
    }
}

/**
 * Generate embedding for a requirement and save it
 */
export async function saveRequirementWithEmbedding(
    supabase: SupabaseClient,
    requirementId: string,
    requirement: { title: string; description?: string | null }
): Promise<void> {
    if (!USE_VECTOR_SEARCH) {
        return;
    }

    try {
        const searchText = createRequirementSearchText(requirement);
        const embedding = await generateEmbedding(searchText);
        const vectorString = `[${embedding.join(',')}]`;

        await supabase
            .from('requirements')
            .update({
                embedding: vectorString,
                embedding_updated_at: new Date().toISOString(),
            })
            .eq('id', requirementId);

        console.log(`[vector-search] Saved embedding for requirement ${requirementId}`);
    } catch (err) {
        console.error('[vector-search] Failed to save requirement embedding:', err);
    }
}

/**
 * Helper to finalize metrics
 */
function finalizeMetrics(metrics: VectorSearchMetrics, startTime: number): VectorSearchMetrics {
    metrics.latencyMs = Date.now() - startTime;
    return metrics;
}

/**
 * Export feature toggle status for monitoring
 */
export function isVectorSearchEnabled(): boolean {
    return USE_VECTOR_SEARCH;
}
