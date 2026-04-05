/**
 * CandidateBuilder — Canonical candidate generation with provenance
 *
 * This is the SINGLE entry point for activity candidate generation.
 * It merges signals from multiple structured sources (Blueprint, ImpactMap,
 * Understanding, keyword ranking, project context) and produces a scored
 * candidate set where every activity carries mandatory provenance.
 *
 * Architecture (3 layers):
 *   1. Signal Extraction — reads artifacts structurally
 *   2. Scoring — merges signals into per-activity scores
 *   3. Selection — dedup, sort, top-N with provenance
 *
 * Rule: if a decision is not traceable, it's wrong.
 * Every CandidateActivity has score, sources, contributions.
 */

import type { Activity, InterviewAnswerRecord } from './activities';
import { selectTopActivities } from './activities';
import {
    mapBlueprintToActivities,
    isBlueprintMappable,
    type BlueprintMappingResult,
    type MappedActivity,
    type ActivityProvenance,
} from './blueprint-activity-mapper';
import {
    extractImpactMapSignals,
    type ImpactMapSignal,
    type ImpactMapExtractionResult,
} from './impact-map-signal-extractor';
import {
    extractUnderstandingSignals,
    type UnderstandingSignal,
    type UnderstandingExtractionResult,
} from './understanding-signal-extractor';
import type { ImpactMap } from '../../../src/types/impact-map';
import type { RequirementUnderstanding } from '../../../src/types/requirement-understanding';
import type { ActivityBiases } from './domain/estimation/project-context-rules';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical source type — extends existing ActivityProvenance with structured signals */
export type CandidateSource =
    | ActivityProvenance
    | 'impact-map'
    | 'impact-map-exclusive'
    | 'understanding';

/** Contribution breakdown by signal source */
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
}

/** A candidate activity with mandatory provenance */
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

/** Full result from the candidate builder */
export interface CandidateSetResult {
    /** Scored candidates, sorted by score descending */
    candidates: ScoredCandidate[];
    /** Blueprint mapping diagnostics (if blueprint was used) */
    blueprintResult?: BlueprintMappingResult;
    /** ImpactMap extraction diagnostics (if impact map was used) */
    impactMapResult?: ImpactMapExtractionResult;
    /** Understanding extraction diagnostics (if understanding was used) */
    understandingResult?: UnderstandingExtractionResult;
    /** Which strategy was primary */
    strategy: 'blueprint+impactmap+understanding' | 'blueprint+impactmap' | 'blueprint+understanding' | 'impactmap+understanding' | 'blueprint-only' | 'impactmap-only' | 'understanding-only' | 'keyword-only';
    /** Diagnostic summary */
    diagnostics: {
        totalCatalog: number;
        fromBlueprint: number;
        fromImpactMap: number;
        fromUnderstanding: number;
        fromKeyword: number;
        mergedOverlaps: number;
        finalCount: number;
    };
}

