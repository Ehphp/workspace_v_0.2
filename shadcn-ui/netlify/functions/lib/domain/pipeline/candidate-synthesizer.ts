/**
 * CandidateSynthesizer — Multi-signal merge into scored candidate set
 *
 * Replaces the ad-hoc merging logic in CandidateBuilder with a clean,
 * deterministic pipeline:
 *
 *   1. Collect all NormalizedSignals from N SignalSets
 *   2. Group by activityCode
 *   3. Weighted merge using SOURCE_WEIGHTS (blueprint=3.0, impact-map=2.0, etc.)
 *   4. Conflict detection (multiple signals disagree on layer)
 *   5. Gap detection (layers in LAYER_PRIORITY HIGH with no coverage)
 *   6. Build ScoredCandidate[] compatible with DecisionEngine input
 *
 * Rule: if a decision is not traceable, it's wrong.
 *
 * @module candidate-synthesizer
 */

import type { Activity } from '../../activities';
import type { NormalizedSignal, SignalSet } from './signal-types';
import type { ScoredCandidate, ScoreContributions, CandidateSource } from '../../candidate-builder';
import {
    type PipelineLayer,
    type ProvenanceSource,
    PIPELINE_LAYERS,
    LAYER_PRIORITY,
    SOURCE_WEIGHTS,
} from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SynthesizerInput {
    /** Signal sets from all extractors */
    signalSets: SignalSet[];
    /** Full activity catalog (pre-filtered by technology) */
    catalog: Activity[];
    /** Technology category code (e.g. 'POWER_PLATFORM') */
    techCategory: string;
    /** Optional configuration overrides */
    config?: Partial<SynthesizerConfig>;
}

export interface SynthesizerConfig {
    /** Maximum candidates to produce (default: 25 — more than DecisionEngine maxSelected) */
    maxCandidates: number;
    /** Minimum weighted score to include a candidate (default: 0.05) */
    minScore: number;
}

const DEFAULT_SYNTHESIZER_CONFIG: SynthesizerConfig = {
    maxCandidates: 25,
    minScore: 0.05,
};

export interface SynthesizedCandidateSet {
    /** Scored candidates, sorted by score descending */
    candidates: ScoredCandidate[];
    /** Which signal sets contributed */
    signalSummary: SignalSummary;
    /** Per-layer coverage analysis */
    layerCoverage: Record<PipelineLayer, LayerCoverageInfo>;
    /** Layers with LAYER_PRIORITY HIGH that have no candidates */
    gaps: PipelineLayer[];
    /** Detected conflicts between signals */
    conflicts: SynthesisConflict[];
    /** Which sources contributed (for strategy label) */
    strategy: string;
    /** Diagnostic counts */
    diagnostics: SynthesisDiagnostics;
}

export interface SignalSummary {
    /** Total signals received across all sets */
    totalSignals: number;
    /** Breakdown by source */
    bySource: Record<ProvenanceSource, number>;
    /** Unique activity codes seen */
    uniqueActivities: number;
    /** Total unmapped terms across all sets */
    totalUnmapped: number;
}

