/**
 * Signal Types — Common signal interface for all pipeline extractors
 *
 * Every extractor (blueprint-mapper, impact-map-extractor, understanding-extractor,
 * keyword-ranker) will converge to produce NormalizedSignal[].
 * This eliminates the 4-way marshalling in CandidateBuilder.
 *
 * @module signal-types
 */

import { z } from 'zod';

import {
    type PipelineLayer,
    type ProvenanceSource,
    type SignalKind,
    PipelineLayerSchema,
    ProvenanceSourceSchema,
    SignalKindSchema,
} from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// NormalizedSignal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single normalized signal from any pipeline extractor.
 * All scores are 0.0–1.0 (normalized at source, not by the consumer).
 */
export interface NormalizedSignal {
    /** Activity code from catalog (e.g. "PP_DV_FORM", "BE_API_SIMPLE") */
    activityCode: string;
    /** Relevance score, 0.0–1.0 (always normalized by the extractor) */
    score: number;
    /** How this signal was derived (e.g. 'blueprint-component', 'keyword-match') */
    kind: SignalKind;
    /** Which extractor produced this signal */
    source: ProvenanceSource;
    /** How confident the extractor is in this signal, 0.0–1.0 */
    confidence: number;
    /** Per-factor contribution breakdown (flexible, extractor-specific) */
    contributions: Record<string, number>;
    /** Human-readable provenance trail */
    provenance: string[];
    /** Which pipeline layer this signal relates to (when known) */
    layer?: PipelineLayer;
}

export const NormalizedSignalSchema = z.object({
    activityCode: z.string().min(1),
    score: z.number().min(0).max(1),
    kind: SignalKindSchema,
    source: ProvenanceSourceSchema,
    confidence: z.number().min(0).max(1),
    contributions: z.record(z.string(), z.number()),
    provenance: z.array(z.string()),
    layer: PipelineLayerSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SignalSet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A set of signals from a single extractor, with diagnostics.
 * Each extractor produces one SignalSet. The CandidateSynthesizer merges N SignalSets.
 */
export interface SignalSet {
    /** Signals produced by this extractor */
    signals: NormalizedSignal[];
    /** Which extractor produced this set */
    source: ProvenanceSource;
    /** Extraction diagnostics */
    diagnostics: SignalSetDiagnostics;
}

export interface SignalSetDiagnostics {
    /** How many input items were processed */
    processed: number;
    /** How many signals were produced */
    produced: number;
    /** Input terms that could not be mapped to any activity */
    unmapped: string[];
}

export const SignalSetDiagnosticsSchema = z.object({
    processed: z.number().int().min(0),
    produced: z.number().int().min(0),
    unmapped: z.array(z.string()),
});

export const SignalSetSchema = z.object({
    signals: z.array(NormalizedSignalSchema),
    source: ProvenanceSourceSchema,
    diagnostics: SignalSetDiagnosticsSchema,
});
