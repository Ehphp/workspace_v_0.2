/**
 * Tests for project-context-rules.ts — deterministic project context rules engine
 *
 * Covers:
 *   1. scope=LARGE → preferLargeVariants, notes
 *   2. scope=SMALL → preferSmallVariants, notes
 *   3. deadlinePressure=CRITICAL → driver + risk + notes
 *   4. deadlinePressure=TIGHT → risk + notes (no driver)
 *   5. teamSize=1 → SPOF risk
 *   6. teamSize>=8 → coordination driver + notes
 *   7. projectType=MIGRATION → boostKeywords + boostGroups
 *   8. projectType=NEW_DEVELOPMENT → neutral (no keywords)
 *   9. methodology=WATERFALL → boostKeywords
 *   10. domain present → domain tokens as boostKeywords
 *   11. empty/null context → neutral result
 *   12. combined context → all rules fire additively
 */

import { describe, it, expect } from 'vitest';
import {
    evaluateProjectContextRules,
    type ProjectContextRuleResult,
} from '../../netlify/functions/lib/domain/estimation/project-context-rules';
import type { EstimationContext } from '../../netlify/functions/lib/domain/types/estimation';

// ─── Helpers ────────────────────────────────────────────────────────────────

function evalWith(
    project: EstimationContext['project'],
): ProjectContextRuleResult {
    return evaluateProjectContextRules({ project });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('evaluateProjectContextRules', () => {
    // ── Null / empty ──────────────────────────────────────────────────────

    it('returns neutral result when context is null', () => {
        const result = evaluateProjectContextRules(null);
        expect(result.activityBiases).toEqual({});
        expect(result.suggestedDrivers).toEqual([]);
        expect(result.suggestedRisks).toEqual([]);
        expect(result.notes).toEqual([]);
    });

    it('returns neutral result when context is undefined', () => {
        const result = evaluateProjectContextRules(undefined);
        expect(result.activityBiases).toEqual({});
        expect(result.suggestedDrivers).toEqual([]);
        expect(result.suggestedRisks).toEqual([]);
        expect(result.notes).toEqual([]);
    });

    it('returns neutral result when project is null inside context', () => {
        const result = evaluateProjectContextRules({ project: null });
        expect(result.suggestedDrivers).toEqual([]);
        expect(result.notes).toEqual([]);
    });

    // ── Scope ─────────────────────────────────────────────────────────────

    it('scope=LARGE → preferLargeVariants + notes', () => {
        const result = evalWith({ scope: 'LARGE' });
        expect(result.activityBiases.preferLargeVariants).toBe(true);
        expect(result.activityBiases.preferSmallVariants).toBeUndefined();
        expect(result.notes.some(n => n.includes('scope_large'))).toBe(true);
    });

    it('scope=ENTERPRISE → preferLargeVariants + notes', () => {
        const result = evalWith({ scope: 'ENTERPRISE' });
        expect(result.activityBiases.preferLargeVariants).toBe(true);
        expect(result.notes.some(n => n.includes('ENTERPRISE'))).toBe(true);
    });

    it('scope=SMALL → preferSmallVariants + notes', () => {
        const result = evalWith({ scope: 'SMALL' });
        expect(result.activityBiases.preferSmallVariants).toBe(true);
        expect(result.activityBiases.preferLargeVariants).toBeUndefined();
        expect(result.notes.some(n => n.includes('scope_small'))).toBe(true);
    });

    it('scope=MEDIUM → no variant preference', () => {
        const result = evalWith({ scope: 'MEDIUM' });
        expect(result.activityBiases.preferLargeVariants).toBeUndefined();
        expect(result.activityBiases.preferSmallVariants).toBeUndefined();
    });

    // ── Deadline pressure ─────────────────────────────────────────────────

    it('deadlinePressure=CRITICAL → driver + risk + notes', () => {
        const result = evalWith({ deadlinePressure: 'CRITICAL' });

        expect(result.suggestedDrivers).toHaveLength(1);
        expect(result.suggestedDrivers[0].code).toBe('TIMELINE_PRESSURE');
        expect(result.suggestedDrivers[0].source).toBe('project_context_rule');
        expect(result.suggestedDrivers[0].rule).toBe('deadline_critical_driver');

        expect(result.suggestedRisks).toHaveLength(1);
        expect(result.suggestedRisks[0].code).toBe('TIMELINE_RISK');
        expect(result.suggestedRisks[0].source).toBe('project_context_rule');

        expect(result.notes.some(n => n.includes('deadline_critical'))).toBe(true);
    });

    it('deadlinePressure=TIGHT → risk only (no driver)', () => {
        const result = evalWith({ deadlinePressure: 'TIGHT' });
        expect(result.suggestedDrivers).toHaveLength(0);
        expect(result.suggestedRisks).toHaveLength(1);
        expect(result.suggestedRisks[0].code).toBe('TIMELINE_RISK');
        expect(result.notes.some(n => n.includes('deadline_tight'))).toBe(true);
    });

    it('deadlinePressure=NORMAL → no suggestions', () => {
        const result = evalWith({ deadlinePressure: 'NORMAL' });
        expect(result.suggestedDrivers).toHaveLength(0);
        expect(result.suggestedRisks).toHaveLength(0);
    });

    it('deadlinePressure=RELAXED → no suggestions', () => {
        const result = evalWith({ deadlinePressure: 'RELAXED' });
        expect(result.suggestedDrivers).toHaveLength(0);
        expect(result.suggestedRisks).toHaveLength(0);
    });

    // ── Team size ─────────────────────────────────────────────────────────

    it('teamSize=1 → SPOF risk', () => {
        const result = evalWith({ teamSize: 1 });
        expect(result.suggestedRisks).toHaveLength(1);
        expect(result.suggestedRisks[0].code).toBe('SINGLE_RESOURCE_RISK');
        expect(result.suggestedRisks[0].rule).toBe('team_single_spof');
        expect(result.notes.some(n => n.includes('team_single'))).toBe(true);
    });

    it('teamSize=8 → coordination driver + notes', () => {
        const result = evalWith({ teamSize: 8 });
        expect(result.suggestedDrivers).toHaveLength(1);
        expect(result.suggestedDrivers[0].code).toBe('TEAM_COORDINATION');
        expect(result.suggestedDrivers[0].rule).toBe('team_large_coordination');
        expect(result.notes.some(n => n.includes('team_large'))).toBe(true);
    });

    it('teamSize=12 → coordination driver mentioning team size', () => {
        const result = evalWith({ teamSize: 12 });
        expect(result.suggestedDrivers[0].reason).toContain('12');
    });

    it('teamSize=4 → no suggestions (mid-range)', () => {
        const result = evalWith({ teamSize: 4 });
        expect(result.suggestedDrivers).toHaveLength(0);
        expect(result.suggestedRisks).toHaveLength(0);
    });

    // ── Project type ──────────────────────────────────────────────────────

    it('projectType=MIGRATION → boostKeywords + boostGroups', () => {
        const result = evalWith({ projectType: 'MIGRATION' });
        expect(result.activityBiases.boostKeywords).toBeDefined();
        expect(result.activityBiases.boostKeywords!.length).toBeGreaterThan(0);
        expect(result.activityBiases.boostKeywords).toContain('migration');
        expect(result.activityBiases.boostKeywords).toContain('regression');
        expect(result.activityBiases.boostGroups).toBeDefined();
        expect(result.activityBiases.boostGroups).toContain('MIGRATION');
        expect(result.notes.some(n => n.includes('type_migration'))).toBe(true);
    });

    it('projectType=INTEGRATION → api/integration keywords + groups', () => {
        const result = evalWith({ projectType: 'INTEGRATION' });
        expect(result.activityBiases.boostKeywords).toContain('api');
        expect(result.activityBiases.boostKeywords).toContain('integration');
        expect(result.activityBiases.boostGroups).toContain('INTEGRATION');
    });

    it('projectType=NEW_DEVELOPMENT → neutral (no boost keywords)', () => {
        const result = evalWith({ projectType: 'NEW_DEVELOPMENT' });
        expect(result.activityBiases.boostKeywords).toBeUndefined();
        expect(result.activityBiases.boostGroups).toBeUndefined();
        expect(result.notes.some(n => n.includes('type_new_dev'))).toBe(true);
    });

    it('projectType=MAINTENANCE → analysis/bugfix keywords', () => {
        const result = evalWith({ projectType: 'MAINTENANCE' });
        expect(result.activityBiases.boostKeywords).toContain('analysis');
        expect(result.activityBiases.boostKeywords).toContain('bugfix');
    });

    it('projectType=REFACTORING → testing/cleanup keywords', () => {
        const result = evalWith({ projectType: 'REFACTORING' });
        expect(result.activityBiases.boostKeywords).toContain('testing');
        expect(result.activityBiases.boostKeywords).toContain('cleanup');
    });

    // ── Methodology ───────────────────────────────────────────────────────

    it('methodology=WATERFALL → analysis/documentation keywords', () => {
        const result = evalWith({ methodology: 'WATERFALL' });
        expect(result.activityBiases.boostKeywords).toContain('analysis');
        expect(result.activityBiases.boostKeywords).toContain('documentation');
        expect(result.notes.some(n => n.includes('methodology_waterfall'))).toBe(true);
    });

    it('methodology=AGILE → iterative/testing keywords', () => {
        const result = evalWith({ methodology: 'AGILE' });
        expect(result.activityBiases.boostKeywords).toContain('testing');
        expect(result.activityBiases.boostKeywords).toContain('sprint');
    });

    it('methodology=HYBRID → neutral', () => {
        const result = evalWith({ methodology: 'HYBRID' });
        expect(result.notes.some(n => n.includes('methodology_hybrid'))).toBe(true);
        // No boostKeywords from methodology (HYBRID has empty array)
    });

    // ── Domain ────────────────────────────────────────────────────────────

    it('domain present → tokens as boostKeywords', () => {
        const result = evalWith({ domain: 'Healthcare - Medical Records' });
        expect(result.activityBiases.boostKeywords).toContain('healthcare');
        expect(result.activityBiases.boostKeywords).toContain('medical');
        expect(result.activityBiases.boostKeywords).toContain('records');
        expect(result.notes.some(n => n.includes('[domain]'))).toBe(true);
    });

    it('empty domain string → no boost', () => {
        const result = evalWith({ domain: '  ' });
        // No domain-related boostKeywords
        expect(result.activityBiases.boostKeywords).toBeUndefined();
    });

    // ── Combined context ──────────────────────────────────────────────────

    it('combined: scope=LARGE + deadlinePressure=CRITICAL + teamSize=1', () => {
        const result = evalWith({
            scope: 'LARGE',
            deadlinePressure: 'CRITICAL',
            teamSize: 1,
        });

        // Scope
        expect(result.activityBiases.preferLargeVariants).toBe(true);

        // Deadline
        expect(result.suggestedDrivers.some(d => d.code === 'TIMELINE_PRESSURE')).toBe(true);
        expect(result.suggestedRisks.some(r => r.code === 'TIMELINE_RISK')).toBe(true);

        // Team
        expect(result.suggestedRisks.some(r => r.code === 'SINGLE_RESOURCE_RISK')).toBe(true);

        // All provenance is consistent
        for (const d of result.suggestedDrivers) {
            expect(d.source).toBe('project_context_rule');
            expect(d.rule).toBeTruthy();
        }
        for (const r of result.suggestedRisks) {
            expect(r.source).toBe('project_context_rule');
            expect(r.rule).toBeTruthy();
        }

        // Notes from all rules
        expect(result.notes.length).toBeGreaterThanOrEqual(3);
    });

    it('all provenance fields are present on every suggestion', () => {
        const result = evalWith({
            scope: 'ENTERPRISE',
            deadlinePressure: 'CRITICAL',
            teamSize: 10,
            projectType: 'MIGRATION',
            methodology: 'WATERFALL',
            domain: 'Finance',
        });

        for (const d of result.suggestedDrivers) {
            expect(d).toHaveProperty('code');
            expect(d).toHaveProperty('reason');
            expect(d).toHaveProperty('source', 'project_context_rule');
            expect(d).toHaveProperty('rule');
            expect(d.rule.length).toBeGreaterThan(0);
        }

        for (const r of result.suggestedRisks) {
            expect(r).toHaveProperty('code');
            expect(r).toHaveProperty('reason');
            expect(r).toHaveProperty('source', 'project_context_rule');
            expect(r).toHaveProperty('rule');
        }
    });
});