export interface LayerCoverageInfo {
    /** Whether at least one candidate covers this layer */
    covered: boolean;
    /** Number of candidates in this layer */
    count: number;
    /** Highest score among candidates in this layer */
    topScore: number;
    /** Priority of this layer from LAYER_PRIORITY */
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SynthesisConflict {
    /** Activity code where conflict was detected */
    activityCode: string;
    /** Conflicting layers assigned by different signals */
    layers: PipelineLayer[];
    /** Sources that disagree */
    sources: ProvenanceSource[];
    /** Human-readable conflict description */
    message: string;
}

export interface SynthesisDiagnostics {
    /** Total signals processed */
    totalSignals: number;
    /** Unique activity codes across all signals */
    uniqueActivities: number;
    /** Activities from each source */
    fromBlueprint: number;
    fromImpactMap: number;
    fromUnderstanding: number;
    fromKeyword: number;
    fromContext: number;
    /** Activities that had signals from multiple sources */
    mergedOverlaps: number;
    /** Final candidate count after scoring and cap */
    finalCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Signal Accumulator per activity
// ─────────────────────────────────────────────────────────────────────────────

interface AccumulatedActivity {
    activityCode: string;
    activity: Activity | undefined;
    signals: NormalizedSignal[];
    sourceSet: Set<ProvenanceSource>;
    layers: Set<PipelineLayer>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Synthesis Algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthesize a scored candidate set from multiple signal sources.
 *
 * Algorithm:
 *   1. Collect: flatten all signals from all SignalSets
 *   2. Group: bucket by activityCode
 *   3. Resolve: look up each activityCode in the catalog
 *   4. Score: weighted merge per source (SOURCE_WEIGHTS)
 *   5. Conflicts: detect layer disagreements
 *   6. Coverage: compute per-layer coverage, identify gaps
 *   7. Cap: sort by score, cap at maxCandidates
 */
export function synthesizeCandidates(input: SynthesizerInput): SynthesizedCandidateSet {
    const config = { ...DEFAULT_SYNTHESIZER_CONFIG, ...input.config };

    // Build catalog index for O(1) lookup
    const catalogByCode = new Map<string, Activity>();
    for (const act of input.catalog) {
        catalogByCode.set(act.code, act);
    }

    // ── Step 1+2: Collect and group signals by activityCode ──────────
    const accumulated = new Map<string, AccumulatedActivity>();

    for (const signalSet of input.signalSets) {
        for (const signal of signalSet.signals) {
            let entry = accumulated.get(signal.activityCode);
            if (!entry) {
                entry = {
                    activityCode: signal.activityCode,
                    activity: catalogByCode.get(signal.activityCode),
                    signals: [],
                    sourceSet: new Set(),
                    layers: new Set(),
                };
                accumulated.set(signal.activityCode, entry);
            }
            entry.signals.push(signal);
            entry.sourceSet.add(signal.source);
            if (signal.layer) {
                entry.layers.add(signal.layer);
            }
        }
    }

    // ── Step 3: Filter out activities not in catalog ─────────────────
    // Only keep activities that exist in the catalog
    const validEntries = [...accumulated.values()].filter(e => e.activity !== undefined);

    // ── Step 4: Weighted merge → ScoredCandidate ────────────────────
    const candidates: ScoredCandidate[] = [];
    const sourceActivityCounts: Record<ProvenanceSource, Set<string>> = {
        blueprint: new Set(),
        'impact-map': new Set(),
        understanding: new Set(),
        keyword: new Set(),
        context: new Set(),
        manual: new Set(),
    };

    for (const entry of validEntries) {
        // Group signals by source for weighted scoring
        const bySource = new Map<ProvenanceSource, NormalizedSignal[]>();
        for (const sig of entry.signals) {
            const list = bySource.get(sig.source) || [];
            list.push(sig);
            bySource.set(sig.source, list);
        }

        // Compute weighted score: sum(bestScorePerSource * weight) / sum(weights_present)
        let weightedSum = 0;
        let weightTotal = 0;
        const contributions: ScoreContributions = {
            blueprint: 0,
            impactMap: 0,
            understanding: 0,
            keyword: 0,
            projectContext: 0,
        };

        for (const [source, signals] of bySource) {
            const bestScore = Math.max(...signals.map(s => s.score));
            const weight = SOURCE_WEIGHTS[source] ?? 0;
            weightedSum += bestScore * weight;
            weightTotal += weight;

            // Map ProvenanceSource to ScoreContributions key
            switch (source) {
                case 'blueprint': contributions.blueprint = bestScore; break;
                case 'impact-map': contributions.impactMap = bestScore; break;
                case 'understanding': contributions.understanding = bestScore; break;
                case 'keyword': contributions.keyword = bestScore; break;
                case 'context': contributions.projectContext = bestScore; break;
            }

            // Track per-source activity counts
            sourceActivityCounts[source].add(entry.activityCode);
        }

        const finalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

        if (finalScore < config.minScore) continue;

        // Determine primary source (highest weighted contribution)
        const sources: CandidateSource[] = [...entry.sourceSet] as CandidateSource[];
        const primarySource = determinePrimarySource(entry.signals);

        // Merge provenance trails
        const provenance = entry.signals.flatMap(s => s.provenance);
        // Deduplicate provenance while preserving order
        const uniqueProvenance = [...new Set(provenance)];

        // Average confidence across all signals
        const avgConfidence = entry.signals.reduce((sum, s) => sum + s.confidence, 0) / entry.signals.length;

        candidates.push({
            activity: entry.activity!,
            score: Math.round(finalScore * 1000) / 1000,
            sources,
            contributions,
            provenance: uniqueProvenance,
            primarySource,
            confidence: Math.round(avgConfidence * 1000) / 1000,
        });
    }

    // ── Step 5: Conflict detection ──────────────────────────────────
    const conflicts: SynthesisConflict[] = [];
    for (const entry of validEntries) {
        if (entry.layers.size > 1) {
            conflicts.push({
                activityCode: entry.activityCode,
                layers: [...entry.layers],
                sources: [...entry.sourceSet],
                message: `Activity ${entry.activityCode} assigned to multiple layers by different sources: [${[...entry.layers].join(', ')}]`,
            });
        }
    }

    // ── Step 6: Sort + cap ──────────────────────────────────────────
    candidates.sort((a, b) => b.score - a.score);
    const capped = candidates.slice(0, config.maxCandidates);

    // ── Step 7: Layer coverage + gaps ───────────────────────────────
    const layerCoverage = computeLayerCoverage(capped, accumulated);
    const gaps = PIPELINE_LAYERS.filter(
        layer => LAYER_PRIORITY[layer] === 'HIGH' && !layerCoverage[layer].covered
    );

    // ── Build signal summary ────────────────────────────────────────
    const totalSignals = input.signalSets.reduce((sum, ss) => sum + ss.signals.length, 0);
    const bySource: Record<ProvenanceSource, number> = {
        blueprint: 0, 'impact-map': 0, understanding: 0,
        keyword: 0, context: 0, manual: 0,
    };
    for (const ss of input.signalSets) {
        bySource[ss.source] = (bySource[ss.source] || 0) + ss.signals.length;
    }
    const totalUnmapped = input.signalSets.reduce(
        (sum, ss) => sum + ss.diagnostics.unmapped.length, 0
    );

    // ── Count overlaps (activities seen by >1 source) ───────────────
    let mergedOverlaps = 0;
    for (const entry of validEntries) {
        if (entry.sourceSet.size > 1) mergedOverlaps++;
    }

    // ── Strategy label ──────────────────────────────────────────────
    const activeSources = input.signalSets
        .filter(ss => ss.signals.length > 0)
        .map(ss => ss.source);
    const strategy = activeSources.length > 0
        ? activeSources.join('+')
        : 'empty';

    return {
        candidates: capped,
        signalSummary: {
            totalSignals,
            bySource,
            uniqueActivities: accumulated.size,
            totalUnmapped,
        },
        layerCoverage,
        gaps,
        conflicts,
        strategy,
        diagnostics: {
            totalSignals,
            uniqueActivities: accumulated.size,
            fromBlueprint: sourceActivityCounts.blueprint.size,
            fromImpactMap: sourceActivityCounts['impact-map'].size,
            fromUnderstanding: sourceActivityCounts.understanding.size,
            fromKeyword: sourceActivityCounts.keyword.size,
            fromContext: sourceActivityCounts.context.size,
            mergedOverlaps,
            finalCount: capped.length,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the primary source based on highest weighted contribution.
 */
function determinePrimarySource(signals: NormalizedSignal[]): CandidateSource {
    let bestScore = -1;
    let bestSource: ProvenanceSource = 'keyword';

    const bySource = new Map<ProvenanceSource, number>();
    for (const sig of signals) {
        const weight = SOURCE_WEIGHTS[sig.source] ?? 0;
        const weighted = sig.score * weight;
        const current = bySource.get(sig.source) || 0;
        if (weighted > current) {
            bySource.set(sig.source, weighted);
        }
    }

    for (const [source, score] of bySource) {
        if (score > bestScore) {
            bestScore = score;
            bestSource = source;
        }
    }

    // Map provenance source back to CandidateSource
    // For blueprint, use the first signal's kind as it's more specific
    if (bestSource === 'blueprint') {
        const blueprintSignal = signals.find(s => s.source === 'blueprint');
        if (blueprintSignal) return blueprintSignal.kind as CandidateSource;
    }

    return bestSource as CandidateSource;
}

/**
 * Compute per-layer coverage from final candidates.
 */
function computeLayerCoverage(
    candidates: ScoredCandidate[],
    accumulated: Map<string, AccumulatedActivity>,
): Record<PipelineLayer, LayerCoverageInfo> {
    const coverage: Record<PipelineLayer, LayerCoverageInfo> = {} as any;

    for (const layer of PIPELINE_LAYERS) {
        coverage[layer] = {
            covered: false,
            count: 0,
            topScore: 0,
            priority: LAYER_PRIORITY[layer],
        };
    }

    for (const candidate of candidates) {
        const entry = accumulated.get(candidate.activity.code);
        if (!entry) continue;

        for (const layer of entry.layers) {
            const lc = coverage[layer];
            if (lc) {
                lc.covered = true;
                lc.count++;
                if (candidate.score > lc.topScore) {
                    lc.topScore = candidate.score;
                }
            }
        }
    }

    return coverage;
}
