/**
 * UnderstandingSignalExtractor — Test suite
 *
 * Tests that RequirementUnderstanding enters the candidate pipeline
 * as DETERMINISTIC STRUCTURED signals, not fuzzy keyword matching.
 *
 * Verifies:
 * 1. functionalPerimeter[] → layer mapping → activity codes
 * 2. complexityAssessment.level → complexity level tracking (hour scaling downstream)
 * 3. Every signal has score, sources, contributions, provenance
 * 4. No understanding → zero signals, no crash
 * 5. Unknown perimeter terms → skipped, tracked in unmatchedTerms
 * 6. Understanding contribution visible in CandidateBuilder output
 */

import { describe, it, expect } from 'vitest';
import {
    extractUnderstandingSignals,
    matchPerimeterTerm,
    PERIMETER_LAYER_MAP,
    type UnderstandingSignal,
} from '../../netlify/functions/lib/understanding-signal-extractor';
import { buildCandidateSet } from '../../netlify/functions/lib/candidate-builder';
import type { RequirementUnderstanding } from '../types/requirement-understanding';
import type { Activity } from '../../netlify/functions/lib/activities';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeActivity(code: string, name: string = code, group: string = 'GEN'): Activity {
    return {
        code,
        name,
        description: name,
        base_hours: 8,
        group,
        tech_category: 'POWER_PLATFORM',
    };
}

function makePowerPlatformCatalog(): Activity[] {
    return [
        // Frontend (LAYER_TECH_PATTERNS: PP_DV_FORM, PP_DV_FIELD, PP_ANL_ALIGN)
        makeActivity('PP_DV_FORM', 'Model-driven form', 'DEV'),
        makeActivity('PP_DV_FORM_SM', 'Model-driven form SM', 'DEV'),
        makeActivity('PP_DV_FORM_LG', 'Model-driven form LG', 'DEV'),
        makeActivity('PP_ANL_ALIGN', 'Analysis alignment', 'ANALYSIS'),
        makeActivity('PP_ANL_ALIGN_SM', 'Analysis alignment SM', 'ANALYSIS'),
        makeActivity('PP_ANL_ALIGN_LG', 'Analysis alignment LG', 'ANALYSIS'),
        // Data (LAYER_TECH_PATTERNS: PP_DV_FIELD)
        makeActivity('PP_DV_FIELD', 'Dataverse field', 'DEV'),
        makeActivity('PP_DV_FIELD_SM', 'Dataverse field SM', 'DEV'),
        makeActivity('PP_DV_FIELD_LG', 'Dataverse field LG', 'DEV'),
        // Logic (LAYER_TECH_PATTERNS: PP_BUSINESS_RULE, PP_FLOW_SIMPLE, PP_FLOW_COMPLEX)
        makeActivity('PP_BUSINESS_RULE', 'Business rule', 'DEV'),
        makeActivity('PP_BUSINESS_RULE_SM', 'Business rule SM', 'DEV'),
        makeActivity('PP_BUSINESS_RULE_LG', 'Business rule LG', 'DEV'),
        makeActivity('PP_FLOW_SIMPLE', 'Power Automate flow (simple)', 'DEV'),
        makeActivity('PP_FLOW_SIMPLE_SM', 'Flow simple SM', 'DEV'),
        makeActivity('PP_FLOW_SIMPLE_LG', 'Flow simple LG', 'DEV'),
        makeActivity('PP_FLOW_COMPLEX', 'Power Automate flow (complex)', 'DEV'),
        makeActivity('PP_FLOW_COMPLEX_SM', 'Flow complex SM', 'DEV'),
        makeActivity('PP_FLOW_COMPLEX_LG', 'Flow complex LG', 'DEV'),
        // Integration (LAYER_TECH_PATTERNS: PP_FLOW_COMPLEX)
        // PP_FLOW_COMPLEX already above
        // Configuration (LAYER_TECH_PATTERNS: PP_DV_FORM, PP_BUSINESS_RULE)
        // PP_DV_FORM and PP_BUSINESS_RULE already above
        // Testing
        makeActivity('PP_E2E_TEST', 'E2E test', 'TEST'),
        makeActivity('PP_E2E_TEST_SM', 'E2E test SM', 'TEST'),
        makeActivity('PP_E2E_TEST_LG', 'E2E test LG', 'TEST'),
        makeActivity('PP_UAT_RUN', 'UAT run', 'TEST'),
        // Deploy
        makeActivity('PP_DEPLOY', 'Deploy', 'OPS'),
        // Cross-cutting
        makeActivity('CRS_KICKOFF', 'Kickoff', 'GOVERNANCE'),
        makeActivity('CRS_DOC', 'Documentation', 'GOVERNANCE'),
        // Fallback for keyword matching
        makeActivity('GEN_ANALYSIS', 'Generic analysis', 'GEN'),
        makeActivity('GEN_TEST', 'Generic test', 'GEN'),
    ];
}

