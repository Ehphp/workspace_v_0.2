/**
 * project-context-integration.ts — Wiring between rules engine and estimation flow
 *
 * This module applies ProjectContextRuleResult to:
 *  1. Activity ranking (boost/penalty via biases)
 *  2. Driver/risk suggestion merge (deduplicated, provenance-tagged)
 *
 * Pure functions. No side effects. No database calls.
 */

import type { Activity } from '../../infrastructure/db/activities';
import type { ActivityBiases, ProjectContextRuleResult, ProjectContextRuleSuggestion } from './project-context-rules';

// ─── Activity bias application ──────────────────────────────────

/**
 * Apply project-context biases to a scored activity list.
 *
 * Works as a post-scoring adjustment layer: takes activities with their
 * existing keyword-ranking scores and applies additive boosts based on
 * project context rules.
 *
 * Does NOT remove activities. Only re-ranks via scoring deltas.
 */
export function applyActivityBiases(
    scoredActivities: { activity: Activity; score: number }[],
    biases: ActivityBiases,
): { activity: Activity; score: number }[] {
    if (!biases || Object.keys(biases).length === 0) return scoredActivities;

    const boostKeywordSet = new Set(
        (biases.boostKeywords ?? []).map((k) => k.toLowerCase()),
    );
    const boostGroupSet = new Set(
        (biases.boostGroups ?? []).map((g) => g.toUpperCase()),
    );

    return scoredActivities.map(({ activity, score }) => {
        let adjusted = score;

        // ── Group boost ──────────────────────────────────────────
        if (boostGroupSet.size > 0) {
            const activityGroup = (activity.group || '').toUpperCase();
            if (boostGroupSet.has(activityGroup)) {
                adjusted += 2;
            }
        }

        // ── Keyword boost ────────────────────────────────────────
        if (boostKeywordSet.size > 0) {
            const activityText = `${activity.code} ${activity.name} ${activity.description || ''} ${activity.group}`.toLowerCase();
            const activityWords = activityText.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter((w) => w.length > 2);
            for (const word of activityWords) {
                if (boostKeywordSet.has(word)) {
                    adjusted += 1.5;
                    break; // one boost per activity to avoid over-inflation
                }
            }
        }

        return { activity, score: adjusted };
    });
}

// ─── Driver / Risk merge ────────────────────────────────────────

export interface MergedDriver {
    code: string;
    suggestedValue?: string;
    reason: string;
    source: 'ai' | 'rule' | 'project_context_rule';
    rule?: string;
    fromQuestionId?: string | null;
}

export interface MergedRisk {
    code: string;
    reason: string;
    source: 'ai' | 'rule' | 'project_context_rule';
    rule?: string;
}

/**
 * AI suggested driver shape (from agent-types.ts SuggestedDriver).
 */
interface AISuggestedDriver {
    code: string;
    suggestedValue: string;
    reason: string;
    fromQuestionId: string | null;
}

/**
 * Merge AI-suggested drivers with project-context rule suggestions.
 *
 * - Deduplicates by `code` (AI wins if both suggest the same code)
 * - Preserves provenance (`source` field)
 * - Does NOT overwrite AI suggestions — rules are additive only
 *
 * @deprecated V2 pipeline uses AI as sole source of driver suggestions.
 *   Rule-based drivers are only used as fallback when AI returns empty.
 *   See Phase 3 of the AI-Driven Estimation Pipeline V2.
 */
export function mergeDriverSuggestions(
    aiDrivers: AISuggestedDriver[],
    ruleDrivers: ProjectContextRuleSuggestion[],
): MergedDriver[] {
    const seen = new Set<string>();
    const result: MergedDriver[] = [];

    // AI drivers have priority (more specific, question-grounded)
    for (const d of aiDrivers) {
        if (!seen.has(d.code)) {
            seen.add(d.code);
            result.push({
                code: d.code,
                suggestedValue: d.suggestedValue,
                reason: d.reason,
                source: 'ai',
                fromQuestionId: d.fromQuestionId,
            });
        }
    }

    // Rule-based drivers fill gaps (only if not already suggested by AI)
    for (const d of ruleDrivers) {
        if (!seen.has(d.code)) {
            seen.add(d.code);
            result.push({
                code: d.code,
                reason: d.reason,
                source: d.source,
                rule: d.rule,
            });
        }
    }

    return result;
}

/**
 * Merge AI-suggested risks with project-context rule suggestions.
 *
 * - AI risks are code-only strings; rule risks have full provenance
 * - Deduplicates by code
 * - Rule risks are additive
 *
 * @deprecated V2 pipeline uses AI as sole source of risk suggestions.
 *   Rule-based risks are only used as fallback when AI returns empty.
 *   See Phase 3 of the AI-Driven Estimation Pipeline V2.
 */
export function mergeRiskSuggestions(
    aiRisks: string[],
    ruleRisks: ProjectContextRuleSuggestion[],
): MergedRisk[] {
    const seen = new Set<string>();
    const result: MergedRisk[] = [];

    for (const code of aiRisks) {
        if (!seen.has(code)) {
            seen.add(code);
            result.push({
                code,
                reason: 'AI-suggested risk.',
                source: 'ai',
            });
        }
    }

    for (const r of ruleRisks) {
        if (!seen.has(r.code)) {
            seen.add(r.code);
            result.push({
                code: r.code,
                reason: r.reason,
                source: r.source,
                rule: r.rule,
            });
        }
    }

    return result;
}
