/**
 * Tests for project-context-integration.ts — bias application and merge logic
 *
 * Covers:
 *   1. applyActivityBiases: variant preference (_SM/_LG)
 *   2. applyActivityBiases: group boost
 *   3. applyActivityBiases: keyword boost
 *   4. applyActivityBiases: empty biases → no change
 *   5. mergeDriverSuggestions: AI priority, dedup, provenance
 *   6. mergeRiskSuggestions: AI priority, dedup, provenance
 */

import { describe, it, expect } from 'vitest';
import {
    applyActivityBiases,
    mergeDriverSuggestions,
    mergeRiskSuggestions,
} from '../../netlify/functions/lib/domain/estimation/project-context-integration';
import type { Activity } from '../../netlify/functions/lib/activities';
import type { ProjectContextRuleSuggestion } from '../../netlify/functions/lib/domain/estimation/project-context-rules';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeActivity(code: string, group = 'DEV', name = ''): Activity {
    return {
        code,
        name: name || `Activity ${code}`,
        description: '',
        base_hours: 8,
        group,
        tech_category: 'TEST',
    };
}

function scored(activity: Activity, score: number) {
    return { activity, score };
}

// ─── Activity Biases ────────────────────────────────────────────────────────

describe('applyActivityBiases', () => {
    it('preferLargeVariants boosts _LG and penalizes _SM', () => {
        const input = [
            scored(makeActivity('PP_DV_FORM_SM'), 5),
            scored(makeActivity('PP_DV_FORM'), 5),
            scored(makeActivity('PP_DV_FORM_LG'), 5),
        ];

        const result = applyActivityBiases(input, { preferLargeVariants: true });

        const lgScore = result.find(r => r.activity.code === 'PP_DV_FORM_LG')!.score;
        const smScore = result.find(r => r.activity.code === 'PP_DV_FORM_SM')!.score;
        const baseScore = result.find(r => r.activity.code === 'PP_DV_FORM')!.score;

        expect(lgScore).toBeGreaterThan(baseScore);
        expect(smScore).toBeLessThan(baseScore);
    });

    it('preferSmallVariants boosts _SM and penalizes _LG', () => {
        const input = [
            scored(makeActivity('PP_DV_FORM_SM'), 5),
            scored(makeActivity('PP_DV_FORM_LG'), 5),
        ];

        const result = applyActivityBiases(input, { preferSmallVariants: true });

        const smScore = result.find(r => r.activity.code === 'PP_DV_FORM_SM')!.score;
        const lgScore = result.find(r => r.activity.code === 'PP_DV_FORM_LG')!.score;

        expect(smScore).toBeGreaterThan(lgScore);
    });

    it('boostGroups raises score for matching groups', () => {
        const input = [
            scored(makeActivity('ACT_1', 'MIGRATION'), 5),
            scored(makeActivity('ACT_2', 'DEV'), 5),
        ];

        const result = applyActivityBiases(input, { boostGroups: ['MIGRATION'] });

        const migScore = result.find(r => r.activity.code === 'ACT_1')!.score;
        const devScore = result.find(r => r.activity.code === 'ACT_2')!.score;

        expect(migScore).toBeGreaterThan(devScore);
    });

    it('boostKeywords raises score for matching activity text', () => {
        const input = [
            scored(makeActivity('ACT_API', 'DEV', 'API Integration Service'), 5),
            scored(makeActivity('ACT_FORM', 'DEV', 'Form Builder'), 5),
        ];

        const result = applyActivityBiases(input, { boostKeywords: ['api', 'integration'] });

        const apiScore = result.find(r => r.activity.code === 'ACT_API')!.score;
        const formScore = result.find(r => r.activity.code === 'ACT_FORM')!.score;

        expect(apiScore).toBeGreaterThan(formScore);
    });

    it('empty biases → scores unchanged', () => {
        const input = [
            scored(makeActivity('ACT_1'), 10),
            scored(makeActivity('ACT_2'), 20),
        ];

        const result = applyActivityBiases(input, {});

        expect(result[0].score).toBe(10);
        expect(result[1].score).toBe(20);
    });
});

// ─── Driver Merge ───────────────────────────────────────────────────────────

describe('mergeDriverSuggestions', () => {
    it('AI drivers come first (priority)', () => {
        const aiDrivers = [
            { code: 'COMPLEXITY', suggestedValue: 'HIGH', reason: 'AI reason', fromQuestionId: 'q1' },
        ];
        const ruleDrivers: ProjectContextRuleSuggestion[] = [
            { code: 'TIMELINE_PRESSURE', reason: 'Rule reason', source: 'project_context_rule', rule: 'deadline_critical' },
        ];

        const result = mergeDriverSuggestions(aiDrivers, ruleDrivers);

        expect(result).toHaveLength(2);
        expect(result[0].source).toBe('ai');
        expect(result[0].code).toBe('COMPLEXITY');
        expect(result[1].source).toBe('project_context_rule');
        expect(result[1].code).toBe('TIMELINE_PRESSURE');
    });

    it('deduplicates by code — AI wins', () => {
        const aiDrivers = [
            { code: 'TIMELINE_PRESSURE', suggestedValue: 'HIGH', reason: 'AI-specific', fromQuestionId: 'q2' },
        ];
        const ruleDrivers: ProjectContextRuleSuggestion[] = [
            { code: 'TIMELINE_PRESSURE', reason: 'Rule reason', source: 'project_context_rule', rule: 'deadline_critical' },
        ];

        const result = mergeDriverSuggestions(aiDrivers, ruleDrivers);

        expect(result).toHaveLength(1);
        expect(result[0].source).toBe('ai');
        expect(result[0].reason).toBe('AI-specific');
    });
});

// ─── Risk Merge ─────────────────────────────────────────────────────────────

describe('mergeRiskSuggestions', () => {
    it('AI risks come first, rule risks fill gaps', () => {
        const aiRisks = ['COMPLEXITY_RISK'];
        const ruleRisks: ProjectContextRuleSuggestion[] = [
            { code: 'TIMELINE_RISK', reason: 'Tight deadline', source: 'project_context_rule', rule: 'deadline_tight' },
        ];

        const result = mergeRiskSuggestions(aiRisks, ruleRisks);

        expect(result).toHaveLength(2);
        expect(result[0].source).toBe('ai');
        expect(result[1].source).toBe('project_context_rule');
        expect(result[1].rule).toBe('deadline_tight');
    });

    it('deduplicates by code — AI wins', () => {
        const aiRisks = ['TIMELINE_RISK'];
        const ruleRisks: ProjectContextRuleSuggestion[] = [
            { code: 'TIMELINE_RISK', reason: 'From rule', source: 'project_context_rule', rule: 'deadline_critical' },
        ];

        const result = mergeRiskSuggestions(aiRisks, ruleRisks);

        expect(result).toHaveLength(1);
        expect(result[0].source).toBe('ai');
    });
});