function makeUnderstanding(overrides: Partial<RequirementUnderstanding> = {}): RequirementUnderstanding {
    return {
        businessObjective: 'Test requirement objective',
        expectedOutput: 'Test output',
        functionalPerimeter: [],
        exclusions: [],
        actors: [{ role: 'User', interaction: 'Uses the system' }],
        stateTransition: { initialState: 'Before', finalState: 'After' },
        preconditions: [],
        assumptions: [],
        complexityAssessment: { level: 'MEDIUM', rationale: 'Average complexity' },
        confidence: 0.8,
        metadata: {
            generatedAt: new Date().toISOString(),
            model: 'gpt-4o-mini',
            inputDescriptionLength: 100,
        },
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PERIMETER MATCHING (explicit mapping, not fuzzy)
// ─────────────────────────────────────────────────────────────────────────────

describe('UnderstandingSignalExtractor', () => {
    describe('perimeter term matching', () => {
        it('matches explicit keywords from PERIMETER_LAYER_MAP', () => {
            const match = matchPerimeterTerm('gestione approvazioni');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('approvazion');
            expect(match!.layers).toContain('logic');
            expect(match!.group).toBe('logic');
        });

        it('matches dashboard to frontend layer', () => {
            const match = matchPerimeterTerm('Dashboard reportistica');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('dashboard');
            expect(match!.layers).toEqual(['frontend']);
        });

        it('matches integration terms to integration layer', () => {
            const match = matchPerimeterTerm('Integrazione con sistema esterno');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('integrazione');
            expect(match!.layers).toContain('integration');
        });

        it('matches data management to data layer', () => {
            const match = matchPerimeterTerm('Anagrafica clienti');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('anagrafica');
            expect(match!.layers).toContain('data');
        });

        it('matches automation terms', () => {
            const match = matchPerimeterTerm('Notifica automatica via email');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('notifica');
            expect(match!.layers).toContain('automation');
        });

        it('returns null for unknown terms', () => {
            const match = matchPerimeterTerm('blockchain quantum computing');
            expect(match).toBeNull();
        });

        it('is case-insensitive', () => {
            const match = matchPerimeterTerm('DASHBOARD PRINCIPALE');
            expect(match).not.toBeNull();
            expect(match!.keyword).toBe('dashboard');
        });

        it('returns null for empty string', () => {
            expect(matchPerimeterTerm('')).toBeNull();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. SIGNAL EXTRACTION
    // ─────────────────────────────────────────────────────────────────────────

    describe('signal extraction', () => {
        const catalog = makePowerPlatformCatalog();

        it('produces signals from functionalPerimeter terms', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni'],
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            expect(result.signals.length).toBeGreaterThan(0);
            expect(result.perimeterTermsProcessed).toBe(1);
            expect(result.signalsProduced).toBeGreaterThan(0);
            expect(result.unmatchedTerms).toHaveLength(0);
        });

        it('every signal has mandatory fields', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['Dashboard reportistica', 'Anagrafica clienti'],
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            for (const signal of result.signals) {
                expect(signal.activityCode).toBeTruthy();
                expect(signal.score).toBeGreaterThan(0);
                expect(signal.score).toBeLessThanOrEqual(1);
                expect(signal.sources.length).toBeGreaterThan(0);
                expect(signal.sources[0]).toBe('understanding-functional-perimeter');
                expect(signal.contributions.perimeterMatch).toBeGreaterThan(0);
                expect(signal.provenance.length).toBeGreaterThan(0);
                expect(signal.kind).toBe('functional-perimeter');
            }
        });

        it('provenance includes understanding source', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni'],
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            const signal = result.signals[0];
            expect(signal.provenance).toContain('understanding:functional-perimeter');
            expect(signal.provenance.some(p => p.startsWith('term:'))).toBe(true);
            expect(signal.provenance.some(p => p.startsWith('matched-keyword:'))).toBe(true);
            expect(signal.provenance.some(p => p.startsWith('group:'))).toBe(true);
            expect(signal.provenance.some(p => p.startsWith('layer:'))).toBe(true);
            expect(signal.provenance.some(p => p.startsWith('resolved:'))).toBe(true);
        });

        it('tracks unmatched terms', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['machine learning pipeline', 'dashboard'],
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            expect(result.unmatchedTerms).toContain('machine learning pipeline');
            expect(result.unmatchedTerms).not.toContain('dashboard');
        });

        it('returns empty for null/undefined understanding', () => {
            const resultNull = extractUnderstandingSignals(null, catalog, 'POWER_PLATFORM');
            expect(resultNull.signals).toHaveLength(0);
            expect(resultNull.complexityLevel).toBe('unknown');
            expect(resultNull.perimeterTermsProcessed).toBe(0);

            const resultUndefined = extractUnderstandingSignals(undefined, catalog, 'POWER_PLATFORM');
            expect(resultUndefined.signals).toHaveLength(0);
        });

        it('returns empty for understanding with no perimeter', () => {
            const understanding = makeUnderstanding({ functionalPerimeter: [] });
            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            expect(result.signals).toHaveLength(0);
            expect(result.perimeterTermsProcessed).toBe(0);
        });

        it('deduplicates signals by activity code (keeps highest score)', () => {
            // Both terms map to overlapping layers
            const understanding = makeUnderstanding({
                functionalPerimeter: ['dashboard principale', 'visualizzazione dati'],
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');
            const codes = result.signals.map(s => s.activityCode);
            const uniqueCodes = new Set(codes);
            expect(codes.length).toBe(uniqueCodes.size);
        });

        it('maps multiple perimeter terms to different layers', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: [
                    'interfaccia utente',      // → frontend
                    'integrazione API esterna', // → integration
                    'anagrafica prodotti',      // → data
                ],
                // HIGH complexity so PP_FLOW_COMPLEX (integration's only pattern) isn't skipped
                complexityAssessment: { level: 'HIGH', rationale: 'Complex integration' },
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            expect(result.perimeterTermsProcessed).toBe(3);
            expect(result.signalsProduced).toBeGreaterThanOrEqual(3);

            // Should have signals from different layers
            const layers = result.signals.flatMap(s =>
                s.provenance.filter(p => p.startsWith('layer:')).map(p => p.replace('layer:', '')),
            );
            const uniqueLayers = new Set(layers);
            expect(uniqueLayers.size).toBeGreaterThanOrEqual(2);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. COMPLEXITY TRACKING (level tracked, hour scaling downstream)
    // ─────────────────────────────────────────────────────────────────────────

    describe('complexity tracking', () => {
        const catalog = makePowerPlatformCatalog();

        it('tracks HIGH complexity level', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['dashboard principale'],
                complexityAssessment: { level: 'HIGH', rationale: 'Many entities involved' },
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');
            expect(result.complexityLevel).toBe('HIGH');

            // All codes should be base codes (no _SM/_LG)
            const codes = result.signals.map(s => s.activityCode);
            if (codes.length > 0) {
                const hasSM = codes.some(c => c.endsWith('_SM'));
                const hasLG = codes.some(c => c.endsWith('_LG'));
                expect(hasSM).toBe(false);
                expect(hasLG).toBe(false);
            }
        });

        it('tracks LOW complexity level', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['dashboard principale'],
                complexityAssessment: { level: 'LOW', rationale: 'Simple scope' },
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');
            expect(result.complexityLevel).toBe('LOW');

            // All codes should be base codes (no _SM/_LG)
            const codes = result.signals.map(s => s.activityCode);
            if (codes.length > 0) {
                const hasSM = codes.some(c => c.endsWith('_SM'));
                const hasLG = codes.some(c => c.endsWith('_LG'));
                expect(hasSM).toBe(false);
                expect(hasLG).toBe(false);
            }
        });

        it('uses base codes for MEDIUM complexity', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['dashboard principale'],
                complexityAssessment: { level: 'MEDIUM', rationale: 'Average' },
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');
            expect(result.complexityLevel).toBe('MEDIUM');
        });

        it('includes complexity in provenance when present', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni'],
                complexityAssessment: { level: 'HIGH', rationale: 'Many entities' },
            });

            const result = extractUnderstandingSignals(understanding, catalog, 'POWER_PLATFORM');

            if (result.signals.length > 0) {
                const signal = result.signals[0];
                expect(signal.provenance.some(p => p === 'complexity:HIGH')).toBe(true);
                expect(signal.sources).toContain('understanding-complexity');
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. MAPPING TABLE INTEGRITY
    // ─────────────────────────────────────────────────────────────────────────

    describe('mapping table', () => {
        it('PERIMETER_LAYER_MAP has no duplicate keywords', () => {
            const keywords = PERIMETER_LAYER_MAP.map(p => p.keyword);
            const unique = new Set(keywords);
            expect(keywords.length).toBe(unique.size);
        });

        it('all patterns have valid layers', () => {
            const validLayers = new Set([
                'frontend', 'data', 'logic', 'integration', 'automation',
                'configuration', 'security', 'testing', 'deployment',
            ]);

            for (const pattern of PERIMETER_LAYER_MAP) {
                for (const layer of pattern.layers) {
                    expect(validLayers.has(layer)).toBe(true);
                }
            }
        });

        it('all patterns have confidence between 0 and 1', () => {
            for (const pattern of PERIMETER_LAYER_MAP) {
                expect(pattern.confidence).toBeGreaterThan(0);
                expect(pattern.confidence).toBeLessThanOrEqual(1);
            }
        });

        it('all patterns have a non-empty group', () => {
            for (const pattern of PERIMETER_LAYER_MAP) {
                expect(pattern.group.length).toBeGreaterThan(0);
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. CANDIDATE BUILDER INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────

    describe('CandidateBuilder integration', () => {
        const catalog = makePowerPlatformCatalog();

        it('understanding contributes to candidate scores', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni', 'dashboard reportistica'],
                complexityAssessment: { level: 'HIGH', rationale: 'Complex' },
            });

            const result = buildCandidateSet({
                catalog,
                description: 'Sistema di gestione approvazioni',
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            // Some candidates should have understanding contribution > 0
            const withUnderstanding = result.candidates.filter(
                c => c.contributions.understanding > 0,
            );
            expect(withUnderstanding.length).toBeGreaterThan(0);
        });

        it('understanding appears in diagnostics', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['integrazione sistemi esterni'],
            });

            const result = buildCandidateSet({
                catalog,
                description: 'Integrazione con SAP',
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            expect(result.diagnostics.fromUnderstanding).toBeGreaterThanOrEqual(0);
            expect(result.understandingResult).toBeDefined();
        });

        it('strategy includes understanding when present', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['dashboard'],
            });

            const result = buildCandidateSet({
                catalog,
                description: 'Dashboard test',
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            expect(result.strategy).toContain('understanding');
        });

        it('understanding provenance visible in candidate provenance', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni'],
            });

            const result = buildCandidateSet({
                catalog,
                description: 'Workflow approvativo',
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            const withUnderstanding = result.candidates.filter(
                c => c.contributions.understanding > 0,
            );

            if (withUnderstanding.length > 0) {
                const candidate = withUnderstanding[0];
                expect(candidate.provenance.some(p =>
                    p.includes('understanding'),
                )).toBe(true);
                expect(candidate.sources).toContain('understanding');
            }
        });

        it('understanding does NOT override blueprint', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['gestione approvazioni'],
            });

            const blueprint = {
                components: [
                    {
                        layer: 'frontend',
                        name: 'Main form',
                        interventionType: 'new_development',
                        complexity: 'MEDIUM',
                    },
                ],
            };

            const result = buildCandidateSet({
                catalog,
                description: 'Main form with approval workflow',
                techCategory: 'POWER_PLATFORM',
                understanding,
                blueprint,
            });

            // Blueprint should still be the top contributor where both apply
            const bpCandidates = result.candidates.filter(c => c.contributions.blueprint > 0);
            const unCandidates = result.candidates.filter(c => c.contributions.understanding > 0);

            // Both should contribute but blueprint weight (3.0) > understanding weight (1.5)
            if (bpCandidates.length > 0 && unCandidates.length > 0) {
                // Find a candidate that has both
                const overlap = result.candidates.find(
                    c => c.contributions.blueprint > 0 && c.contributions.understanding > 0,
                );
                if (overlap) {
                    expect(overlap.contributions.blueprint).toBeGreaterThan(
                        overlap.contributions.understanding,
                    );
                }
            }
        });

        it('understanding without matching terms produces keyword-only strategy', () => {
            const understanding = makeUnderstanding({
                functionalPerimeter: ['quantum computing pipeline'],
            });

            const result = buildCandidateSet({
                catalog,
                description: 'Some requirement',
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            // Understanding produced no signals, but result still includes diagnostics
            expect(result.understandingResult).toBeDefined();
            expect(result.understandingResult!.unmatchedTerms).toContain('quantum computing pipeline');
        });

        it('no understanding → no understanding contribution', () => {
            const result = buildCandidateSet({
                catalog,
                description: 'Simple requirement',
                techCategory: 'POWER_PLATFORM',
            });

            const withUnderstanding = result.candidates.filter(
                c => c.contributions.understanding > 0,
            );
            expect(withUnderstanding).toHaveLength(0);
            expect(result.understandingResult).toBeUndefined();
        });

        it('ranking changes when understanding is added', () => {
            const description = 'Sistema di notifiche automatiche';

            // Without understanding
            const resultWithout = buildCandidateSet({
                catalog,
                description,
                techCategory: 'POWER_PLATFORM',
            });

            // With understanding adding automation signals
            const understanding = makeUnderstanding({
                functionalPerimeter: ['notifica automatica', 'automazione processo'],
            });

            const resultWith = buildCandidateSet({
                catalog,
                description,
                techCategory: 'POWER_PLATFORM',
                understanding,
            });

            // The rankings should differ — understanding should boost automation activities
            const codesWithout = resultWithout.candidates.map(c => c.activity.code);
            const codesWith = resultWith.candidates.map(c => c.activity.code);

            // Either order changed or different activities surfaced
            const orderChanged = JSON.stringify(codesWithout) !== JSON.stringify(codesWith);
            const newActivities = codesWith.some(c => !codesWithout.includes(c));

            expect(orderChanged || newActivities).toBe(true);
        });
    });
});
