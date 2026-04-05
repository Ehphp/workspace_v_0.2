/**
 * Variant Router — Deterministic _SM/_LG variant selection
 *
 * Extracts the variant routing logic from the LLM SYSTEM_PROMPT
 * into a pure, testable function. The LLM prompt said:
 *
 *   - "semplice", "pochi", "1-2", "base", "minimo" → _SM
 *   - "complesso", "molti", "5+", "avanzato", "multipli" → _LG
 *   - neutral/absent → BASE (no suffix)
 *
 * This module also handles SIMPLE/COMPLEX prefix routing (from blueprint-
 * activity-mapper's complexity-based prefix selection).
 *
 * @module variant-router
 */

import type { Activity } from '../../activities';
import type { VariantChoice, InterviewAnswerLike } from './decision-engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Sets
// ─────────────────────────────────────────────────────────────────────────────

const SM_KEYWORDS = ['semplice', 'pochi', '1-2', 'base', 'minimo', 'semplici', 'poche', 'minima'] as const;
const LG_KEYWORDS = ['complesso', 'molti', '5+', 'avanzato', 'multipli', 'complessi', 'complessa', 'avanzata', 'avanzati'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all answer values as lowercase strings for keyword scanning.
 */
function flattenAnswerValues(answers: Record<string, InterviewAnswerLike>): string[] {
    const texts: string[] = [];
    for (const answer of Object.values(answers)) {
        if (typeof answer.value === 'string') {
            texts.push(answer.value.toLowerCase());
        } else if (Array.isArray(answer.value)) {
            for (const v of answer.value) {
                texts.push(String(v).toLowerCase());
            }
        } else if (typeof answer.value === 'number') {
            texts.push(String(answer.value));
        }
    }
    return texts;
}

/**
 * Count keyword hits in a set of text fragments.
 */
function countKeywordHits(texts: string[], keywords: readonly string[]): number {
    let hits = 0;
    for (const text of texts) {
        for (const kw of keywords) {
            if (text.includes(kw)) {
                hits++;
            }
        }
    }
    return hits;
}

/**
 * Determine the variant bias from interview answers.
 * Returns 'SM' | 'LG' | 'BASE' based on keyword balance.
 */
function detectVariantBias(answers: Record<string, InterviewAnswerLike>): 'SM' | 'LG' | 'BASE' {
    if (Object.keys(answers).length === 0) return 'BASE';

    const texts = flattenAnswerValues(answers);
    if (texts.length === 0) return 'BASE';

    const smHits = countKeywordHits(texts, SM_KEYWORDS);
    const lgHits = countKeywordHits(texts, LG_KEYWORDS);

    if (smHits > lgHits) return 'SM';
    if (lgHits > smHits) return 'LG';
    return 'BASE';
}

/**
 * Find the base prefix of an activity code (strip trailing _SM or _LG).
 */
function getBasePrefix(code: string): string {
    if (code.endsWith('_SM')) return code.slice(0, -3);
    if (code.endsWith('_LG')) return code.slice(0, -3);
    return code;
}

/**
 * Check if a specific code exists in the catalog.
 */
function existsInCatalog(code: string, catalog: Activity[]): boolean {
    return catalog.some(a => a.code === code);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route an activity code to its appropriate _SM/_LG variant based on
 * interview answers. Pure function, no IO.
 *
 * Algorithm:
 * 1. Detect bias from answer keywords (SM/LG/BASE)
 * 2. Compute the target code: basePrefix + suffix
 * 3. If target exists in catalog → use it
 * 4. If target doesn't exist → fallback to original code
 */
export function routeVariant(
    activityCode: string,
    answers: Record<string, InterviewAnswerLike>,
    catalog: Activity[],
): VariantChoice {
    const bias = detectVariantBias(answers);
    const basePrefix = getBasePrefix(activityCode);

    // Determine target code based on bias
    let targetCode: string;
    switch (bias) {
        case 'SM':
            targetCode = `${basePrefix}_SM`;
            break;
        case 'LG':
            targetCode = `${basePrefix}_LG`;
            break;
        case 'BASE':
            targetCode = basePrefix;
            break;
    }

    // If target is the same as original, no routing needed
    if (targetCode === activityCode) {
        return {
            originalCode: activityCode,
            resolvedCode: activityCode,
            variant: bias,
            reason: `Nessun cambio variante richiesto (bias: ${bias})`,
        };
    }

    // Verify target exists in catalog
    if (existsInCatalog(targetCode, catalog)) {
        return {
            originalCode: activityCode,
            resolvedCode: targetCode,
            variant: bias,
            reason: `Variante ${bias} selezionata: keyword match nelle risposte`,
        };
    }

    // Fallback: target doesn't exist, keep original
    return {
        originalCode: activityCode,
        resolvedCode: activityCode,
        variant: 'BASE',
        reason: `Variante ${bias} non trovata nel catalogo (${targetCode}), mantenuto originale`,
    };
}

/**
 * Route all candidate codes in a batch. Returns only entries where routing
 * actually changed the code.
 */
export function routeAllVariants(
    codes: string[],
    answers: Record<string, InterviewAnswerLike>,
    catalog: Activity[],
): VariantChoice[] {
    return codes
        .map(code => routeVariant(code, answers, catalog))
        .filter(choice => choice.originalCode !== choice.resolvedCode);
}
