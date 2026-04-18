/**
 * Understanding → Signal Extractor
 *
 * Deterministic signal extraction from RequirementUnderstanding artifacts.
 * This is the SECOND signal extractor in the CandidateBuilder architecture
 * (alongside ImpactMapSignalExtractor).
 *
 * Extracts two signal types:
 *   1. functional-perimeter → maps scope items to architectural layers → activity codes
 *   2. complexity-variant   → determines complexity level (hour scaling handled by complexity-resolver)
 *
 * Contract:
 *   - Every signal has score, sources, contributions, provenance — no exceptions.
 *   - Mapping is EXPLICIT via PERIMETER_LAYER_MAP — no generic keyword matching.
 *   - Uses the same LAYER_TECH_PATTERNS as Blueprint and ImpactMap extractors
 *     (single source of truth for layer → activity code mapping).
 *   - If a perimeter term doesn't match any known pattern, it's skipped (not guessed).
 *
 * Flow:
 *   functionalPerimeter[] → PERIMETER_LAYER_MAP → layers
 *     → LAYER_TECH_PATTERNS[techCategory][layer] → patterns
 *     → findBestMatch(catalog, prefix, complexity) → activity codes with provenance
 *
 *   complexityAssessment.level → complexity level for downstream hour scaling
 *     → applied to ALL matched activities
 */

import type { RequirementUnderstanding, ComplexityAssessment } from '../../../../../src/types/requirement-understanding';
import type { Activity } from '../../infrastructure/db/activities';
import type { ImpactLayer } from '../../../../../src/types/impact-map';
import {
    LAYER_TECH_PATTERNS,
    UNSUPPORTED_LAYERS,
    findBestMatch,
    buildCatalogIndexes,
    type PatternEntry,
} from './blueprint-activity-mapper';
import type { PipelineLayer } from '../pipeline/pipeline-domain';
import type { NormalizedSignal, SignalSet } from '../pipeline/signal-types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Signal kind — what type of understanding data produced this signal */
export type UnderstandingSignalKind = 'functional-perimeter' | 'complexity-variant';

/** A single signal extracted from a RequirementUnderstanding field */
export interface UnderstandingSignal {
    /** Activity code identified */
    activityCode: string;
    /** Computed score for this signal (0.0–1.0) */
    score: number;
    /** Which sources contributed to this signal */
    sources: ('understanding-functional-perimeter' | 'understanding-complexity')[];
    /** Numeric contribution breakdown */
    contributions: {
        /** How strong the perimeter term matched (0 if not relevant) */
        perimeterMatch: number;
        /** How many layers this term mapped to (normalized) */
        layerCoverage: number;
        /** Complexity routing confidence (1.0 if complexity matched, 0 otherwise) */
        complexityRouting: number;
    };
    /** Human-readable provenance chain */
    provenance: string[];
    /** What kind of understanding data produced this */
    kind: UnderstandingSignalKind;
}

