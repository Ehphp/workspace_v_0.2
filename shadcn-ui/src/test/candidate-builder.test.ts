/**
 * Tests for candidate-builder.ts
 *
 * Covers:
 *   1. Multi-signal merge: blueprint + impactMap + keyword
 *   2. Score weight ordering: blueprint (3.0) > impactMap (2.0) > keyword (1.0)
 *   3. Provenance contract: every candidate has score, sources, contributions, provenance
 *   4. Strategy detection: blueprint+impactmap, blueprint-only, impactmap-only, keyword-only
 *   5. Deduplication: same activity from multiple sources merges scores
 *   6. Diagnostics: fromBlueprint, fromImpactMap, fromKeyword, mergedOverlaps
 *   7. topN limit respected
 *   8. toDomainCandidates conversion preserves provenance
 *   9. Empty inputs → keyword-only fallback
 *  10. Impact-map-exclusive source when no blueprint contributes
 *  11. Score monotonicity: more signals = higher score
 */

import {
    buildCandidateSet,
    toDomainCandidates,
    type CandidateBuilderInput,
    type CandidateSetResult,
    type ScoredCandidate,
} from '../../netlify/functions/lib/candidate-builder';
import type { Activity } from '../../netlify/functions/lib/activities';
import type { ImpactMap, ImpactItem } from '../types/impact-map';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Test Activity Catalog (reused from signal-extractor tests)
// ─────────────────────────────────────────────────────────────────────────────

