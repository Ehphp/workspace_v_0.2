/**
 * candidate.types.ts — Canonical candidate types for the estimation pipeline
 *
 * Single source of truth for ScoredCandidate, ScoreContributions, CandidateSource.
 * These were previously defined in candidate-builder.ts (a top-level lib file),
 * causing domain/pipeline modules to reach UP and OUT of the domain layer.
 *
 * Consumers:
 *   - candidate-synthesizer.ts  (produces ScoredCandidate[])
 *   - decision-engine.ts        (consumes ScoredCandidate[])
 *   - decision-engine.types.ts  (DecisionEngineInput/Output contracts)
 *   - candidate-builder.ts      (legacy builder, re-exports from here)
 */

import type { Activity } from '../../activities';
import type { SignalKind } from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// CandidateSource
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible signal source labels on a ScoredCandidate.
 * Extends SignalKind with legacy values still present in candidate-builder.ts.
 */
export type CandidateSource =
    | SignalKind
    | 'impact-map'
    | 'impact-map-exclusive'
    | 'understanding';

// ─────────────────────────────────────────────────────────────────────────────
// ScoreContributions
// ─────────────────────────────────────────────────────────────────────────────

/** Numeric contribution breakdown by signal source for a single candidate */
export interface ScoreContributions {
    /** Score from Blueprint mapping (0 if not present) */
    blueprint: number;
    /** Score from ImpactMap signal extraction (0 if not present) */
    impactMap: number;
    /** Score from Understanding signal extraction (0 if not present) */
    understanding: number;
    /** Score from keyword ranking (0 if not present) */
    keyword: number;
    /** Score from project context biases (0 if not present) */
    projectContext: number;
    /** Score from project-scoped activities (0 if not present) */
    projectActivity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoredCandidate
// ─────────────────────────────────────────────────────────────────────────────

/** A candidate activity with mandatory provenance — output of any candidate builder */
export interface ScoredCandidate {
    /** Activity from catalog */
    activity: Activity;
    /** Final merged score (higher = more relevant) */
    score: number;
    /** All sources that contributed to this candidate */
    sources: CandidateSource[];
    /** Numeric contribution breakdown */
    contributions: ScoreContributions;
    /** Human-readable provenance chain */
    provenance: string[];
    /** Primary source (highest contributor) */
    primarySource: CandidateSource;
    /** Mapping confidence (0–1) */
    confidence: number;
}