/** Result of extracting signals from a RequirementUnderstanding */
export interface UnderstandingExtractionResult {
    /** Scored signals, sorted by score descending */
    signals: UnderstandingSignal[];
    /** Perimeter terms that had no matching patterns */
    unmatchedTerms: string[];
    /** Complexity level used for hour scaling */
    complexityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'unknown';
    /** Total perimeter terms processed */
    perimeterTermsProcessed: number;
    /** Total signals produced */
    signalsProduced: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Perimeter → Layer Mapping
//
// EXPLICIT mapping table: each keyword pattern maps to specific architectural
// layers from the ImpactLayer enum. This is NOT generic keyword matching —
// every entry is a deliberate architectural association.
//
// The mapping is organized by domain concept, not by technology.
// Technology-specific resolution happens via LAYER_TECH_PATTERNS.
// ─────────────────────────────────────────────────────────────────────────────

interface PerimeterPattern {
    /** Keyword pattern (lowercase, checked via includes) */
    keyword: string;
    /** Architectural layers this concept maps to */
    layers: ImpactLayer[];
    /** How strong this association is (0.0–1.0) */
    confidence: number;
    /** Semantic group for provenance */
    group: string;
}

/**
 * Explicit perimeter → layer mapping table.
 *
 * Rules:
 * - Keywords are lowercase, matched via String.includes
 * - Each entry maps to 1-3 layers (more specific = higher confidence)
 * - Patterns are ordered from most specific to least specific
 * - A perimeter term matches the FIRST pattern found (greedy, ordered)
 */
export const PERIMETER_LAYER_MAP: PerimeterPattern[] = [
    // ── UI / Presentation ──────────────────────────────────────────
    { keyword: 'dashboard', layers: ['frontend'], confidence: 0.9, group: 'ui' },
    { keyword: 'interfaccia', layers: ['frontend'], confidence: 0.9, group: 'ui' },
    { keyword: 'schermata', layers: ['frontend'], confidence: 0.9, group: 'ui' },
    { keyword: 'portale', layers: ['frontend'], confidence: 0.9, group: 'ui' },
    { keyword: 'visualizzazione', layers: ['frontend'], confidence: 0.8, group: 'ui' },
    { keyword: 'form', layers: ['frontend'], confidence: 0.9, group: 'ui' },
    { keyword: 'modulo', layers: ['frontend'], confidence: 0.7, group: 'ui' },
    { keyword: 'report', layers: ['frontend', 'data'], confidence: 0.8, group: 'ui-data' },

    // ── Data / Persistence ─────────────────────────────────────────
    { keyword: 'anagrafica', layers: ['data', 'frontend'], confidence: 0.9, group: 'data' },
    { keyword: 'database', layers: ['data'], confidence: 0.9, group: 'data' },
    { keyword: 'archivio', layers: ['data'], confidence: 0.8, group: 'data' },
    { keyword: 'tabella', layers: ['data'], confidence: 0.8, group: 'data' },
    { keyword: 'campo', layers: ['data'], confidence: 0.7, group: 'data' },
    { keyword: 'schema', layers: ['data'], confidence: 0.8, group: 'data' },
    { keyword: 'migrazione dati', layers: ['data'], confidence: 0.9, group: 'data' },
    { keyword: 'storicizzazione', layers: ['data'], confidence: 0.8, group: 'data' },

    // ── Logic / Business Rules ─────────────────────────────────────
    { keyword: 'workflow', layers: ['logic', 'automation'], confidence: 0.9, group: 'logic' },
    { keyword: 'approvazion', layers: ['logic', 'automation'], confidence: 0.9, group: 'logic' },
    { keyword: 'approvativo', layers: ['logic', 'automation'], confidence: 0.9, group: 'logic' },
    { keyword: 'calcolo', layers: ['logic'], confidence: 0.8, group: 'logic' },
    { keyword: 'regola', layers: ['logic', 'configuration'], confidence: 0.8, group: 'logic' },
    { keyword: 'validazione', layers: ['logic'], confidence: 0.8, group: 'logic' },
    { keyword: 'logica di business', layers: ['logic'], confidence: 0.9, group: 'logic' },
    { keyword: 'business rule', layers: ['logic', 'configuration'], confidence: 0.9, group: 'logic' },
    { keyword: 'elaborazione', layers: ['logic'], confidence: 0.7, group: 'logic' },

    // ── Integration ────────────────────────────────────────────────
    { keyword: 'integrazione', layers: ['integration'], confidence: 0.9, group: 'integration' },
    { keyword: 'api estern', layers: ['integration'], confidence: 0.9, group: 'integration' },
    { keyword: 'sincronizzazione', layers: ['integration'], confidence: 0.8, group: 'integration' },
    { keyword: 'connessione', layers: ['integration'], confidence: 0.8, group: 'integration' },
    { keyword: 'import', layers: ['integration', 'data'], confidence: 0.8, group: 'integration' },
    { keyword: 'export', layers: ['integration', 'data'], confidence: 0.8, group: 'integration' },
    { keyword: 'web service', layers: ['integration'], confidence: 0.9, group: 'integration' },
    { keyword: 'rest api', layers: ['integration', 'logic'], confidence: 0.9, group: 'integration' },

    // ── Automation ─────────────────────────────────────────────────
    { keyword: 'notifica', layers: ['automation'], confidence: 0.9, group: 'automation' },
    { keyword: 'automazione', layers: ['automation'], confidence: 0.9, group: 'automation' },
    { keyword: 'scheduler', layers: ['automation'], confidence: 0.8, group: 'automation' },
    { keyword: 'batch', layers: ['automation', 'logic'], confidence: 0.8, group: 'automation' },
    { keyword: 'cron', layers: ['automation'], confidence: 0.8, group: 'automation' },
    { keyword: 'email', layers: ['automation'], confidence: 0.7, group: 'automation' },
    { keyword: 'alert', layers: ['automation'], confidence: 0.7, group: 'automation' },
    { keyword: 'reminder', layers: ['automation'], confidence: 0.7, group: 'automation' },

    // ── Configuration ──────────────────────────────────────────────
    { keyword: 'configurazione', layers: ['configuration'], confidence: 0.8, group: 'configuration' },
    { keyword: 'impostazion', layers: ['configuration'], confidence: 0.7, group: 'configuration' },
    { keyword: 'parametr', layers: ['configuration'], confidence: 0.7, group: 'configuration' },
    { keyword: 'setup', layers: ['configuration'], confidence: 0.7, group: 'configuration' },

    // ── Security / Auth ────────────────────────────────────────────
    { keyword: 'autenticazione', layers: ['logic', 'configuration'], confidence: 0.9, group: 'security' },
    { keyword: 'autorizzazione', layers: ['logic', 'configuration'], confidence: 0.9, group: 'security' },
    { keyword: 'permess', layers: ['logic', 'configuration'], confidence: 0.8, group: 'security' },
    { keyword: 'ruol', layers: ['logic', 'configuration'], confidence: 0.8, group: 'security' },
    { keyword: 'sicurezza', layers: ['logic'], confidence: 0.8, group: 'security' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Complexity → level mapping
// ─────────────────────────────────────────────────────────────────────────────

function complexityToVariant(level: ComplexityAssessment['level'] | undefined): string | undefined {
    switch (level) {
        case 'LOW': return 'LOW';
        case 'HIGH': return 'HIGH';
        case 'MEDIUM':
        default: return undefined; // MEDIUM → base (1.0x multiplier)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Extraction Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a functional perimeter term against the explicit mapping table.
 * Returns the FIRST matching pattern (ordered by specificity).
 */
export function matchPerimeterTerm(term: string): PerimeterPattern | null {
    const normalized = term.toLowerCase().trim();
    if (!normalized) return null;

    for (const pattern of PERIMETER_LAYER_MAP) {
        if (normalized.includes(pattern.keyword)) {
            return pattern;
        }
    }

    return null;
}

/**
 * Extract signals from a single perimeter term.
 *
 * For each matched term:
 * 1. Look up layers via PERIMETER_LAYER_MAP
 * 2. For each layer, get patterns from LAYER_TECH_PATTERNS[techCategory][layer]
 * 3. Resolve each pattern to a real activity via findBestMatch (with complexity routing)
 * 4. Compute score with provenance
 */
function extractFromPerimeterTerm(
    term: string,
    pattern: PerimeterPattern,
    complexity: string | undefined,
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
): UnderstandingSignal[] {
    const signals: UnderstandingSignal[] = [];
    const seen = new Set<string>();

    for (const layer of pattern.layers) {
        // Skip unsupported layers
        if (UNSUPPORTED_LAYERS.has(layer)) continue;

        const techPatterns = LAYER_TECH_PATTERNS[techCategory];
        if (!techPatterns) continue;

        const layerPatterns = techPatterns[layer];
        if (!layerPatterns || layerPatterns.length === 0) continue;

        for (const lp of layerPatterns) {
            // Complexity routing for SIMPLE/COMPLEX pairs
            const isSimplePrefix = lp.prefix.endsWith('_SIMPLE');
            const isComplexPrefix = lp.prefix.endsWith('_COMPLEX');
            if (isSimplePrefix && complexity === 'HIGH') continue;
            if (isComplexPrefix && (complexity === 'LOW' || complexity === undefined)) continue;

            const match = findBestMatch(catalog, catalogByPrefix, lp.prefix, complexity);
            if (!match || seen.has(match.code)) continue;
            seen.add(match.code);

            // Score = perimeterConfidence * layerCoverage + complexityBonus
            const perimeterMatch = pattern.confidence;
            const layerCoverage = 1.0 / pattern.layers.length; // spread across layers
            const complexityRouting = complexity ? 0.1 : 0; // small bonus for complexity-routed
            const rawScore = perimeterMatch * 0.7 + layerCoverage * 0.2 + complexityRouting;
            const score = Math.min(1.0, Math.max(0, rawScore));

            const sources: UnderstandingSignal['sources'] = ['understanding-functional-perimeter'];
            if (complexity) sources.push('understanding-complexity');

            signals.push({
                activityCode: match.code,
                score,
                sources,
                contributions: {
                    perimeterMatch,
                    layerCoverage,
                    complexityRouting,
                },
                provenance: [
                    `understanding:functional-perimeter`,
                    `term:${term}`,
                    `matched-keyword:${pattern.keyword}`,
                    `group:${pattern.group}`,
                    `layer:${layer}`,
                    `pattern:${lp.prefix}`,
                    `resolved:${match.code}`,
                    ...(complexity ? [`complexity:${complexity}`] : []),
                ],
                kind: 'functional-perimeter',
            });
        }
    }

    return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract structured signals from a RequirementUnderstanding artifact.
 *
 * Uses two signal sources:
 *   1. functionalPerimeter[] — maps scope terms to layers → activities
 *   2. complexityAssessment.level — determines complexity for hour scaling
 *
 * Deterministic: same understanding + same catalog = same signals.
 * Every signal carries mandatory score, sources, contributions, provenance.
 *
 * @param understanding - The RequirementUnderstanding artifact (optional — returns empty if absent)
 * @param catalog - Activity catalog (already filtered by technology)
 * @param techCategory - Technology category code (e.g. 'POWER_PLATFORM', 'BACKEND')
 * @returns UnderstandingExtractionResult with scored signals and diagnostics
 */
export function extractUnderstandingSignals(
    understanding: RequirementUnderstanding | undefined | null,
    catalog: Activity[],
    techCategory: string,
): UnderstandingExtractionResult {
    // No understanding → empty result, no crash
    if (!understanding) {
        return {
            signals: [],
            unmatchedTerms: [],
            complexityLevel: 'unknown',
            perimeterTermsProcessed: 0,
            signalsProduced: 0,
        };
    }

    // Build catalog indexes (same as blueprint mapper)
    const { byCode, byPrefix } = buildCatalogIndexes(catalog);

    // Resolve complexity level for downstream hour scaling
    const complexity = complexityToVariant(understanding.complexityAssessment?.level);
    const complexityLevel = understanding.complexityAssessment?.level ?? 'unknown';

    const allSignals: UnderstandingSignal[] = [];
    const unmatchedTerms: string[] = [];
    const perimeter = understanding.functionalPerimeter ?? [];

    // Process each perimeter term
    for (const term of perimeter) {
        const pattern = matchPerimeterTerm(term);

        if (!pattern) {
            unmatchedTerms.push(term);
            continue;
        }

        const termSignals = extractFromPerimeterTerm(
            term, pattern, complexity, techCategory, byCode, byPrefix,
        );

        allSignals.push(...termSignals);
    }

    // Deduplicate: keep highest score per activity code
    const bestByCode = new Map<string, UnderstandingSignal>();
    for (const signal of allSignals) {
        const existing = bestByCode.get(signal.activityCode);
        if (!existing || signal.score > existing.score) {
            // Merge provenance if upgrading
            if (existing) {
                signal.provenance = [
                    ...signal.provenance,
                    `also-matched-by:${existing.provenance.find(p => p.startsWith('term:'))?.replace('term:', '') ?? 'unknown'}`,
                ];
            }
            bestByCode.set(signal.activityCode, signal);
        }
    }

    // Sort by score descending
    const signals = [...bestByCode.values()].sort((a, b) => b.score - a.score);

    return {
        signals,
        unmatchedTerms,
        complexityLevel: complexityLevel as UnderstandingExtractionResult['complexityLevel'],
        perimeterTermsProcessed: perimeter.length,
        signalsProduced: signals.length,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Adapter — converts UnderstandingExtractionResult → SignalSet
// ─────────────────────────────────────────────────────────────────────────────

/** Map ImpactLayer string to PipelineLayer (filtering out ai_pipeline) */
function toPipelineLayer(layer: string): PipelineLayer | undefined {
    const valid: PipelineLayer[] = ['frontend', 'logic', 'data', 'integration', 'automation', 'configuration'];
    return valid.includes(layer as PipelineLayer) ? (layer as PipelineLayer) : undefined;
}

/**
 * Convert an UnderstandingExtractionResult into a canonical SignalSet.
 *
 * Each UnderstandingSignal becomes a NormalizedSignal with:
 *   - score = original score (already 0–1)
 *   - kind = mapped from signal.kind (functional-perimeter → understanding-perimeter,
 *            complexity-variant → understanding-complexity)
 *   - source = 'understanding'
 *   - layer = extracted from provenance chain
 */
export function understandingToNormalizedSignals(
    result: UnderstandingExtractionResult,
): SignalSet {
    const signals: NormalizedSignal[] = [];

    for (const sig of result.signals) {
        // Map internal kind to canonical SignalKind
        const kind = sig.kind === 'complexity-variant'
            ? 'understanding-complexity' as const
            : 'understanding-perimeter' as const;

        // Extract layer from provenance (format: "layer:frontend")
        const layerProv = sig.provenance.find(p => p.startsWith('layer:'));
        const rawLayer = layerProv?.split(':')[1];
        const layer = rawLayer ? toPipelineLayer(rawLayer) : undefined;

        signals.push({
            activityCode: sig.activityCode,
            score: sig.score,
            kind,
            source: 'understanding',
            confidence: sig.contributions.perimeterMatch || sig.contributions.complexityRouting,
            contributions: {
                perimeterMatch: sig.contributions.perimeterMatch,
                layerCoverage: sig.contributions.layerCoverage,
                complexityRouting: sig.contributions.complexityRouting,
            },
            provenance: sig.provenance,
            layer,
        });
    }

    return {
        signals,
        source: 'understanding',
        diagnostics: {
            processed: result.perimeterTermsProcessed,
            produced: signals.length,
            unmapped: result.unmatchedTerms,
        },
    };
}

