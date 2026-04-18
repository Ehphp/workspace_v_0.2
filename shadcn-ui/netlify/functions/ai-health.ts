/**
 * Netlify Function: Consolidated AI Health Check
 *
 * Unifies OpenAI circuit breaker status, database connectivity,
 * Redis, pgvector, RAG metrics, and embedding coverage into a
 * single endpoint.
 *
 * GET /.netlify/functions/ai-health
 *
 * Returns a `status` field:
 * - `healthy`   — everything ok
 * - `degraded`  — CB HALF_OPEN or Redis down (rate limiting falls back to in-memory)
 * - `unhealthy` — CB OPEN or DB not connected
 *
 * @since Sprint 3 (S3-4)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';
import { getCircuitBreakerStats } from './lib/infrastructure/llm/openai-client';
import { isVectorSearchEnabled } from './lib/infrastructure/llm/vector-search';
import { getRAGMetrics, type RAGMetrics } from './lib/infrastructure/llm/rag-metrics';
import { getRedisClient } from './lib/infrastructure/cache/redis-client';
import type { CircuitBreakerStats } from './lib/infrastructure/llm/circuit-breaker';

// ── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ConsolidatedHealth {
    status: HealthStatus;
    timestamp: string;
    openai: {
        configured: boolean;
        circuitBreaker: CircuitBreakerStats;
    };
    database: {
        connected: boolean;
        pgvectorExtension: boolean | null;
        latencyMs: number;
    };
    redis: {
        connected: boolean;
        latencyMs: number | null;
    };
    vectorSearch: {
        enabled: boolean;
    };
    embeddings: {
        activitiesTotal: number;
        activitiesWithEmbedding: number;
        activitiesCoverage: string;
        requirementsTotal: number;
        requirementsWithEmbedding: number;
        requirementsCoverage: string;
    } | null;
    rag: RAGMetrics | null;
    recommendations: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSupabaseClient(): SupabaseClient | null {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

async function checkDatabase(supabase: SupabaseClient): Promise<{
    connected: boolean;
    pgvector: boolean | null;
    latencyMs: number;
}> {
    const t0 = Date.now();
    try {
        const { error } = await supabase
            .from('technologies')
            .select('id')
            .limit(1);
        const latencyMs = Date.now() - t0;
        return { connected: !error, pgvector: null, latencyMs };
    } catch {
        return { connected: false, pgvector: null, latencyMs: Date.now() - t0 };
    }
}

async function checkPgvector(supabase: SupabaseClient): Promise<boolean> {
    try {
        // Check if any activities have embeddings — implies pgvector is working
        const { count } = await supabase
            .from('activities')
            .select('*', { count: 'exact', head: true })
            .not('embedding', 'is', null);
        return (count ?? 0) > 0;
    } catch {
        return false;
    }
}

async function checkRedis(): Promise<{ connected: boolean; latencyMs: number | null }> {
    const t0 = Date.now();
    try {
        const client = await getRedisClient();
        await client.ping();
        return { connected: true, latencyMs: Date.now() - t0 };
    } catch {
        return { connected: false, latencyMs: null };
    }
}

async function getEmbeddingStats(supabase: SupabaseClient) {
    try {
        const [
            { count: activitiesTotal },
            { count: activitiesWithEmbedding },
            { count: requirementsTotal },
            { count: requirementsWithEmbedding },
        ] = await Promise.all([
            supabase.from('activities').select('*', { count: 'exact', head: true }).eq('active', true),
            supabase.from('activities').select('*', { count: 'exact', head: true }).eq('active', true).not('embedding', 'is', null),
            supabase.from('requirements').select('*', { count: 'exact', head: true }),
            supabase.from('requirements').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
        ]);

        const at = activitiesTotal ?? 0;
        const ae = activitiesWithEmbedding ?? 0;
        const rt = requirementsTotal ?? 0;
        const re = requirementsWithEmbedding ?? 0;

        return {
            activitiesTotal: at,
            activitiesWithEmbedding: ae,
            activitiesCoverage: at > 0 ? `${((ae / at) * 100).toFixed(1)}%` : '0%',
            requirementsTotal: rt,
            requirementsWithEmbedding: re,
            requirementsCoverage: rt > 0 ? `${((re / rt) * 100).toFixed(1)}%` : '0%',
        };
    } catch {
        return null;
    }
}

function deriveStatus(
    cbState: string,
    dbConnected: boolean,
    redisConnected: boolean,
): HealthStatus {
    // Unhealthy if CB is open or DB unreachable
    if (cbState === 'OPEN' || !dbConnected) return 'unhealthy';
    // Degraded if CB half-open or Redis down
    if (cbState === 'HALF_OPEN' || !redisConnected) return 'degraded';
    return 'healthy';
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (
    event: HandlerEvent,
    _context: HandlerContext,
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // ── Gather health probes in parallel ────────────────────────────────
    const cbStats = getCircuitBreakerStats();

    const supabase = getSupabaseClient();

    const [dbResult, redisResult] = await Promise.all([
        supabase
            ? checkDatabase(supabase)
            : Promise.resolve({ connected: false, pgvector: null as boolean | null, latencyMs: 0 }),
        checkRedis(),
    ]);

    // Pgvector + embeddings (only if DB connected)
    let pgvector: boolean | null = null;
    let embeddings: ConsolidatedHealth['embeddings'] = null;
    if (supabase && dbResult.connected) {
        [pgvector, embeddings] = await Promise.all([
            checkPgvector(supabase),
            getEmbeddingStats(supabase),
        ]);
    }

    // RAG metrics (in-memory, may be null right after cold start)
    let rag: RAGMetrics | null = null;
    try {
        const m = getRAGMetrics();
        rag = m.totalCalls > 0 ? m : null;
    } catch {
        rag = null;
    }

    // ── Build recommendations ───────────────────────────────────────────
    const recommendations: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
        recommendations.push('OpenAI API key not configured.');
    }
    if (cbStats.state === 'OPEN') {
        recommendations.push(
            `OpenAI circuit breaker is OPEN (${cbStats.failures} consecutive failures). AI calls are fast-failing. Will probe again after reset timeout.`,
        );
    }
    if (!dbResult.connected) {
        recommendations.push('Database is unreachable. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
    }
    if (!redisResult.connected) {
        recommendations.push('Redis is unreachable. Rate limiting will fall back to in-memory.');
    }
    if (pgvector === false) {
        recommendations.push('pgvector extension may not be enabled. Run the migration: 20260221_pgvector_embeddings.sql');
    }
    if (!isVectorSearchEnabled()) {
        recommendations.push('Vector search is disabled. Set USE_VECTOR_SEARCH=true to enable.');
    }

    // ── Assemble response ───────────────────────────────────────────────
    const status = deriveStatus(cbStats.state, dbResult.connected, redisResult.connected);

    const body: ConsolidatedHealth = {
        status,
        timestamp: new Date().toISOString(),
        openai: {
            configured: !!process.env.OPENAI_API_KEY,
            circuitBreaker: cbStats,
        },
        database: {
            connected: dbResult.connected,
            pgvectorExtension: pgvector,
            latencyMs: dbResult.latencyMs,
        },
        redis: {
            connected: redisResult.connected,
            latencyMs: redisResult.latencyMs,
        },
        vectorSearch: {
            enabled: isVectorSearchEnabled(),
        },
        embeddings,
        rag,
        recommendations,
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(body, null, 2),
    };
};
