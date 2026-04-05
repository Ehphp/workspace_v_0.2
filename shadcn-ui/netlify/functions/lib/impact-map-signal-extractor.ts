/**
 * Impact Map → Signal Extractor
 *
 * Deterministic signal extraction layer that derives candidate activity
 * codes from an Impact Map's layer/action/components structure.
 *
 * This is the FIRST signal extractor in the CandidateBuilder architecture.
 * It reads the ImpactMap structurally (not as text), producing scored
 * signals with full provenance.
 *
 * Contract:
 *   - Every signal has score, sources, contributions — no exceptions.
 *   - If a signal can't be traced, it doesn't enter the system.
 *   - Uses the same LAYER_TECH_PATTERNS as the BlueprintActivityMapper
 *     (single source of truth for layer → activity code mapping).
 *
 * Flow:
 *   ImpactMap.impacts[] → layer + action + confidence → LAYER_TECH_PATTERNS
 *   → matched activity codes with provenance
 */

import type { ImpactMap, ImpactItem, ImpactLayer, ImpactAction } from '../../../src/types/impact-map';
import type { Activity } from './activities';
import {
    LAYER_TECH_PATTERNS,
    UNSUPPORTED_LAYERS,
    findBestMatch,
    buildCatalogIndexes,
} from './blueprint-activity-mapper';
import type { PipelineLayer } from './domain/pipeline/pipeline-domain';
import type { NormalizedSignal, SignalSet } from './domain/pipeline/signal-types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single signal extracted from an ImpactMap impact entry */
export interface ImpactMapSignal {
    /** Activity code identified */
    activityCode: string;
    /** Computed score for this signal (0.0–1.0) */
    score: number;
    /** Which sources contributed to this signal */
    sources: ('impact-map-layer' | 'impact-map-action' | 'impact-map-components')[];
    /** Numeric contribution breakdown */
    contributions: {
        /** Layer match score */
        layerMatch: number;
        /** Action severity weight */
        actionWeight: number;
        /** Impact confidence from AI */
        impactConfidence: number;
        /** Component count density bonus */
        componentDensity: number;
    };
    /** Human-readable provenance chain */
    provenance: string[];
}

