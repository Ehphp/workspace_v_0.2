/**
 * DecisionEngine — Deterministic activity selection
 *
 * Replaces LLM-based activity selection with a deterministic, traceable,
 * unit-testable algorithm. The LLM no longer selects activities — it only
 * explains the selection after the fact.
 *
 * Algorithm (5 phases, each produces DecisionTraceEntry[]):
 *   1. Score threshold gate
 *   2. Mandatory keyword enforcement
 *   3. Layer coverage enforcement
 *   4. Redundancy elimination
 *   5. Top-K cap
 *
 * Complexity-based hour scaling is handled AFTER selection by complexity-resolver.ts.
 *
 * Pure function, no IO, no LLM calls.
 *
 * @module decision-engine
 */

import type { ScoredCandidate } from './candidate.types';
import type { Activity } from '../../activities';
import { LAYER_TECH_PATTERNS } from '../../blueprint-activity-mapper';
import {
    type PipelineLayer,
    PIPELINE_LAYERS,
    LAYER_PRIORITY,
} from './pipeline-domain';
import {
    type DecisionEngineInput,
    type DecisionEngineResult,
    type DecisionEngineConfig,
    type CoverageReport,
    type LayerCoverage,
    type MandatoryInclusion,
    type DecisionTraceEntry,
    DEFAULT_CONFIG,
} from './decision-engine.types';
import { getDefaultRules, evaluateMandatoryRules } from './mandatory-rules';

// ─────────────────────────────────────────────────────────────────────────────
// Reverse lookup: activity code → PipelineLayer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a reverse lookup from activity code prefix to PipelineLayer.
 * Uses LAYER_TECH_PATTERNS as the source of truth.
 */
function buildPrefixToLayerMap(techCategory: string): Map<string, PipelineLayer> {
    const map = new Map<string, PipelineLayer>();
    const patterns = LAYER_TECH_PATTERNS[techCategory] || LAYER_TECH_PATTERNS['POWER_PLATFORM'];

    for (const [layer, entries] of Object.entries(patterns)) {
        for (const entry of entries) {
            map.set(entry.prefix, layer as PipelineLayer);
        }
    }

    return map;
}

/**
 * Resolve which PipelineLayer an activity code belongs to.
 */
function resolveLayer(
    code: string,
    prefixMap: Map<string, PipelineLayer>,
): PipelineLayer | null {
    // Try longest prefix match first
    for (const [prefix, layer] of prefixMap) {
        if (code.startsWith(prefix)) return layer;
    }
    return null;
}

/**
 * Resolve which "group" prefix an activity belongs to (for redundancy check).
 * E.g. PP_FLOW_SIMPLE → PP_FLOW, BE_API_COMPLEX → BE_API
 */
