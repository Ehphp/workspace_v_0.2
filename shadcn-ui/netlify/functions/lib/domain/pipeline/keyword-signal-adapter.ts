/**
 * Keyword Signal Adapter
 *
 * Wraps the legacy `selectTopActivities()` result into canonical
 * NormalizedSignal[] / SignalSet format.
 *
 * This is the simplest adapter — keyword ranking produces a ranked list
 * of Activity objects; we convert them to signals with linear score decay
 * (rank 1 = 1.0, rank N = score floor).
 *
 * @module keyword-signal-adapter
 */

import type { Activity, InterviewAnswerRecord } from '../../infrastructure/db/activities';
import { selectTopActivities } from '../../infrastructure/db/activities';
import type { ActivityBiases } from '../estimation/project-context-rules';
import type { NormalizedSignal, SignalSet } from './signal-types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum score floor for keyword signals */
const KEYWORD_SCORE_FLOOR = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface KeywordAdapterInput {
    /** Full activity catalog (pre-filtered by technology) */
    activities: Activity[];
    /** Requirement description text */
    description: string;
    /** Interview answers (if available) */
    answers?: Record<string, InterviewAnswerRecord>;
    /** Max activities to select */
    topN?: number;
    /** Blueprint object for keyword boosting (if available) */
    blueprint?: Record<string, unknown>;
    /** Project-context biases (if available) */
    activityBiases?: ActivityBiases;
}

/**
 * Run keyword ranking and convert the result to a canonical SignalSet.
 *
 * Score is linearly decayed from 1.0 (rank 1) to KEYWORD_SCORE_FLOOR
 * (last rank). This preserves ranking order without pretending keyword
 * matching has higher confidence than it does.
 */
export function keywordToNormalizedSignals(
    input: KeywordAdapterInput,
): SignalSet {
    const topN = input.topN ?? 20;
    const ranked = selectTopActivities(
        input.activities,
        input.description,
        input.answers,
        topN,
        input.blueprint,
        input.activityBiases,
    );

    const signals: NormalizedSignal[] = ranked.map((activity, index) => {
        // Linear decay: rank 0 → 1.0, rank N-1 → KEYWORD_SCORE_FLOOR
        const score = ranked.length <= 1
            ? 1.0
            : KEYWORD_SCORE_FLOOR + (1.0 - KEYWORD_SCORE_FLOOR) * (1 - index / (ranked.length - 1));

        return {
            activityCode: activity.code,
            score: Math.round(score * 1000) / 1000, // 3 decimal places
            kind: 'keyword-match' as const,
            source: 'keyword' as const,
            confidence: score * 0.7, // keyword confidence is inherently lower
            contributions: {
                keywordRank: 1 - index / Math.max(1, ranked.length - 1),
            },
            provenance: [
                `keyword:rank-${index + 1}-of-${ranked.length}`,
                `resolved:${activity.code}`,
            ],
        };
    });

    return {
        signals,
        source: 'keyword',
        diagnostics: {
            processed: input.activities.length,
            produced: signals.length,
            unmapped: [], // keyword ranker always produces output, no explicit unmapped
        },
    };
}
