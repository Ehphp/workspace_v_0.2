/**
 * RAG Metrics — In-memory telemetry for Retrieval-Augmented Generation.
 *
 * Tracks call counts, hit/miss rate, similarity scores and latency.
 * Metrics are reset on each cold start (acceptable for single-instance
 * monitoring; a future sprint may persist to Redis).
 *
 * Sprint 2 — S2-4
 */

// ── Types ──────────────────────────────────────────────

export interface RAGMetrics {
    totalCalls: number;
    hits: number;
    misses: number;
    hitRate: string;              // "XX.X%"
    avgSimilarity: number;
    avgExamplesPerHit: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    lastResetAt: string;          // ISO-8601
}

export interface RAGCallContext {
    hasExamples: boolean;
    exampleCount: number;
    examplesWithActuals?: number;  // S4-1: count of examples with actual_hours
    avgSimilarity: number;
    latencyMs: number;
}

// ── Store ──────────────────────────────────────────────

interface MetricsStore {
    calls: number;
    hits: number;
    similarities: number[];
    examplesPerHit: number[];
    latencies: number[];
    startedAt: string;
}

function createEmptyStore(): MetricsStore {
    return {
        calls: 0,
        hits: 0,
        similarities: [],
        examplesPerHit: [],
        latencies: [],
        startedAt: new Date().toISOString(),
    };
}

let store: MetricsStore = createEmptyStore();

// ── Helpers ────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── Public API ─────────────────────────────────────────

/**
 * Record one RAG retrieval call.
 */
export function recordRAGCall(ctx: RAGCallContext): void {
    store.calls++;
    store.latencies.push(ctx.latencyMs);

    if (ctx.hasExamples) {
        store.hits++;
        store.examplesPerHit.push(ctx.exampleCount);
    }

    if (ctx.avgSimilarity > 0) {
        store.similarities.push(ctx.avgSimilarity);
    }

    // Keep arrays bounded to avoid unbounded memory growth
    const MAX = 10_000;
    if (store.latencies.length > MAX) store.latencies = store.latencies.slice(-MAX);
    if (store.similarities.length > MAX) store.similarities = store.similarities.slice(-MAX);
    if (store.examplesPerHit.length > MAX) store.examplesPerHit = store.examplesPerHit.slice(-MAX);
}

/**
 * Compute aggregate metrics from the in-memory store.
 */
export function getRAGMetrics(): RAGMetrics {
    const misses = store.calls - store.hits;
    const hitRate = store.calls > 0
        ? ((store.hits / store.calls) * 100).toFixed(1)
        : '0.0';

    const sortedLatencies = [...store.latencies].sort((a, b) => a - b);

    return {
        totalCalls: store.calls,
        hits: store.hits,
        misses,
        hitRate: `${hitRate}%`,
        avgSimilarity: Math.round(avg(store.similarities) * 1000) / 1000,
        avgExamplesPerHit: Math.round(avg(store.examplesPerHit) * 10) / 10,
        avgLatencyMs: Math.round(avg(store.latencies)),
        p95LatencyMs: Math.round(percentile(sortedLatencies, 95)),
        lastResetAt: store.startedAt,
    };
}

/**
 * Reset all metrics (useful for testing or manual reset via admin endpoint).
 */
export function resetRAGMetrics(): void {
    store = createEmptyStore();
}