/** Result of extracting signals from a full ImpactMap */
export interface ImpactMapExtractionResult {
    /** Scored signals, sorted by score descending */
    signals: ImpactMapSignal[];
    /** Layers that had no matching patterns */
    unmappedLayers: string[];
    /** Total impacts processed */
    impactsProcessed: number;
    /** Total signals produced */
    signalsProduced: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action → weight mapping
//
// The Impact Map uses action types (read, modify, create, configure) to
// describe WHAT kind of structural change is needed.  We convert these to
// weights that modulate the signal score:
//   create    > modify    > configure > read
//   (new work)  (change)    (setup)     (no code change)
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_WEIGHTS: Record<ImpactAction, number> = {
    create: 1.0,
    modify: 0.8,
    configure: 0.5,
    read: 0.2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Action → intervention type mapping
//
// Maps ImpactMap actions to the intervention types used in LAYER_TECH_PATTERNS,
// so pattern filtering works correctly.
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_TO_INTERVENTIONS: Record<ImpactAction, string[]> = {
    create: ['new_development'],
    modify: ['modification', 'new_development'],
    configure: ['configuration'],
    read: ['modification', 'configuration'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Component density bonus
//
// More components on a layer = more work likely.
// Capped to avoid runaway scores.
// ─────────────────────────────────────────────────────────────────────────────

function componentDensityBonus(componentCount: number): number {
    if (componentCount <= 1) return 0;
    if (componentCount <= 3) return 0.1;
    if (componentCount <= 6) return 0.2;
    return 0.3; // cap
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Extraction Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract signals from a single ImpactItem.
 *
 * For each impact, we:
 * 1. Look up patterns in LAYER_TECH_PATTERNS[techCategory][impact.layer]
 * 2. Filter by intervention type (derived from impact.action)
 * 3. Resolve each pattern to a real activity via findBestMatch
 * 4. Compute score = layerMatch * actionWeight * impactConfidence + densityBonus
 * 5. Build full provenance chain
 */
function extractFromImpact(
    impact: ImpactItem,
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
): { signals: ImpactMapSignal[]; unmapped: boolean } {
    const signals: ImpactMapSignal[] = [];
    const seen = new Set<string>();

    // Check unsupported layer
    if (UNSUPPORTED_LAYERS.has(impact.layer)) {
        return { signals: [], unmapped: true };
    }

    const techPatterns = LAYER_TECH_PATTERNS[techCategory];
    if (!techPatterns) {
        return { signals: [], unmapped: true };
    }

    const layerPatterns = techPatterns[impact.layer];
    if (!layerPatterns || layerPatterns.length === 0) {
        return { signals: [], unmapped: true };
    }

    // Which intervention types this action maps to
    const relevantInterventions = ACTION_TO_INTERVENTIONS[impact.action] || [];

    // Complexity heuristic from component count
    const complexity = impact.components.length > 4 ? 'HIGH'
        : impact.components.length <= 1 ? 'LOW'
            : undefined; // MEDIUM

    const actionWeight = ACTION_WEIGHTS[impact.action] ?? 0.5;
    const density = componentDensityBonus(impact.components.length);

    for (const pattern of layerPatterns) {
        // Filter: pattern must cover at least one relevant intervention
        const hasMatchingIntervention = pattern.interventions.some(
            i => relevantInterventions.includes(i)
        );
        if (!hasMatchingIntervention) continue;

        // Complexity routing for SIMPLE/COMPLEX pairs
        const isSimplePrefix = pattern.prefix.endsWith('_SIMPLE');
        const isComplexPrefix = pattern.prefix.endsWith('_COMPLEX');
        if (isSimplePrefix && complexity === 'HIGH') continue;
        if (isComplexPrefix && (complexity === 'LOW' || complexity === undefined)) continue;

        const match = findBestMatch(catalog, catalogByPrefix, pattern.prefix, complexity);
        if (!match || seen.has(match.code)) continue;
        seen.add(match.code);

        // Score = base layerMatch (1.0) * actionWeight * impactConfidence + density
        const layerMatch = 1.0;
        const rawScore = layerMatch * actionWeight * impact.confidence + density;
        const score = Math.min(1.0, Math.max(0, rawScore));

        const sources: ImpactMapSignal['sources'] = ['impact-map-layer'];
        if (actionWeight > 0.2) sources.push('impact-map-action');
        if (impact.components.length > 0) sources.push('impact-map-components');

        signals.push({
            activityCode: match.code,
            score,
            sources,
            contributions: {
                layerMatch,
                actionWeight,
                impactConfidence: impact.confidence,
                componentDensity: density,
            },
            provenance: [
                `impact-map:${impact.layer}`,
                `action:${impact.action}`,
                `pattern:${pattern.prefix}`,
                `resolved:${match.code}`,
                `components:[${impact.components.join(', ')}]`,
                `reason:${impact.reason.slice(0, 80)}`,
            ],
        });
    }

    return { signals, unmapped: signals.length === 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract candidate activity signals from an Impact Map.
 *
 * This function reads the ImpactMap STRUCTURALLY — it does not parse text,
 * does not use keyword matching, and does not depend on AI interpretation.
 * The mapping is deterministic: same ImpactMap + same catalog = same signals.
 *
 * @param impactMap     Confirmed Impact Map artifact
 * @param catalog       Activity catalog (already filtered by technology)
 * @param techCategory  Technology category (POWER_PLATFORM, BACKEND, FRONTEND)
 * @returns Extraction result with scored signals and diagnostics
 */
export function extractImpactMapSignals(
    impactMap: ImpactMap,
    catalog: Activity[],
    techCategory: string,
): ImpactMapExtractionResult {
    if (!impactMap.impacts || impactMap.impacts.length === 0) {
        return {
            signals: [],
            unmappedLayers: [],
            impactsProcessed: 0,
            signalsProduced: 0,
        };
    }

    const { byCode, byPrefix } = buildCatalogIndexes(catalog);

    const allSignals: ImpactMapSignal[] = [];
    const unmappedLayers: string[] = [];
    const seenCodes = new Set<string>();

    for (const impact of impactMap.impacts) {
        const { signals, unmapped } = extractFromImpact(
            impact, techCategory, byCode, byPrefix,
        );

        if (unmapped) {
            unmappedLayers.push(impact.layer);
        }

        // Deduplicate across impacts: keep highest score per activity code
        for (const signal of signals) {
            if (seenCodes.has(signal.activityCode)) {
                // Replace if higher score
                const idx = allSignals.findIndex(s => s.activityCode === signal.activityCode);
                if (idx >= 0 && signal.score > allSignals[idx].score) {
                    allSignals[idx] = signal;
                }
            } else {
                seenCodes.add(signal.activityCode);
                allSignals.push(signal);
            }
        }
    }

    // Sort by score descending
    allSignals.sort((a, b) => b.score - a.score);

    return {
        signals: allSignals,
        unmappedLayers: [...new Set(unmappedLayers)],
        impactsProcessed: impactMap.impacts.length,
        signalsProduced: allSignals.length,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Adapter — converts ImpactMapExtractionResult → SignalSet
// ─────────────────────────────────────────────────────────────────────────────

/** Map ImpactLayer string to PipelineLayer (filtering out ai_pipeline) */
function toPipelineLayer(layer: string): PipelineLayer | undefined {
    const valid: PipelineLayer[] = ['frontend', 'logic', 'data', 'integration', 'automation', 'configuration'];
    return valid.includes(layer as PipelineLayer) ? (layer as PipelineLayer) : undefined;
}

/**
 * Convert an ImpactMapExtractionResult into a canonical SignalSet.
 *
 * Each ImpactMapSignal becomes a NormalizedSignal with:
 *   - score = original score (already 0–1)
 *   - kind = primary source from signal.sources[0] (impact-map-layer or impact-map-action)
 *   - source = 'impact-map'
 *   - layer = extracted from provenance chain
 */
export function impactMapToNormalizedSignals(
    result: ImpactMapExtractionResult,
): SignalSet {
    const signals: NormalizedSignal[] = [];

    for (const sig of result.signals) {
        // Extract layer from provenance (format: "impact-map:frontend")
        const layerProv = sig.provenance.find(p => p.startsWith('impact-map:'));
        const rawLayer = layerProv?.split(':')[1];
        const layer = rawLayer ? toPipelineLayer(rawLayer) : undefined;

        // Map source to canonical SignalKind
        const kind = sig.sources.includes('impact-map-action')
            ? 'impact-map-action' as const
            : 'impact-map-layer' as const;

        signals.push({
            activityCode: sig.activityCode,
            score: sig.score,
            kind,
            source: 'impact-map',
            confidence: sig.contributions.impactConfidence,
            contributions: {
                layerMatch: sig.contributions.layerMatch,
                actionWeight: sig.contributions.actionWeight,
                impactConfidence: sig.contributions.impactConfidence,
                componentDensity: sig.contributions.componentDensity,
            },
            provenance: sig.provenance,
            layer,
        });
    }

    return {
        signals,
        source: 'impact-map',
        diagnostics: {
            processed: result.impactsProcessed,
            produced: signals.length,
            unmapped: result.unmappedLayers,
        },
    };
}
