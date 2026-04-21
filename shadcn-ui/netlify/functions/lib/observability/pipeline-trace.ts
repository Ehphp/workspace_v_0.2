/**
 * pipeline-trace.ts — Structured observability record for one estimation run
 *
 * A PipelineTrace captures the full decision path of a single estimation
 * pipeline execution.  It is designed to be:
 *   - Returned inline in the API response (debug / dev mode)
 *   - Persisted to a DB table for longitudinal analysis
 *   - Logged as structured JSON for dashboards
 *
 * Key questions it answers over time:
 *   Q1. Is the agent consistently diverging from the deterministic baseline?
 *       → look at agentDelta.addedCount / removedCount averages
 *   Q2. Are signal weights calibrated?
 *       → compare signalBreakdown.weightedShare per source
 *   Q3. Is confidence correlated with estimation quality?
 *       → correlate aggregateConfidence with post-hoc feedback
 *   Q4. Is reflection adding value or just latency?
 *       → compare reflectionCount > 0 runs vs runs without
 */

import type { KillSwitches } from '../domain/pipeline/kill-switches';

// ─── Signal diagnostics ────────────────────────────────────────────────────

/** Aggregated stats for one signal source in this run */
export interface SignalSourceStat {
    /** Signal source identifier (e.g. 'blueprint', 'impact-map', 'keyword') */
    source: string;
    /** Number of normalized signals produced by this source */
    signalCount: number;
    /** Average score of the top-5 signals (or all if < 5) */
    topAvgScore: number;
    /** Fraction of final candidates that list this as their primarySource */
    primarySourceShare: number;
    /** All raw signals extracted by this source (capped at 50 for payload size) */
    rawSignals?: Array<{
        activityCode: string;
        score: number;
        confidence: number;
        provenance: string[];
    }>;
}

// ─── Agent delta ──────────────────────────────────────────────────────────

/**
 * Comparison between what the DecisionEngine (deterministic) would have
 * selected vs what the agent actually selected.
 *
 * A high overlap → agent and deterministic agree → deterministic may suffice.
 * Many `added` → agent expands coverage → potentially valuable.
 * Many `removed` → agent prunes; check if pruned items were noise.
 */
export interface AgentDelta {
    /** Activity codes the deterministic engine would have selected */
    deterministicSelected: string[];
    /** Activity codes the agent actually selected */
    agentSelected: string[];
    /** Codes present in agent but not in deterministic (agent expansions) */
    added: string[];
    /** Codes present in deterministic but not in agent (agent pruning) */
    removed: string[];
    /** Jaccard similarity between the two sets [0, 1] */
    overlapScore: number;
}

// ─── Root trace ───────────────────────────────────────────────────────────

export interface PipelineTrace {
    /** Unique identifier for this pipeline run (from agent executionId or generated) */
    requestId: string;
    /** ISO timestamp of pipeline start */
    timestamp: string;
    /** Total wall-clock duration in ms */
    durationMs: number;

    // ── Confidence / staleness ─────────────────────────────────────────────
    aggregateConfidence: number;
    candidateLimit: number;
    isStale: boolean;
    staleReasons: string[];

    // ── Signal breakdown ───────────────────────────────────────────────────
    signalSources: SignalSourceStat[];
    candidateCount: number;
    candidateSynthesisStrategy: string;

    // ── Pipeline path ──────────────────────────────────────────────────────
    /** Which path was taken this run */
    pipelineMode: 'agentic' | 'deterministic-fallback';
    /** Agent delta (undefined if deterministic fallback or delta disabled) */
    agentDelta?: AgentDelta;

    // ── Kill-switch snapshot ───────────────────────────────────────────────
    /** Active kill-switches for this run (for auditability) */
    killSwitches: KillSwitches;
}

// ─── Builders ─────────────────────────────────────────────────────────────

/**
 * Compute the Jaccard similarity between two sets of strings.
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 1 : Number((intersection / union).toFixed(3));
}

/**
 * Compute AgentDelta from two lists of activity codes.
 */
export function computeAgentDelta(
    deterministicCodes: string[],
    agentCodes: string[],
): AgentDelta {
    const detSet = new Set(deterministicCodes);
    const agentSet = new Set(agentCodes);

    const added   = agentCodes.filter(c => !detSet.has(c));
    const removed = deterministicCodes.filter(c => !agentSet.has(c));

    return {
        deterministicSelected: deterministicCodes,
        agentSelected:         agentCodes,
        added,
        removed,
        overlapScore: jaccardSimilarity(deterministicCodes, agentCodes),
    };
}
