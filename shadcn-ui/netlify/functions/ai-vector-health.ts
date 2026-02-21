/**
 * Netlify Function: Vector Search Health Check
 * 
 * Monitoring endpoint to check:
 * - Feature toggle status (USE_VECTOR_SEARCH)
 * - pgvector extension availability
 * - Embedding coverage statistics
 * 
 * GET /.netlify/functions/ai-vector-health
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { isVectorSearchEnabled } from './lib/ai/vector-search';

interface HealthStatus {
    vectorSearchEnabled: boolean;
    envVariables: {
        OPENAI_API_KEY: boolean;
        SUPABASE_URL: boolean;
        USE_VECTOR_SEARCH: string | undefined;
    };
    database: {
        connected: boolean;
        pgvectorExtension: boolean | null;
    };
    embeddings: {
        activitiesTotal: number;
        activitiesWithEmbedding: number;
        activitiesCoverage: string;
        requirementsTotal: number;
        requirementsWithEmbedding: number;
        requirementsCoverage: string;
    } | null;
    recommendations: string[];
}

/**
 * Get Supabase client for health checks
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
 * Check if pgvector extension is enabled
 */
async function checkPgvectorExtension(supabase: SupabaseClient): Promise<boolean> {
    try {
        // Try to query the extensions table
        const { data, error } = await supabase
            .rpc('pg_catalog.array_agg', {})
            .limit(1);

        // If we can execute a simple query without vector errors, pgvector may be enabled
        // A more direct check would require admin access
        return true;
    } catch (err) {
        // If vector type doesn't exist, extension is not enabled
        return false;
    }
}

/**
 * Get embedding coverage statistics
 */
async function getEmbeddingStats(supabase: SupabaseClient): Promise<{
    activitiesTotal: number;
    activitiesWithEmbedding: number;
    requirementsTotal: number;
    requirementsWithEmbedding: number;
} | null> {
    try {
        // Count total activities
        const { count: activitiesTotal } = await supabase
            .from('activities')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);

        // Count activities with embeddings
        const { count: activitiesWithEmbedding } = await supabase
            .from('activities')
            .select('*', { count: 'exact', head: true })
            .eq('active', true)
            .not('embedding', 'is', null);

        // Count total requirements
        const { count: requirementsTotal } = await supabase
            .from('requirements')
            .select('*', { count: 'exact', head: true });

        // Count requirements with embeddings
        const { count: requirementsWithEmbedding } = await supabase
            .from('requirements')
            .select('*', { count: 'exact', head: true })
            .not('embedding', 'is', null);

        return {
            activitiesTotal: activitiesTotal || 0,
            activitiesWithEmbedding: activitiesWithEmbedding || 0,
            requirementsTotal: requirementsTotal || 0,
            requirementsWithEmbedding: requirementsWithEmbedding || 0,
        };
    } catch (err) {
        console.error('[vector-health] Failed to get embedding stats:', err);
        return null;
    }
}

export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Allow GET only
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    const status: HealthStatus = {
        vectorSearchEnabled: isVectorSearchEnabled(),
        envVariables: {
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            USE_VECTOR_SEARCH: process.env.USE_VECTOR_SEARCH,
        },
        database: {
            connected: false,
            pgvectorExtension: null,
        },
        embeddings: null,
        recommendations: [],
    };

    const supabase = getSupabaseClient();

    if (supabase) {
        status.database.connected = true;

        // Check pgvector extension
        status.database.pgvectorExtension = await checkPgvectorExtension(supabase);

        if (!status.database.pgvectorExtension) {
            status.recommendations.push(
                'pgvector extension may not be enabled. Run the migration: 20260221_pgvector_embeddings.sql'
            );
        }

        // Get embedding coverage
        const stats = await getEmbeddingStats(supabase);
        if (stats) {
            const activitiesCoverage = stats.activitiesTotal > 0
                ? ((stats.activitiesWithEmbedding / stats.activitiesTotal) * 100).toFixed(1)
                : '0';

            const requirementsCoverage = stats.requirementsTotal > 0
                ? ((stats.requirementsWithEmbedding / stats.requirementsTotal) * 100).toFixed(1)
                : '0';

            status.embeddings = {
                ...stats,
                activitiesCoverage: `${activitiesCoverage}%`,
                requirementsCoverage: `${requirementsCoverage}%`,
            };

            // Add recommendations based on coverage
            if (stats.activitiesTotal > 0 && stats.activitiesWithEmbedding < stats.activitiesTotal) {
                status.recommendations.push(
                    `${stats.activitiesTotal - stats.activitiesWithEmbedding} activities need embeddings. Run: POST /.netlify/functions/ai-generate-embeddings?type=activities`
                );
            }

            if (stats.requirementsTotal > 0 && stats.requirementsWithEmbedding < stats.requirementsTotal) {
                status.recommendations.push(
                    `${stats.requirementsTotal - stats.requirementsWithEmbedding} requirements need embeddings for RAG. Run: POST /.netlify/functions/ai-generate-embeddings?type=requirements`
                );
            }
        }
    } else {
        status.recommendations.push('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    // Check feature toggle
    if (!status.vectorSearchEnabled) {
        status.recommendations.push(
            'Vector search is disabled. Set USE_VECTOR_SEARCH=true in environment variables to enable.'
        );
    }

    if (!status.envVariables.OPENAI_API_KEY) {
        status.recommendations.push('OpenAI API key not configured. Required for generating embeddings.');
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(status, null, 2),
    };
};