function resolveGroupPrefix(code: string): string {
    let base = code;
    // Strip complexity suffixes
    if (base.endsWith('_SIMPLE') || base.endsWith('_COMPLEX')) {
        base = base.replace(/_SIMPLE$|_COMPLEX$/, '');
    }
    return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Phases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 1: Score threshold gate.
 */
function scoreGate(
    candidates: ScoredCandidate[],
    minScore: number,
): { selected: ScoredCandidate[]; excluded: ScoredCandidate[]; trace: DecisionTraceEntry[] } {
    const selected: ScoredCandidate[] = [];
    const excluded: ScoredCandidate[] = [];
    const trace: DecisionTraceEntry[] = [];

    for (const c of candidates) {
        if (c.score >= minScore) {
            selected.push(c);
            trace.push({
                step: 'score-gate',
                action: 'select',
                code: c.activity.code,
                reason: `Score ${c.score.toFixed(2)} >= threshold ${minScore}`,
                score: c.score,
            });
        } else {
            excluded.push(c);
            trace.push({
                step: 'score-gate',
                action: 'exclude',
                code: c.activity.code,
                reason: `Score ${c.score.toFixed(2)} < threshold ${minScore}`,
                score: c.score,
            });
        }
    }

    return { selected, excluded, trace };
}

/**
 * Phase 2: Mandatory keyword enforcement.
 */
function mandatoryEnforcement(
    selected: ScoredCandidate[],
    excluded: ScoredCandidate[],
    description: string,
    answers: Record<string, { questionId: string; category: string; value: string | string[] | number }>,
    techCategory: string,
    catalog: Activity[],
    config: DecisionEngineConfig,
): { selected: ScoredCandidate[]; inclusions: MandatoryInclusion[]; trace: DecisionTraceEntry[] } {
    const rules = config.mandatoryKeywordRules.length > 0
        ? config.mandatoryKeywordRules
        : getDefaultRules(techCategory);

    const inclusions = evaluateMandatoryRules(description, answers, rules, catalog);
    const trace: DecisionTraceEntry[] = [];
    const selectedCodes = new Set(selected.map(s => s.activity.code));

    for (const inclusion of inclusions) {
        if (selectedCodes.has(inclusion.code)) {
            trace.push({
                step: 'mandatory-keyword',
                action: 'select',
                code: inclusion.code,
                reason: `Già selezionato, confermato da regola mandatoria: "${inclusion.matchedKeyword}"`,
            });
            continue;
        }

        // Check if it's in the excluded pool
        const fromExcluded = excluded.find(e => e.activity.code === inclusion.code);
        if (fromExcluded) {
            selected.push(fromExcluded);
            excluded.splice(excluded.indexOf(fromExcluded), 1);
            selectedCodes.add(inclusion.code);
            trace.push({
                step: 'mandatory-keyword',
                action: 'add-mandatory',
                code: inclusion.code,
                reason: `Forzato da regola mandatoria: keyword "${inclusion.matchedKeyword}" → ${inclusion.rule}`,
                score: fromExcluded.score,
            });
            continue;
        }

        // Not in any pool — create a synthetic candidate from catalog
        const activity = catalog.find(a => a.code === inclusion.code);
        if (activity) {
            const synthetic: ScoredCandidate = {
                activity,
                score: 0.1,
                sources: ['keyword-fallback'],
                contributions: { blueprint: 0, impactMap: 0, understanding: 0, keyword: 0.1, projectContext: 0, projectActivity: 0 },
                provenance: [`mandatory-rule:${inclusion.matchedKeyword}`],
                primarySource: 'keyword-fallback',
                confidence: 0.5,
            };
            selected.push(synthetic);
            selectedCodes.add(inclusion.code);
            trace.push({
                step: 'mandatory-keyword',
                action: 'add-mandatory',
                code: inclusion.code,
                reason: `Forzato da regola mandatoria (non nel candidate set): keyword "${inclusion.matchedKeyword}" → ${inclusion.rule}`,
                score: 0.1,
            });
        }
    }

    return { selected, inclusions, trace };
}

/**
 * Phase 3: Layer coverage enforcement.
 *
 * A layer is force-covered only when:
 *   1. It has HIGH priority
 *   2. No selected candidate covers it
 *   3. The best excluded candidate for it has score >= minCoverageScore
 *
 * If the best excluded candidate scores below minCoverageScore the layer gap
 * is left open — forcing a near-zero-signal activity inflates estimates more
 * than it adds value.
 */
function coverageEnforcement(
    selected: ScoredCandidate[],
    excluded: ScoredCandidate[],
    coverageLayers: PipelineLayer[],
    prefixMap: Map<string, PipelineLayer>,
    minCoverageScore: number,
): { selected: ScoredCandidate[]; trace: DecisionTraceEntry[] } {
    const trace: DecisionTraceEntry[] = [];

    for (const layer of coverageLayers) {
        const priority = LAYER_PRIORITY[layer];
        if (priority !== 'HIGH') continue;

        // Check if any selected candidate covers this layer
        const hasCoverage = selected.some(s => resolveLayer(s.activity.code, prefixMap) === layer);
        if (hasCoverage) continue;

        // Find the highest-scoring excluded candidate for this layer
        const candidates = excluded
            .filter(e => resolveLayer(e.activity.code, prefixMap) === layer)
            .sort((a, b) => b.score - a.score);

        if (candidates.length === 0) {
            trace.push({
                step: 'coverage-enforcement',
                action: 'select',
                code: '',
                reason: `Layer "${layer}" (priority HIGH) non coperto — nessun candidato disponibile`,
                layer,
            });
            continue;
        }

        const best = candidates[0];

        // Skip enforcement if best candidate is below the minimum coverage threshold —
        // it's noise, not a real signal for this layer.
        if (best.score < minCoverageScore) {
            trace.push({
                step: 'coverage-enforcement',
                action: 'exclude',
                code: best.activity.code,
                reason: `Layer "${layer}" gap ignorato — miglior candidato score ${best.score.toFixed(2)} < minCoverageScore ${minCoverageScore} (segnale assente)`,
                score: best.score,
                layer,
            });
            continue;
        }

        selected.push(best);
        excluded.splice(excluded.indexOf(best), 1);
        trace.push({
            step: 'coverage-enforcement',
            action: 'add-coverage',
            code: best.activity.code,
            reason: `Layer "${layer}" (priority HIGH) non coperto — aggiunto miglior candidato (score ${best.score.toFixed(2)} >= ${minCoverageScore})`,
            score: best.score,
            layer,
        });
    }

    return { selected, trace };
}

/**
 * Phase 4: Redundancy elimination.
 * If two selected candidates map to the same group prefix + same layer,
 * keep the higher-scored one. Exception: project-scoped activities (PRJ_ prefix)
 * are preferred over global activities for the same group+layer, regardless of score.
 */
function redundancyElimination(
    selected: ScoredCandidate[],
    excluded: ScoredCandidate[],
    prefixMap: Map<string, PipelineLayer>,
): { selected: ScoredCandidate[]; trace: DecisionTraceEntry[] } {
    const trace: DecisionTraceEntry[] = [];
    const seen = new Map<string, ScoredCandidate>(); // key = group+layer

    // Sort by score descending so we keep the best by default
    const sorted = [...selected].sort((a, b) => b.score - a.score);
    const kept: ScoredCandidate[] = [];

    for (const candidate of sorted) {
        const group = resolveGroupPrefix(candidate.activity.code);
        const layer = resolveLayer(candidate.activity.code, prefixMap) || 'unknown';
        const key = `${group}::${layer}`;
        const isProjectActivity = candidate.activity.code.startsWith('PRJ_');

        const existing = seen.get(key);
        if (existing) {
            const existingIsProject = existing.activity.code.startsWith('PRJ_');

            // Project activity replaces global activity for same slot
            if (isProjectActivity && !existingIsProject) {
                // Swap: evict the global, keep the project activity
                const evictIdx = kept.indexOf(existing);
                if (evictIdx >= 0) kept.splice(evictIdx, 1);
                excluded.push(existing);
                seen.set(key, candidate);
                kept.push(candidate);
                trace.push({
                    step: 'redundancy-elimination',
                    action: 'exclude',
                    code: existing.activity.code,
                    reason: `Sostituito da attività di progetto ${candidate.activity.code} (stesso gruppo "${group}" + layer "${layer}")`,
                    score: existing.score,
                    layer: layer as PipelineLayer,
                });
                continue;
            }

            // Otherwise: standard redundancy — remove the lower-scored one
            excluded.push(candidate);
            trace.push({
                step: 'redundancy-elimination',
                action: 'exclude',
                code: candidate.activity.code,
                reason: `Ridondante con ${existing.activity.code} (stesso gruppo "${group}" + layer "${layer}")`,
                score: candidate.score,
                layer: layer as PipelineLayer,
            });
        } else {
            seen.set(key, candidate);
            kept.push(candidate);
        }
    }

    return { selected: kept, trace };
}

/**
 * Phase 5: Top-K cap.
 * Remove lowest-scored candidates that aren't coverage-enforced, mandatory,
 * or project-scoped (PRJ_ prefix). Project activities get priority retention.
 */
function topKCap(
    selected: ScoredCandidate[],
    excluded: ScoredCandidate[],
    maxSelected: number,
    coverageCodes: Set<string>,
    mandatoryCodes: Set<string>,
): { selected: ScoredCandidate[]; trace: DecisionTraceEntry[] } {
    const trace: DecisionTraceEntry[] = [];

    if (selected.length <= maxSelected) {
        return { selected, trace };
    }

    // Sort by score ascending (weakest first) for removal
    const sorted = [...selected].sort((a, b) => a.score - b.score);
    const kept: ScoredCandidate[] = [];
    let removed = 0;
    const targetRemoval = selected.length - maxSelected;

    for (const candidate of sorted) {
        const code = candidate.activity.code;
        // PRJ_* activities are NOT protected here — their weight advantage (4.0)
        // already gives them higher scores in the synthesizer. Protecting them from
        // top-K would let irrelevant project activities monopolize all slots.
        const isProtected = coverageCodes.has(code) || mandatoryCodes.has(code);

        if (removed < targetRemoval && !isProtected) {
            excluded.push(candidate);
            removed++;
            trace.push({
                step: 'top-k-cap',
                action: 'exclude',
                code,
                reason: `Rimosso per cap K=${maxSelected} (score ${candidate.score.toFixed(2)})`,
                score: candidate.score,
            });
        } else {
            kept.push(candidate);
        }
    }

    // Re-sort by score descending
    kept.sort((a, b) => b.score - a.score);

    return { selected: kept, trace };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Coverage Report
// ─────────────────────────────────────────────────────────────────────────────

function buildCoverageReport(
    selected: ScoredCandidate[],
    totalCandidates: number,
    prefixMap: Map<string, PipelineLayer>,
): CoverageReport {
    const byLayer: Record<PipelineLayer, LayerCoverage> = {} as any;

    for (const layer of PIPELINE_LAYERS) {
        const layerCandidates = selected.filter(s => resolveLayer(s.activity.code, prefixMap) === layer);
        const topCandidate = layerCandidates.sort((a, b) => b.score - a.score)[0];

        byLayer[layer] = {
            covered: layerCandidates.length > 0,
            activityCount: layerCandidates.length,
            topScore: topCandidate?.score ?? 0,
            topCode: topCandidate?.activity.code ?? '',
        };
    }

    const gapLayers = PIPELINE_LAYERS.filter(
        layer => LAYER_PRIORITY[layer] === 'HIGH' && !byLayer[layer].covered,
    );

    return {
        byLayer,
        totalSelected: selected.length,
        totalCandidates,
        gapLayers,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute Confidence
// ─────────────────────────────────────────────────────────────────────────────

function computeConfidence(
    selected: ScoredCandidate[],
    coverageReport: CoverageReport,
): number {
    if (selected.length === 0) return 0;

    // Factor 1: average score (normalized by max possible)
    const avgScore = selected.reduce((sum, s) => sum + s.score, 0) / selected.length;
    const maxPossible = Math.max(...selected.map(s => s.score), 1);
    const scoreNorm = Math.min(avgScore / maxPossible, 1);

    // Factor 2: coverage completeness (HIGH layers covered / total HIGH layers)
    const highLayers = PIPELINE_LAYERS.filter(l => LAYER_PRIORITY[l] === 'HIGH');
    const coveredHigh = highLayers.filter(l => coverageReport.byLayer[l].covered).length;
    const coverageRatio = highLayers.length > 0 ? coveredHigh / highLayers.length : 1;

    // Factor 3: source diversity (how many distinct sources contributed)
    const allSources = new Set(selected.flatMap(s => s.sources));
    const sourceDiversity = Math.min(allSources.size / 4, 1); // 4 sources = max diversity

    // Weighted combination
    const confidence = scoreNorm * 0.4 + coverageRatio * 0.4 + sourceDiversity * 0.2;
    return Math.round(confidence * 100) / 100; // 2 decimal places
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the deterministic decision engine on a set of scored candidates.
 *
 * This replaces LLM-based activity selection. Every decision is traceable
 * via `decisionTrace`. Pure function — no IO, no LLM calls.
 */
export function runDecisionEngine(input: DecisionEngineInput): DecisionEngineResult {
    const config: DecisionEngineConfig = {
        ...DEFAULT_CONFIG,
        ...input.config,
    };

    const prefixMap = buildPrefixToLayerMap(input.techCategory);
    const allTrace: DecisionTraceEntry[] = [];

    // Phase 1: Score Gate
    const phase1 = scoreGate(input.candidates, config.minScore);
    let selected = phase1.selected;
    let excluded = phase1.excluded;
    allTrace.push(...phase1.trace);

    // Phase 2: Mandatory Keyword Enforcement
    const phase2 = mandatoryEnforcement(
        selected, excluded,
        input.description, input.answers,
        input.techCategory, input.catalog, config,
    );
    selected = phase2.selected;
    const mandatoryInclusions = phase2.inclusions;
    allTrace.push(...phase2.trace);

    // Phase 3: Coverage Enforcement
    const phase3 = coverageEnforcement(
        selected, excluded,
        config.coverageLayers,
        prefixMap,
        config.minCoverageScore,
    );
    selected = phase3.selected;
    allTrace.push(...phase3.trace);

    // Phase 4: Redundancy Elimination
    const phase4 = redundancyElimination(selected, excluded, prefixMap);
    selected = phase4.selected;
    allTrace.push(...phase4.trace);

    // Collect protected codes for top-K cap
    const coverageCodes = new Set(
        phase3.trace
            .filter(t => t.action === 'add-coverage')
            .map(t => t.code),
    );
    const mandatoryCodes = new Set(mandatoryInclusions.map(m => m.code));

    // Phase 5: Top-K Cap
    const phase5 = topKCap(selected, excluded, config.maxSelected, coverageCodes, mandatoryCodes);
    selected = phase5.selected;
    allTrace.push(...phase5.trace);

    // Build coverage report
    const coverageReport = buildCoverageReport(
        selected,
        input.candidates.length,
        prefixMap,
    );

    // Compute confidence
    const confidence = computeConfidence(selected, coverageReport);

    console.log(
        `[decision-engine] Selected: ${selected.length}/${input.candidates.length} | ` +
        `Mandatory: ${mandatoryInclusions.length} | ` +
        `Gaps: ${coverageReport.gapLayers.join(',') || 'none'} | Confidence: ${confidence}`,
    );

    return {
        selectedCandidates: selected,
        excludedCandidates: excluded,
        coverageReport,
        mandatoryInclusions,
        decisionTrace: allTrace,
        confidence,
    };
}
