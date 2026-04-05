/**
 * Perimeter Normalizer
 *
 * Maps free-text perimeter terms (from RequirementUnderstanding.functionalPerimeter)
 * to canonical vocabulary entries.
 *
 * Three-tier matching: exact → stemmed → fuzzy substring.
 *
 * Eliminates "silent drop": unmatched terms are returned with canonical=null
 * and confidence=0, so callers see what was lost.
 *
 * @module perimeter-normalizer
 */

import { PERIMETER_LAYER_MAP } from '../../understanding-signal-extractor';
import type { PipelineLayer } from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedPerimeterTerm {
    /** Original free-text term from functionalPerimeter */
    original: string;
    /** Canonical keyword from PERIMETER_LAYER_MAP (null if unmatched) */
    canonical: string | null;
    /** Matched layers (empty array if unmatched) */
    layers: PipelineLayer[];
    /** Match confidence (0.0 if unmatched, up to 1.0) */
    confidence: number;
    /** Which matching strategy succeeded */
    matchStrategy: 'exact' | 'stem' | 'fuzzy' | 'none';
    /** Pattern group from PERIMETER_LAYER_MAP (if matched) */
    group?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stemming (lightweight Italian/English suffix stripping)
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_SUFFIXES = [
    'zione', 'zioni', 'amento', 'amenti', 'tura', 'ture',
    'ione', 'ioni', 'ente', 'enti', 'aggio', 'aggi',
    'tion', 'tions', 'ment', 'ments', 'ing', 'ness',
    'ity', 'ies', 'ous', 'ive', 'ble',
];

function stem(word: string): string {
    const lower = word.toLowerCase();
    for (const suffix of STRIP_SUFFIXES) {
        if (lower.length > suffix.length + 3 && lower.endsWith(suffix)) {
            return lower.slice(0, -suffix.length);
        }
    }
    return lower;
}

function stemTokens(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-zA-ZÀ-ÿ0-9]+/)
        .filter(w => w.length > 2)
        .map(stem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an array of free-text perimeter terms to canonical vocabulary.
 *
 * Matching tiers (first match wins):
 *   1. Exact: term.toLowerCase().includes(pattern.keyword)
 *   2. Stem:  stemmed tokens of term overlap with stemmed keyword
 *   3. Fuzzy: substring match of keyword within term (≥4 char overlap)
 *
 * @param terms  Raw strings from functionalPerimeter
 * @returns One NormalizedPerimeterTerm per input term (same order)
 */
export function normalizePerimeterTerms(
    terms: string[],
): NormalizedPerimeterTerm[] {
    return terms.map(term => matchSingleTerm(term));
}

function matchSingleTerm(term: string): NormalizedPerimeterTerm {
    const lower = term.toLowerCase().trim();
    if (!lower) {
        return { original: term, canonical: null, layers: [], confidence: 0, matchStrategy: 'none' };
    }

    // Tier 1: exact includes (same logic as matchPerimeterTerm)
    for (const pattern of PERIMETER_LAYER_MAP) {
        if (lower.includes(pattern.keyword)) {
            return {
                original: term,
                canonical: pattern.keyword,
                layers: pattern.layers.filter(l => l !== 'ai_pipeline') as PipelineLayer[],
                confidence: pattern.confidence,
                matchStrategy: 'exact',
                group: pattern.group,
            };
        }
    }

    // Tier 2: stemmed token overlap
    const termStems = stemTokens(lower);
    for (const pattern of PERIMETER_LAYER_MAP) {
        const keywordStems = stemTokens(pattern.keyword);
        const overlap = keywordStems.some(ks => termStems.some(ts => ts === ks));
        if (overlap) {
            return {
                original: term,
                canonical: pattern.keyword,
                layers: pattern.layers.filter(l => l !== 'ai_pipeline') as PipelineLayer[],
                confidence: pattern.confidence * 0.8, // reduced confidence for stem match
                matchStrategy: 'stem',
                group: pattern.group,
            };
        }
    }

    // Tier 3: fuzzy substring (≥4 char keyword fragments)
    for (const pattern of PERIMETER_LAYER_MAP) {
        if (pattern.keyword.length >= 4) {
            const fragment = pattern.keyword.slice(0, Math.max(4, Math.floor(pattern.keyword.length * 0.7)));
            if (lower.includes(fragment)) {
                return {
                    original: term,
                    canonical: pattern.keyword,
                    layers: pattern.layers.filter(l => l !== 'ai_pipeline') as PipelineLayer[],
                    confidence: pattern.confidence * 0.5, // reduced confidence for fuzzy
                    matchStrategy: 'fuzzy',
                    group: pattern.group,
                };
            }
        }
    }

    // No match
    return { original: term, canonical: null, layers: [], confidence: 0, matchStrategy: 'none' };
}