/** Input for the candidate builder */
export interface CandidateBuilderInput {
    /** Full activity catalog (already filtered by technology) */
    catalog: Activity[];
    /** Requirement description */
    description: string;
    /** Technology category code */
    techCategory: string;
    /** Interview answers (optional) */
    answers?: Record<string, InterviewAnswerRecord>;
    /** Confirmed estimation blueprint (optional) */
    blueprint?: Record<string, unknown>;
    /** Confirmed impact map (optional) */
    impactMap?: ImpactMap;
    /** Confirmed requirement understanding (optional) */
    understanding?: RequirementUnderstanding;
    /** Project context activity biases (optional) */
    activityBiases?: ActivityBiases;
    /** Maximum candidates to return (default: 20) */
    topN?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Score weights — how much each source contributes to final score
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
    /** Blueprint structural mapping (highest — deterministic) */
    blueprint: 3.0,
    /** ImpactMap structural signals */
    impactMap: 2.0,
    /** Understanding structural signals (additive, not dominant) */
    understanding: 1.5,
    /** Keyword matching (lowest — heuristic) */
    keyword: 1.0,
    /** Project context bias bonus */
    projectContext: 0.5,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: Signal Extraction
//
// Reads each artifact structurally and produces per-activity scores.
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityScore {
    blueprintScore: number;
    blueprintProvenance: string[];
    blueprintConfidence: number;
    impactMapScore: number;
    impactMapProvenance: string[];
    impactMapConfidence: number;
    keywordScore: number;
}

function extractBlueprintScores(
    blueprintResult: BlueprintMappingResult,
): Map<string, { score: number; provenance: string[]; confidence: number; source: ActivityProvenance }> {
    const scores = new Map<string, { score: number; provenance: string[]; confidence: number; source: ActivityProvenance }>();

    for (const mapped of blueprintResult.allActivities) {
        scores.set(mapped.activity.code, {
            score: mapped.confidence, // 0–1
            provenance: [`blueprint:${mapped.provenance}`, `label:${mapped.sourceLabel}`],
            confidence: mapped.confidence,
            source: mapped.provenance,
        });
    }

    return scores;
}

function extractImpactMapScores(
    impactMapResult: ImpactMapExtractionResult,
): Map<string, { score: number; provenance: string[]; confidence: number }> {
    const scores = new Map<string, { score: number; provenance: string[]; confidence: number }>();

    for (const signal of impactMapResult.signals) {
        scores.set(signal.activityCode, {
            score: signal.score, // 0–1
            provenance: signal.provenance,
            confidence: signal.score,
        });
    }

    return scores;
}

function extractUnderstandingScores(
    understandingResult: UnderstandingExtractionResult,
): Map<string, { score: number; provenance: string[]; confidence: number }> {
    const scores = new Map<string, { score: number; provenance: string[]; confidence: number }>();

    for (const signal of understandingResult.signals) {
        scores.set(signal.activityCode, {
            score: signal.score, // 0–1
            provenance: signal.provenance,
            confidence: signal.score,
        });
    }

    return scores;
}

/**
 * Compute a normalized keyword score for an activity.
 * This converts the raw keyword ranking position into a 0–1 score.
 */
function computeKeywordScores(
    keywordRanked: Activity[],
    totalCatalog: number,
): Map<string, number> {
    const scores = new Map<string, number>();
    const count = keywordRanked.length;

    for (let i = 0; i < count; i++) {
        // Score decreases linearly from 1.0 (top) to ~0.1 (bottom of ranked)
        const normalizedScore = Math.max(0.1, 1.0 - (i / Math.max(count, 1)) * 0.9);
        scores.set(keywordRanked[i].code, normalizedScore);
    }

    return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: Scoring — merge all signals into per-activity weighted scores
// ─────────────────────────────────────────────────────────────────────────────

interface MergedScore {
    activity: Activity;
    blueprint: number;
    impactMap: number;
    understanding: number;
    keyword: number;
    projectContext: number;
    totalScore: number;
    sources: CandidateSource[];
    provenance: string[];
    confidence: number;
}

function mergeScores(
    catalog: Activity[],
    blueprintScores: Map<string, { score: number; provenance: string[]; confidence: number; source: ActivityProvenance }>,
    impactMapScores: Map<string, { score: number; provenance: string[]; confidence: number }>,
    understandingScores: Map<string, { score: number; provenance: string[]; confidence: number }>,
    keywordScores: Map<string, number>,
): Map<string, MergedScore> {
    const merged = new Map<string, MergedScore>();

    // Collect all activity codes that appear in ANY signal source
    const allCodes = new Set<string>();
    for (const code of blueprintScores.keys()) allCodes.add(code);
    for (const code of impactMapScores.keys()) allCodes.add(code);
    for (const code of understandingScores.keys()) allCodes.add(code);
    for (const code of keywordScores.keys()) allCodes.add(code);

    // Build a code→Activity lookup
    const activityMap = new Map<string, Activity>();
    for (const a of catalog) activityMap.set(a.code, a);

    for (const code of allCodes) {
        const activity = activityMap.get(code);
        if (!activity) continue; // Code not in catalog — skip

        const bp = blueprintScores.get(code);
        const im = impactMapScores.get(code);
        const un = understandingScores.get(code);
        const kw = keywordScores.get(code);

        const bpContrib = bp ? bp.score * WEIGHTS.blueprint : 0;
        const imContrib = im ? im.score * WEIGHTS.impactMap : 0;
        const unContrib = un ? un.score * WEIGHTS.understanding : 0;
        const kwContrib = kw ? kw * WEIGHTS.keyword : 0;
        const totalScore = bpContrib + imContrib + unContrib + kwContrib;

        const sources: CandidateSource[] = [];
        const provenance: string[] = [];

        if (bp) {
            sources.push(bp.source);
            provenance.push(...bp.provenance);
        }
        if (im) {
            sources.push(bp ? 'impact-map' : 'impact-map-exclusive');
            provenance.push(...im.provenance);
        }
        if (un) {
            sources.push('understanding' as CandidateSource);
            provenance.push(...un.provenance);
        }
        if (kw) {
            sources.push('keyword-fallback');
            provenance.push(`keyword-rank:${kw.toFixed(2)}`);
        }

        // Confidence = max confidence across sources
        const confidence = Math.max(
            bp?.confidence ?? 0,
            im?.confidence ?? 0,
            un?.confidence ?? 0,
            kw ?? 0,
        );

        merged.set(code, {
            activity,
            blueprint: bpContrib,
            impactMap: imContrib,
            understanding: unContrib,
            keyword: kwContrib,
            projectContext: 0, // applied in selection layer
            totalScore,
            sources,
            provenance,
            confidence,
        });
    }

    return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3: Selection — sort, dedup, top-N, build final candidates
// ─────────────────────────────────────────────────────────────────────────────

function selectCandidates(
    merged: Map<string, MergedScore>,
    topN: number,
): ScoredCandidate[] {
    const sorted = [...merged.values()]
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, topN);

    return sorted.map(m => {
        // Determine primary source (highest contributing source)
        let primarySource: CandidateSource = 'keyword-fallback';
        let maxContrib = m.keyword;
        if (m.blueprint > maxContrib) {
            primarySource = m.sources.find(s =>
                s.startsWith('blueprint') || s === 'multi-crosscutting',
            ) ?? 'blueprint-component';
            maxContrib = m.blueprint;
        }
        if (m.impactMap > maxContrib) {
            primarySource = m.sources.includes('impact-map-exclusive')
                ? 'impact-map-exclusive'
                : 'impact-map';
            maxContrib = m.impactMap;
        }
        if (m.understanding > maxContrib) {
            primarySource = 'understanding' as CandidateSource;
        }

        return {
            activity: m.activity,
            score: m.totalScore,
            sources: m.sources,
            contributions: {
                blueprint: m.blueprint,
                impactMap: m.impactMap,
                understanding: m.understanding,
                keyword: m.keyword,
                projectContext: m.projectContext,
            },
            provenance: m.provenance,
            primarySource,
            confidence: m.confidence,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a scored candidate set from all available structured artifacts.
 *
 * This is the CANONICAL entry point for candidate generation.
 * It replaces direct calls to selectTopActivities + mapBlueprintToActivities.
 *
 * Every returned candidate has mandatory: score, sources, contributions, provenance.
 * If a candidate can't be traced, it doesn't enter the set.
 *
 * @param input - All available inputs for candidate generation
 * @returns CandidateSetResult with scored candidates and diagnostics
 */
export function buildCandidateSet(input: CandidateBuilderInput): CandidateSetResult {
    const {
        catalog,
        description,
        techCategory,
        answers,
        blueprint,
        impactMap,
        understanding,
        activityBiases,
        topN = 20,
    } = input;

    // ── Layer 1: Signal Extraction ──────────────────────────────────

    // 1a. Blueprint signals (deterministic structural mapping)
    let blueprintResult: BlueprintMappingResult | undefined;
    let blueprintScores = new Map<string, { score: number; provenance: string[]; confidence: number; source: ActivityProvenance }>();

    if (blueprint && isBlueprintMappable(blueprint)) {
        blueprintResult = mapBlueprintToActivities(
            blueprint,
            catalog,
            techCategory,
            // No fallback here — we handle fallback via keyword layer
        );
        blueprintScores = extractBlueprintScores(blueprintResult);
    }

    // 1b. ImpactMap signals (deterministic layer → activity mapping)
    let impactMapResult: ImpactMapExtractionResult | undefined;
    let impactMapScores = new Map<string, { score: number; provenance: string[]; confidence: number }>();

    if (impactMap && impactMap.impacts && impactMap.impacts.length > 0) {
        impactMapResult = extractImpactMapSignals(impactMap, catalog, techCategory);
        impactMapScores = extractImpactMapScores(impactMapResult);
    }

    // 1c. Understanding signals (deterministic perimeter → layer mapping + complexity routing)
    let understandingResult: UnderstandingExtractionResult | undefined;
    let understandingScores = new Map<string, { score: number; provenance: string[]; confidence: number }>();

    if (understanding) {
        understandingResult = extractUnderstandingSignals(understanding, catalog, techCategory);
        understandingScores = extractUnderstandingScores(understandingResult);
    }

    // 1d. Keyword signals (heuristic — always runs as baseline)
    const keywordRanked = selectTopActivities(
        catalog,
        description,
        answers,
        Math.max(topN, 30), // Get more than needed for better scoring
        blueprint,
        activityBiases,
    );
    const keywordScores = computeKeywordScores(keywordRanked, catalog.length);

    // ── Layer 2: Scoring ─────────────────────────────────────────────

    const merged = mergeScores(catalog, blueprintScores, impactMapScores, understandingScores, keywordScores);

    // ── Layer 3: Selection ──────────────────────────────────────────

    const candidates = selectCandidates(merged, topN);

    // ── Diagnostics ─────────────────────────────────────────────────

    const fromBlueprint = candidates.filter(c => c.contributions.blueprint > 0).length;
    const fromImpactMap = candidates.filter(c => c.contributions.impactMap > 0).length;
    const fromUnderstanding = candidates.filter(c => c.contributions.understanding > 0).length;
    const fromKeyword = candidates.filter(c =>
        c.contributions.keyword > 0 && c.contributions.blueprint === 0 && c.contributions.impactMap === 0 && c.contributions.understanding === 0,
    ).length;
    const mergedOverlaps = candidates.filter(c =>
        [c.contributions.blueprint > 0, c.contributions.impactMap > 0, c.contributions.understanding > 0, c.contributions.keyword > 0]
            .filter(Boolean).length > 1,
    ).length;

    // Determine strategy based on which structured sources were used
    const hasBlueprint = !!blueprintResult;
    const hasImpactMap = !!impactMapResult;
    const hasUnderstanding = !!understandingResult;
    let strategy: CandidateSetResult['strategy'];
    if (hasBlueprint && hasImpactMap && hasUnderstanding) strategy = 'blueprint+impactmap+understanding';
    else if (hasBlueprint && hasImpactMap) strategy = 'blueprint+impactmap';
    else if (hasBlueprint && hasUnderstanding) strategy = 'blueprint+understanding';
    else if (hasImpactMap && hasUnderstanding) strategy = 'impactmap+understanding';
    else if (hasBlueprint) strategy = 'blueprint-only';
    else if (hasImpactMap) strategy = 'impactmap-only';
    else if (hasUnderstanding) strategy = 'understanding-only';
    else strategy = 'keyword-only';

    console.log(`[candidate-builder] Strategy: ${strategy} | Candidates: ${candidates.length}/${catalog.length} | Blueprint: ${fromBlueprint} | ImpactMap: ${fromImpactMap} | Understanding: ${fromUnderstanding} | Keyword-only: ${fromKeyword} | Overlaps: ${mergedOverlaps}`);

    if (impactMapResult && impactMapResult.unmappedLayers.length > 0) {
        console.log(`[candidate-builder] Unmapped ImpactMap layers: ${impactMapResult.unmappedLayers.join(', ')}`);
    }

    if (understandingResult && understandingResult.unmatchedTerms.length > 0) {
        console.log(`[candidate-builder] Unmatched Understanding perimeter terms: ${understandingResult.unmatchedTerms.join(', ')}`);
    }

    return {
        candidates,
        blueprintResult,
        impactMapResult,
        understandingResult,
        strategy,
        diagnostics: {
            totalCatalog: catalog.length,
            fromBlueprint,
            fromImpactMap,
            fromUnderstanding,
            fromKeyword,
            mergedOverlaps,
            finalCount: candidates.length,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion helper: ScoredCandidate → domain CandidateActivity
//
// Bridges the new candidate builder output to the existing domain model.
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidateActivity as DomainCandidateActivity } from '../../../src/types/domain-model';

/**
 * Convert ScoredCandidates to domain CandidateActivity format for persistence.
 *
 * This preserves provenance in the `reason` field as a JSON string,
 * so candidate_sets.candidates contains traceable decisions.
 */
export function toDomainCandidates(
    candidates: ScoredCandidate[],
    activityIdLookup: Map<string, string>,
): DomainCandidateActivity[] {
    return candidates.map(c => {
        const activityId = activityIdLookup.get(c.activity.code) || '';
        return {
            activity_id: activityId,
            activity_code: c.activity.code,
            source: c.primarySource === 'keyword-fallback' ? 'ai' as const
                : c.primarySource === 'impact-map' || c.primarySource === 'impact-map-exclusive' ? 'rule' as const
                : c.primarySource === 'understanding' ? 'rule' as const
                : c.primarySource.startsWith('blueprint') || c.primarySource === 'multi-crosscutting' ? 'blueprint' as const
                : 'ai' as const,
            score: Math.round(c.score * 10), // scale to 0–100 range
            confidence: c.confidence,
            reason: JSON.stringify({
                sources: c.sources,
                contributions: c.contributions,
                provenance: c.provenance,
                primarySource: c.primarySource,
            }),
        };
    });
}