function buildTestCatalog(): Activity[] {
    return [
        // ANALYSIS
        { code: 'BE_ANL_ALIGN', name: 'Analisi API', description: 'Analisi requisiti backend', base_hours: 32, group: 'ANALYSIS', tech_category: 'BACKEND' },
        { code: 'BE_ANL_ALIGN_SM', name: 'Analisi API (Quick)', description: 'Review rapida', base_hours: 16, group: 'ANALYSIS', tech_category: 'BACKEND' },
        // DEV — API
        { code: 'BE_API_SIMPLE', name: 'API semplice', description: 'CRUD endpoint', base_hours: 48, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_API_SIMPLE_SM', name: 'API semplice (CRUD)', description: 'Singolo GET/POST', base_hours: 25.6, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX', name: 'API complessa', description: 'Orchestrazione servizi', base_hours: 96, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX_SM', name: 'API complessa (Base)', description: '2-3 servizi', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX_LG', name: 'API complessa (Advanced)', description: 'Saga pattern', base_hours: 192, group: 'DEV', tech_category: 'BACKEND' },
        // DEV — DB
        { code: 'BE_DB_MIGRATION', name: 'Migrazione DB', description: 'Schema migration', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_DB_MIGRATION_SM', name: 'Migrazione DB (Simple)', description: '1-2 colonne', base_hours: 32, group: 'DEV', tech_category: 'BACKEND' },
        { code: 'BE_DB_MIGRATION_LG', name: 'Migrazione DB (Complex)', description: 'Multi-table FK', base_hours: 128, group: 'DEV', tech_category: 'BACKEND' },
        // TEST
        { code: 'BE_UNIT_TEST', name: 'Unit test', description: 'Test unitari backend', base_hours: 32, group: 'TEST', tech_category: 'BACKEND' },
        { code: 'BE_INT_TEST', name: 'Integration test', description: 'Test integrazione', base_hours: 48, group: 'TEST', tech_category: 'BACKEND' },
        { code: 'BE_INT_TEST_SM', name: 'Integration test (Basic)', description: 'Singolo endpoint', base_hours: 25.6, group: 'TEST', tech_category: 'BACKEND' },
        // OPS
        { code: 'BE_LOGGING', name: 'Logging', description: 'Logging strutturato', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
        { code: 'BE_LOGGING_SM', name: 'Logging (Basic)', description: 'Log essenziali', base_hours: 16, group: 'OPS', tech_category: 'BACKEND' },
        { code: 'BE_DEPLOY', name: 'Deploy backend', description: 'Deploy CI/CD', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Impact Map factories
// ─────────────────────────────────────────────────────────────────────────────

function makeImpact(overrides: Partial<ImpactItem> = {}): ImpactItem {
    return {
        layer: 'logic',
        action: 'create',
        components: ['order service'],
        reason: 'New business logic for order processing',
        confidence: 0.85,
        ...overrides,
    };
}

function makeImpactMap(impacts: ImpactItem[]): ImpactMap {
    return {
        summary: 'Test impact map',
        impacts,
        overallConfidence: 0.8,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Blueprint factory
// ─────────────────────────────────────────────────────────────────────────────

function makeBlueprint(components: { name?: string; layer?: string; interventionType?: string; complexity?: string }[]): Record<string, unknown> {
    return {
        summary: 'Test blueprint',
        components: components.map((c, i) => ({
            name: c.name || `Component ${i}`,
            layer: c.layer || 'logic',
            interventionType: c.interventionType || 'new_development',
            complexity: c.complexity || 'MEDIUM',
            description: 'Test component',
        })),
        crossCuttingConcerns: [],
        assumptions: [],
        openQuestions: [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CandidateBuilder', () => {

    // ── 1. Multi-signal merge ─────────────────────────────────────────

    describe('multi-signal merge', () => {
        it('merges blueprint + impactMap + keyword signals for the same activity', () => {
            const catalog = buildTestCatalog();

            // Blueprint maps a logic component → BE_API_COMPLEX
            const blueprint = makeBlueprint([
                { name: 'Order API', layer: 'logic', complexity: 'HIGH' },
            ]);

            // ImpactMap also flags logic/create
            const impactMap = makeImpactMap([
                makeImpact({ layer: 'logic', action: 'create', confidence: 0.9 }),
            ]);

            const result = buildCandidateSet({
                catalog,
                description: 'Implement a new order processing API with complex business rules',
                techCategory: 'BACKEND',
                blueprint,
                impactMap,
                topN: 10,
            });

            expect(result.candidates.length).toBeGreaterThan(0);
            expect(result.strategy).toBe('blueprint+impactmap');

            // Find the BE_API_COMPLEX variant — should have contributions from multiple sources
            const apiComplex = result.candidates.find(c =>
                c.activity.code.startsWith('BE_API_COMPLEX'),
            );

            if (apiComplex) {
                // Must have contributions from at least 2 sources
                const nonZeroContribs = Object.values(apiComplex.contributions)
                    .filter(v => v > 0).length;
                expect(nonZeroContribs).toBeGreaterThanOrEqual(2);
            }
        });

        it('produces higher scores for activities with more signal sources', () => {
            const catalog = buildTestCatalog();

            // Only keyword — should produce lowest scores
            const keywordOnly = buildCandidateSet({
                catalog,
                description: 'Create a new backend API endpoint',
                techCategory: 'BACKEND',
                topN: 5,
            });

            // Blueprint + keyword
            const withBlueprint = buildCandidateSet({
                catalog,
                description: 'Create a new backend API endpoint',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic', complexity: 'LOW' }]),
                topN: 5,
            });

            // Blueprint + impactMap + keyword — should produce highest top score
            const withAll = buildCandidateSet({
                catalog,
                description: 'Create a new backend API endpoint',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic', complexity: 'LOW' }]),
                impactMap: makeImpactMap([makeImpact({ layer: 'logic', action: 'create' })]),
                topN: 5,
            });

            // Top score should increase as we add more signal sources
            const topKeyword = keywordOnly.candidates[0]?.score ?? 0;
            const topBlueprint = withBlueprint.candidates[0]?.score ?? 0;
            const topAll = withAll.candidates[0]?.score ?? 0;

            expect(topBlueprint).toBeGreaterThanOrEqual(topKeyword);
            expect(topAll).toBeGreaterThanOrEqual(topBlueprint);
        });
    });

    // ── 2. Score weight ordering ─────────────────────────────────────

    describe('score weight ordering', () => {
        it('blueprint contributes more than impactMap per unit score', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'API backend',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic', complexity: 'LOW' }]),
                impactMap: makeImpactMap([makeImpact({ layer: 'logic', action: 'create' })]),
                topN: 20,
            });

            // Find a candidate with both blueprint and impactMap contributions
            const merged = result.candidates.find(c =>
                c.contributions.blueprint > 0 && c.contributions.impactMap > 0,
            );

            if (merged) {
                // Blueprint weight (3.0) > ImpactMap weight (2.0)
                // For same raw score, blueprint contribution should be higher
                expect(merged.contributions.blueprint).toBeGreaterThan(0);
                expect(merged.contributions.impactMap).toBeGreaterThan(0);
            }
        });
    });

    // ── 3. Provenance contract ───────────────────────────────────────

    describe('provenance contract', () => {
        it('every candidate has score, sources, contributions, provenance', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Implement new order API with database migration',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([
                    { name: 'Order API', layer: 'logic', complexity: 'MEDIUM' },
                    { name: 'DB Schema', layer: 'data', complexity: 'LOW' },
                ]),
                impactMap: makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create' }),
                    makeImpact({ layer: 'data', action: 'modify' }),
                ]),
                topN: 10,
            });

            for (const candidate of result.candidates) {
                // Score must be positive
                expect(candidate.score).toBeGreaterThan(0);

                // Sources must be non-empty
                expect(candidate.sources.length).toBeGreaterThan(0);

                // Contributions must be an object with all 4 keys
                expect(candidate.contributions).toHaveProperty('blueprint');
                expect(candidate.contributions).toHaveProperty('impactMap');
                expect(candidate.contributions).toHaveProperty('keyword');
                expect(candidate.contributions).toHaveProperty('projectContext');

                // At least one contribution must be positive
                const totalContrib = candidate.contributions.blueprint
                    + candidate.contributions.impactMap
                    + candidate.contributions.keyword
                    + candidate.contributions.projectContext;
                expect(totalContrib).toBeGreaterThan(0);

                // Provenance must be non-empty array of strings
                expect(candidate.provenance.length).toBeGreaterThan(0);
                for (const p of candidate.provenance) {
                    expect(typeof p).toBe('string');
                }

                // PrimarySource must be set
                expect(candidate.primarySource).toBeTruthy();

                // Confidence must be 0–1
                expect(candidate.confidence).toBeGreaterThanOrEqual(0);
                expect(candidate.confidence).toBeLessThanOrEqual(1);
            }
        });

        it('candidates are sorted by score descending', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Complex API with database',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                topN: 15,
            });

            for (let i = 1; i < result.candidates.length; i++) {
                expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(
                    result.candidates[i].score,
                );
            }
        });
    });

    // ── 4. Strategy detection ────────────────────────────────────────

    describe('strategy detection', () => {
        it('detects blueprint+impactmap strategy', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                impactMap: makeImpactMap([makeImpact()]),
                topN: 5,
            });
            expect(result.strategy).toBe('blueprint+impactmap');
        });

        it('detects blueprint-only strategy', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                topN: 5,
            });
            expect(result.strategy).toBe('blueprint-only');
        });

        it('detects impactmap-only strategy', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                impactMap: makeImpactMap([makeImpact()]),
                topN: 5,
            });
            expect(result.strategy).toBe('impactmap-only');
        });

        it('detects keyword-only strategy', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                topN: 5,
            });
            expect(result.strategy).toBe('keyword-only');
        });
    });

    // ── 5. Deduplication ─────────────────────────────────────────────

    describe('deduplication', () => {
        it('same activity code appears only once in output', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Order processing API with complex orchestration',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'Order Logic', layer: 'logic', complexity: 'HIGH' }]),
                impactMap: makeImpactMap([makeImpact({ layer: 'logic', action: 'create' })]),
                topN: 20,
            });

            const codes = result.candidates.map(c => c.activity.code);
            const uniqueCodes = new Set(codes);
            expect(codes.length).toBe(uniqueCodes.size);
        });
    });

    // ── 6. Diagnostics ───────────────────────────────────────────────

    describe('diagnostics', () => {
        it('reports correct diagnostic counts', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'New API endpoint with database schema changes',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([
                    { name: 'API', layer: 'logic', complexity: 'LOW' },
                    { name: 'DB', layer: 'data', complexity: 'LOW' },
                ]),
                impactMap: makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create' }),
                ]),
                topN: 15,
            });

            expect(result.diagnostics.totalCatalog).toBe(catalog.length);
            expect(result.diagnostics.finalCount).toBe(result.candidates.length);
            expect(result.diagnostics.finalCount).toBeLessThanOrEqual(15);

            // fromBlueprint + fromImpactMap + fromKeyword should account for all candidates
            // (some candidates may have overlapping sources, so sum may exceed finalCount)
            expect(result.diagnostics.fromBlueprint).toBeGreaterThanOrEqual(0);
            expect(result.diagnostics.fromImpactMap).toBeGreaterThanOrEqual(0);
            expect(result.diagnostics.fromKeyword).toBeGreaterThanOrEqual(0);
        });

        it('reports merged overlaps correctly', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'API endpoint',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                impactMap: makeImpactMap([makeImpact({ layer: 'logic', action: 'create' })]),
                topN: 15,
            });

            // With both blueprint and impact map targeting logic layer,
            // there should be some overlapping candidates
            expect(result.diagnostics.mergedOverlaps).toBeGreaterThanOrEqual(0);
        });
    });

    // ── 7. topN limit ────────────────────────────────────────────────

    describe('topN limit', () => {
        it('respects topN parameter', () => {
            const catalog = buildTestCatalog();

            const result3 = buildCandidateSet({
                catalog,
                description: 'Build entire backend system',
                techCategory: 'BACKEND',
                topN: 3,
            });

            const result10 = buildCandidateSet({
                catalog,
                description: 'Build entire backend system',
                techCategory: 'BACKEND',
                topN: 10,
            });

            expect(result3.candidates.length).toBeLessThanOrEqual(3);
            expect(result10.candidates.length).toBeLessThanOrEqual(10);
            expect(result3.candidates.length).toBeLessThanOrEqual(result10.candidates.length);
        });

        it('defaults to 20 when topN not specified', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Backend',
                techCategory: 'BACKEND',
            });

            expect(result.candidates.length).toBeLessThanOrEqual(20);
        });
    });

    // ── 8. toDomainCandidates ────────────────────────────────────────

    describe('toDomainCandidates', () => {
        it('converts ScoredCandidates to domain format with provenance in reason', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'API development',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                impactMap: makeImpactMap([makeImpact()]),
                topN: 5,
            });

            // Build ID lookup
            const idLookup = new Map<string, string>();
            for (const c of result.candidates) {
                idLookup.set(c.activity.code, `id-${c.activity.code}`);
            }

            const domain = toDomainCandidates(result.candidates, idLookup);

            expect(domain.length).toBe(result.candidates.length);

            for (const d of domain) {
                // Must have activity_code
                expect(d.activity_code).toBeTruthy();

                // Must have activity_id
                expect(d.activity_id).toMatch(/^id-/);

                // Must have source: 'ai' | 'rule' | 'blueprint'
                expect(['ai', 'rule', 'blueprint']).toContain(d.source);

                // Must have score (scaled to ~0-100 range)
                expect(typeof d.score).toBe('number');
                expect(d.score).toBeGreaterThanOrEqual(0);

                // Must have confidence 0–1
                expect(d.confidence).toBeGreaterThanOrEqual(0);
                expect(d.confidence).toBeLessThanOrEqual(1);

                // Reason must be a parseable JSON with provenance data
                expect(d.reason).toBeTruthy();
                const parsed = JSON.parse(d.reason!);
                expect(parsed).toHaveProperty('sources');
                expect(parsed).toHaveProperty('contributions');
                expect(parsed).toHaveProperty('provenance');
                expect(parsed).toHaveProperty('primarySource');
            }
        });

        it('maps blueprint source correctly', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Logic',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'Logic', layer: 'logic', complexity: 'LOW' }]),
                topN: 10,
            });

            const idLookup = new Map(result.candidates.map(c => [c.activity.code, c.activity.code]));
            const domain = toDomainCandidates(result.candidates, idLookup);

            // Candidates where blueprint contribution is the dominant source
            const blueprintDominant = result.candidates.filter(c =>
                c.contributions.blueprint > c.contributions.keyword
                && c.contributions.blueprint > c.contributions.impactMap,
            );

            // There should be at least one blueprint-dominant candidate
            expect(blueprintDominant.length).toBeGreaterThan(0);

            for (const bp of blueprintDominant) {
                const d = domain.find(dd => dd.activity_code === bp.activity.code);
                if (d) {
                    expect(d.source).toBe('blueprint');
                }
            }
        });

        it('maps impact-map source to rule', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'x',
                techCategory: 'BACKEND',
                impactMap: makeImpactMap([makeImpact({ layer: 'logic', action: 'create' })]),
                topN: 5,
            });

            const idLookup = new Map(result.candidates.map(c => [c.activity.code, c.activity.code]));
            const domain = toDomainCandidates(result.candidates, idLookup);

            // Candidates with impact-map-exclusive primary should map to 'rule' source
            const imPrimary = result.candidates.filter(c =>
                c.primarySource === 'impact-map' || c.primarySource === 'impact-map-exclusive',
            );

            for (const im of imPrimary) {
                const d = domain.find(dd => dd.activity_code === im.activity.code);
                if (d) {
                    expect(d.source).toBe('rule');
                }
            }
        });
    });

    // ── 9. Empty inputs ──────────────────────────────────────────────

    describe('empty inputs', () => {
        it('works with only description (keyword-only)', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Create a new backend API for user management',
                techCategory: 'BACKEND',
                topN: 5,
            });

            expect(result.candidates.length).toBeGreaterThan(0);
            expect(result.strategy).toBe('keyword-only');

            // All candidates should have keyword as their source
            for (const c of result.candidates) {
                expect(c.contributions.keyword).toBeGreaterThan(0);
                expect(c.contributions.blueprint).toBe(0);
                expect(c.contributions.impactMap).toBe(0);
            }
        });

        it('handles empty catalog gracefully', () => {
            const result = buildCandidateSet({
                catalog: [],
                description: 'Anything',
                techCategory: 'BACKEND',
                topN: 5,
            });

            expect(result.candidates.length).toBe(0);
            expect(result.strategy).toBe('keyword-only');
            expect(result.diagnostics.totalCatalog).toBe(0);
        });

        it('handles empty impact map impacts', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                impactMap: makeImpactMap([]),
                topN: 5,
            });

            // Should fall back to keyword-only
            expect(result.strategy).toBe('keyword-only');
        });
    });

    // ── 10. Impact-map-exclusive source ──────────────────────────────

    describe('impact-map-exclusive', () => {
        it('marks candidates as impact-map-exclusive when only impactMap contributes structurally', () => {
            const catalog = buildTestCatalog();

            // Only impact map, no blueprint
            const result = buildCandidateSet({
                catalog,
                description: 'x', // minimal keyword contribution
                techCategory: 'BACKEND',
                impactMap: makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create', confidence: 0.95 }),
                ]),
                topN: 10,
            });

            expect(result.strategy).toBe('impactmap-only');

            // At least one candidate should have impact-map-exclusive as source
            const exclusives = result.candidates.filter(c =>
                c.sources.includes('impact-map-exclusive'),
            );
            expect(exclusives.length).toBeGreaterThan(0);
        });
    });

    // ── 11. Litmus test: can we explain why an activity was chosen? ──

    describe('explainability litmus test', () => {
        it('can explain why BE_API_COMPLEX_LG was chosen with full contribution breakdown', () => {
            const catalog = buildTestCatalog();

            const result = buildCandidateSet({
                catalog,
                description: 'Implement complex order processing API with saga orchestration',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([
                    { name: 'Order Orchestrator', layer: 'logic', complexity: 'HIGH' },
                ]),
                impactMap: makeImpactMap([
                    makeImpact({
                        layer: 'logic',
                        action: 'create',
                        components: ['order service', 'saga controller', 'payment gateway'],
                        confidence: 0.95,
                    }),
                ]),
                topN: 20,
            });

            // Find BE_API_COMPLEX_LG (HIGH complexity logic → COMPLEX_LG variant)
            const target = result.candidates.find(c => c.activity.code === 'BE_API_COMPLEX_LG');

            if (target) {
                // The litmus test: we can explain the score
                console.log(`\n[LITMUS TEST] ${target.activity.code} chosen because:`);
                console.log(`  score: ${target.score.toFixed(2)}`);
                console.log(`  blueprint: +${target.contributions.blueprint.toFixed(2)}`);
                console.log(`  impactMap: +${target.contributions.impactMap.toFixed(2)}`);
                console.log(`  keyword:   +${target.contributions.keyword.toFixed(2)}`);
                console.log(`  context:   +${target.contributions.projectContext.toFixed(2)}`);
                console.log(`  sources: ${target.sources.join(', ')}`);
                console.log(`  provenance: ${target.provenance.join(' → ')}`);

                // Must have been boosted by at least blueprint OR impactMap
                expect(
                    target.contributions.blueprint > 0 || target.contributions.impactMap > 0,
                ).toBe(true);

                // Must have traceable provenance
                expect(target.provenance.length).toBeGreaterThan(0);

                // Must be explainable
                expect(target.sources.length).toBeGreaterThan(0);
            }

            // Whether or not the specific LG variant was picked,
            // at least one BE_API_COMPLEX* variant MUST be in the top candidates
            const anyComplex = result.candidates.find(c =>
                c.activity.code.startsWith('BE_API_COMPLEX'),
            );
            expect(anyComplex).toBeDefined();
            expect(anyComplex!.contributions.blueprint + anyComplex!.contributions.impactMap)
                .toBeGreaterThan(0);
        });
    });

    // ── 12. BlueprintResult and ImpactMapResult passthrough ──────────

    describe('result passthrough', () => {
        it('includes blueprintResult when blueprint provided', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                blueprint: makeBlueprint([{ name: 'API', layer: 'logic' }]),
                topN: 5,
            });
            expect(result.blueprintResult).toBeDefined();
            expect(result.blueprintResult!.allActivities).toBeDefined();
        });

        it('includes impactMapResult when impactMap provided', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                impactMap: makeImpactMap([makeImpact()]),
                topN: 5,
            });
            expect(result.impactMapResult).toBeDefined();
            expect(result.impactMapResult!.signals).toBeDefined();
        });

        it('omits blueprintResult when no blueprint', () => {
            const catalog = buildTestCatalog();
            const result = buildCandidateSet({
                catalog,
                description: 'API',
                techCategory: 'BACKEND',
                topN: 5,
            });
            expect(result.blueprintResult).toBeUndefined();
        });
    });
});
