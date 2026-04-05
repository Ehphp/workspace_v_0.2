/**
 * Tests for impact-map-signal-extractor.ts
 *
 * Covers:
 *   1. Single impact → correct signal extraction with provenance
 *   2. Multiple impacts → deduplication (highest score wins)
 *   3. Action weight gradients (create > modify > configure > read)
 *   4. Component density bonus applied correctly
 *   5. Unsupported layers → unmappedLayers, no crash
 *   6. Empty impact map → empty result
 *   7. Unknown tech category → empty result
 *   8. Complexity routing (SIMPLE vs COMPLEX prefix selection)
 *   9. Every signal has score, sources, contributions, provenance (contract)
 *  10. Score monotonicity: create > modify for same layer
 *  11. All three tech categories produce valid signals
 */

import {
    extractImpactMapSignals,
    type ImpactMapSignal,
    type ImpactMapExtractionResult,
} from '../../netlify/functions/lib/impact-map-signal-extractor';
import type { Activity } from '../../netlify/functions/lib/activities';
import type { ImpactMap, ImpactItem } from '../types/impact-map';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Test Activity Catalog (same pattern as blueprint-activity-mapper.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

function buildTestCatalog(techCategory: string): Activity[] {
    const catalogs: Record<string, Activity[]> = {
        POWER_PLATFORM: [
            { code: 'PP_ANL_ALIGN', name: 'Allineamento analisi', description: 'Sessioni', base_hours: 32, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_ANL_ALIGN_SM', name: 'Allineamento analisi (Quick)', description: 'Quick', base_hours: 12.8, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_ANL_ALIGN_LG', name: 'Allineamento analisi (Workshop)', description: 'Workshop', base_hours: 64, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD', name: 'Creazione campi', description: 'Campi', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD_SM', name: 'Creazione campi (1-2)', description: 'Quick', base_hours: 8, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD_LG', name: 'Creazione campi (5+)', description: 'Complex', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM', name: 'Config form', description: 'Layout', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM_SM', name: 'Config form (Simple)', description: 'Simple', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM_LG', name: 'Config form (Complex)', description: 'Complex', base_hours: 64, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_SIMPLE', name: 'Flow semplice', description: 'Lineare', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_SIMPLE_SM', name: 'Flow minimo', description: '2-3 step', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_COMPLEX', name: 'Flow complesso', description: 'Condizioni', base_hours: 64, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_COMPLEX_LG', name: 'Flow complesso (Advanced)', description: 'Orchestrazione', base_hours: 128, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_BUSINESS_RULE', name: 'Business Rule', description: 'Regole', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_BUSINESS_RULE_SM', name: 'Business Rule (Simple)', description: 'Singola', base_hours: 8, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_E2E_TEST', name: 'Test e2e', description: 'End-to-end', base_hours: 64, group: 'TEST', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DEPLOY', name: 'Deploy', description: 'Deploy', base_hours: 32, group: 'OPS', tech_category: 'POWER_PLATFORM' },
        ],
        BACKEND: [
            { code: 'BE_ANL_ALIGN', name: 'Analisi API', description: 'Analisi', base_hours: 32, group: 'ANALYSIS', tech_category: 'BACKEND' },
            { code: 'BE_ANL_ALIGN_SM', name: 'Analisi API (Quick)', description: 'Review', base_hours: 16, group: 'ANALYSIS', tech_category: 'BACKEND' },
            { code: 'BE_API_SIMPLE', name: 'API semplice', description: 'CRUD', base_hours: 48, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_SIMPLE_SM', name: 'API semplice (CRUD)', description: 'GET/POST', base_hours: 25.6, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX', name: 'API complessa', description: 'Orchestrazione', base_hours: 96, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX_SM', name: 'API complessa (Base)', description: '2-3 servizi', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX_LG', name: 'API complessa (Advanced)', description: 'Saga', base_hours: 192, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION', name: 'Migrazione DB', description: 'Schema', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION_SM', name: 'Migrazione DB (Simple)', description: '1-2 col', base_hours: 32, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION_LG', name: 'Migrazione DB (Complex)', description: 'Multi-table', base_hours: 128, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_UNIT_TEST', name: 'Unit test', description: 'Test', base_hours: 32, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_INT_TEST', name: 'Integration test', description: 'Int test', base_hours: 48, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_INT_TEST_SM', name: 'Integration test (Basic)', description: 'Singolo', base_hours: 25.6, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_LOGGING', name: 'Logging', description: 'Logging', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
            { code: 'BE_LOGGING_SM', name: 'Logging (Basic)', description: 'Essenziali', base_hours: 16, group: 'OPS', tech_category: 'BACKEND' },
            { code: 'BE_DEPLOY', name: 'Deploy backend', description: 'Deploy', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
        ],
        FRONTEND: [
            { code: 'FE_ANL_UX', name: 'Analisi UX', description: 'UX review', base_hours: 32, group: 'ANALYSIS', tech_category: 'FRONTEND' },
            { code: 'FE_UI_COMPONENT', name: 'Component UI', description: 'Componente', base_hours: 48, group: 'DEV', tech_category: 'FRONTEND' },
            { code: 'FE_FORM', name: 'Form', description: 'Form', base_hours: 32, group: 'DEV', tech_category: 'FRONTEND' },
            { code: 'FE_STATE_MGMT', name: 'State management', description: 'State', base_hours: 32, group: 'DEV', tech_category: 'FRONTEND' },
            { code: 'FE_API_INTEGRATION', name: 'API integration', description: 'Integrazione', base_hours: 32, group: 'DEV', tech_category: 'FRONTEND' },
            { code: 'FE_UNIT_TEST', name: 'Unit test', description: 'Unit', base_hours: 32, group: 'TEST', tech_category: 'FRONTEND' },
            { code: 'FE_E2E_TEST', name: 'E2E test', description: 'E2E', base_hours: 48, group: 'TEST', tech_category: 'FRONTEND' },
        ],
    };
    return catalogs[techCategory] || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Impact Map factories
// ─────────────────────────────────────────────────────────────────────────────

function makeImpact(overrides: Partial<ImpactItem> = {}): ImpactItem {
    return {
        layer: 'logic',
        action: 'create',
        components: ['approval service'],
        reason: 'Requirement introduces a new business approval workflow',
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
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ImpactMapSignalExtractor', () => {

    // ── 1. Basic extraction ─────────────────────────────────────────────

    describe('single impact extraction', () => {
        it('extracts signals from a backend logic/create impact', () => {
            const map = makeImpactMap([
                makeImpact({ layer: 'logic', action: 'create', confidence: 0.9 }),
            ]);
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(map, catalog, 'BACKEND');

            expect(result.impactsProcessed).toBe(1);
            expect(result.signalsProduced).toBeGreaterThan(0);
            expect(result.unmappedLayers).toHaveLength(0);

            // Should find BE_API_SIMPLE (create maps to new_development, LOW complexity = 1 component)
            const codes = result.signals.map(s => s.activityCode);
            expect(codes.some(c => c.startsWith('BE_API_SIMPLE') || c.startsWith('BE_ANL_ALIGN'))).toBe(true);
        });

        it('extracts signals from a frontend/create impact', () => {
            const map = makeImpactMap([
                makeImpact({
                    layer: 'frontend',
                    action: 'create',
                    components: ['user dashboard', 'notification panel'],
                    confidence: 0.85,
                }),
            ]);
            const catalog = buildTestCatalog('FRONTEND');
            const result = extractImpactMapSignals(map, catalog, 'FRONTEND');

            expect(result.signalsProduced).toBeGreaterThan(0);
            const codes = result.signals.map(s => s.activityCode);
            // Should find FE_UI_COMPONENT or FE_FORM or FE_ANL_UX
            expect(codes.some(c => c.startsWith('FE_'))).toBe(true);
        });

        it('extracts signals from a data/modify impact', () => {
            const map = makeImpactMap([
                makeImpact({
                    layer: 'data',
                    action: 'modify',
                    components: ['order entity'],
                    confidence: 0.9,
                }),
            ]);
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(map, catalog, 'BACKEND');

            expect(result.signalsProduced).toBeGreaterThan(0);
            const codes = result.signals.map(s => s.activityCode);
            expect(codes.some(c => c.startsWith('BE_DB_MIGRATION'))).toBe(true);
        });
    });

    // ── 2. Provenance contract ──────────────────────────────────────────

    describe('provenance contract', () => {
        it('every signal has score, sources, contributions, provenance', () => {
            const map = makeImpactMap([
                makeImpact({ layer: 'logic', action: 'create', confidence: 0.8 }),
                makeImpact({ layer: 'data', action: 'modify', confidence: 0.7 }),
                makeImpact({ layer: 'integration', action: 'create', confidence: 0.9 }),
            ]);
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(map, catalog, 'BACKEND');

            for (const signal of result.signals) {
                // Score exists and is bounded
                expect(signal.score).toBeGreaterThan(0);
                expect(signal.score).toBeLessThanOrEqual(1.0);

                // Sources is non-empty and contains valid values
                expect(signal.sources.length).toBeGreaterThan(0);
                for (const s of signal.sources) {
                    expect(['impact-map-layer', 'impact-map-action', 'impact-map-components']).toContain(s);
                }

                // Contributions breakdown exists
                expect(signal.contributions).toBeDefined();
                expect(signal.contributions.layerMatch).toBeDefined();
                expect(signal.contributions.actionWeight).toBeDefined();
                expect(signal.contributions.impactConfidence).toBeDefined();
                expect(signal.contributions.componentDensity).toBeDefined();

                // Provenance chain is non-empty and traceable
                expect(signal.provenance.length).toBeGreaterThan(0);
                expect(signal.provenance.some(p => p.startsWith('impact-map:'))).toBe(true);
                expect(signal.provenance.some(p => p.startsWith('action:'))).toBe(true);
                expect(signal.provenance.some(p => p.startsWith('resolved:'))).toBe(true);
            }
        });

        it('provenance contains the actual layer, action, and resolved code', () => {
            const map = makeImpactMap([
                makeImpact({ layer: 'integration', action: 'create', confidence: 0.9 }),
            ]);
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(map, catalog, 'BACKEND');

            expect(result.signals.length).toBeGreaterThan(0);
            const signal = result.signals[0];
            expect(signal.provenance).toContain('impact-map:integration');
            expect(signal.provenance).toContain('action:create');
            expect(signal.provenance.some(p => p.startsWith('resolved:BE_'))).toBe(true);
        });
    });

    // ── 3. Action weight gradients ──────────────────────────────────────

    describe('action weight scoring', () => {
        it('create scores higher than modify for same layer/confidence', () => {
            const catalog = buildTestCatalog('BACKEND');

            const createResult = extractImpactMapSignals(
                makeImpactMap([makeImpact({ layer: 'logic', action: 'create', confidence: 0.9 })]),
                catalog, 'BACKEND',
            );
            const modifyResult = extractImpactMapSignals(
                makeImpactMap([makeImpact({ layer: 'logic', action: 'modify', confidence: 0.9 })]),
                catalog, 'BACKEND',
            );

            // Both should produce signals
            expect(createResult.signals.length).toBeGreaterThan(0);
            expect(modifyResult.signals.length).toBeGreaterThan(0);

            // Max score from create > max score from modify
            const maxCreate = Math.max(...createResult.signals.map(s => s.score));
            const maxModify = Math.max(...modifyResult.signals.map(s => s.score));
            expect(maxCreate).toBeGreaterThan(maxModify);
        });

        it('read produces low but non-zero scores', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact({ layer: 'logic', action: 'read', confidence: 0.9 })]),
                catalog, 'BACKEND',
            );

            // read maps to 'modification'+'configuration' interventions
            // Some patterns may match, some may not
            if (result.signals.length > 0) {
                const maxScore = Math.max(...result.signals.map(s => s.score));
                expect(maxScore).toBeLessThan(0.5);
                expect(result.signals[0].contributions.actionWeight).toBe(0.2);
            }
        });

        it('configure produces moderate scores', () => {
            const catalog = buildTestCatalog('POWER_PLATFORM');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact({ layer: 'configuration', action: 'configure', confidence: 0.85 })]),
                catalog, 'POWER_PLATFORM',
            );

            if (result.signals.length > 0) {
                expect(result.signals[0].contributions.actionWeight).toBe(0.5);
            }
        });
    });

    // ── 4. Component density bonus ──────────────────────────────────────

    describe('component density bonus', () => {
        it('more components increases score', () => {
            const catalog = buildTestCatalog('BACKEND');

            const fewComponents = extractImpactMapSignals(
                makeImpactMap([makeImpact({
                    layer: 'logic', action: 'create', confidence: 0.9,
                    components: ['service A'],
                })]),
                catalog, 'BACKEND',
            );
            const manyComponents = extractImpactMapSignals(
                makeImpactMap([makeImpact({
                    layer: 'logic', action: 'create', confidence: 0.9,
                    components: ['service A', 'service B', 'service C', 'service D'],
                })]),
                catalog, 'BACKEND',
            );

            expect(fewComponents.signals.length).toBeGreaterThan(0);
            expect(manyComponents.signals.length).toBeGreaterThan(0);

            // Find a common code to compare scores
            for (const fewSignal of fewComponents.signals) {
                const manySignal = manyComponents.signals.find(s => s.activityCode === fewSignal.activityCode);
                if (manySignal) {
                    expect(manySignal.contributions.componentDensity)
                        .toBeGreaterThanOrEqual(fewSignal.contributions.componentDensity);
                }
            }
        });

        it('density is capped at 0.3', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact({
                    layer: 'logic', action: 'create', confidence: 0.9,
                    components: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
                })]),
                catalog, 'BACKEND',
            );

            for (const signal of result.signals) {
                expect(signal.contributions.componentDensity).toBeLessThanOrEqual(0.3);
            }
        });
    });

    // ── 5. Deduplication ────────────────────────────────────────────────

    describe('deduplication across impacts', () => {
        it('keeps highest score when same activity appears from multiple impacts', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'modify', confidence: 0.5 }),
                    makeImpact({ layer: 'logic', action: 'create', confidence: 0.95 }),
                ]),
                catalog, 'BACKEND',
            );

            // Check no duplicate codes
            const codes = result.signals.map(s => s.activityCode);
            const uniqueCodes = new Set(codes);
            expect(codes.length).toBe(uniqueCodes.size);

            // The surviving signal should have the higher score
            for (const signal of result.signals) {
                if (signal.activityCode.startsWith('BE_API_SIMPLE') || signal.activityCode.startsWith('BE_ANL_ALIGN')) {
                    // create(1.0) * 0.95 > modify(0.8) * 0.5
                    expect(signal.contributions.actionWeight).toBe(1.0);
                }
            }
        });
    });

    // ── 6. Unsupported layers ───────────────────────────────────────────

    describe('unsupported layers', () => {
        it('ai_pipeline produces no signals and appears in unmappedLayers', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({ layer: 'ai_pipeline' as any, action: 'create', confidence: 0.9 }),
                ]),
                catalog, 'BACKEND',
            );

            expect(result.signalsProduced).toBe(0);
            expect(result.unmappedLayers).toContain('ai_pipeline');
        });

        it('mix of supported and unsupported layers extracts from supported only', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create', confidence: 0.9 }),
                    makeImpact({ layer: 'ai_pipeline' as any, action: 'create', confidence: 0.9 }),
                ]),
                catalog, 'BACKEND',
            );

            expect(result.impactsProcessed).toBe(2);
            expect(result.signalsProduced).toBeGreaterThan(0);
            expect(result.unmappedLayers).toContain('ai_pipeline');
        });
    });

    // ── 7. Edge cases ───────────────────────────────────────────────────

    describe('edge cases', () => {
        it('empty impact map returns empty result', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([]),
                catalog, 'BACKEND',
            );

            expect(result.signals).toHaveLength(0);
            expect(result.impactsProcessed).toBe(0);
            expect(result.signalsProduced).toBe(0);
            expect(result.unmappedLayers).toHaveLength(0);
        });

        it('unknown tech category returns empty result', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact()]),
                catalog, 'UNKNOWN_TECH',
            );

            expect(result.signals).toHaveLength(0);
            expect(result.unmappedLayers).toContain('logic');
        });

        it('empty catalog returns empty signals', () => {
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact()]),
                [],
                'BACKEND',
            );

            expect(result.signals).toHaveLength(0);
        });
    });

    // ── 8. Complexity routing ───────────────────────────────────────────

    describe('complexity routing', () => {
        it('few components (1) selects _SM variant', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact({
                    layer: 'logic', action: 'create', confidence: 0.9,
                    components: ['single service'],
                })]),
                catalog, 'BACKEND',
            );

            // With 1 component (LOW complexity), should get SIMPLE prefix, _SM variant
            const codes = result.signals.map(s => s.activityCode);
            const hasSm = codes.some(c => c.endsWith('_SM'));
            const hasComplex = codes.some(c => c.includes('COMPLEX'));
            // LOW complexity → should NOT have COMPLEX, should prefer _SM
            expect(hasComplex).toBe(false);
            if (codes.length > 0) {
                expect(hasSm || codes.some(c => !c.endsWith('_LG'))).toBe(true);
            }
        });

        it('many components (5+) selects _LG or COMPLEX variant', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([makeImpact({
                    layer: 'logic', action: 'create', confidence: 0.9,
                    components: ['svc A', 'svc B', 'svc C', 'svc D', 'svc E'],
                })]),
                catalog, 'BACKEND',
            );

            // With 5 components (HIGH complexity), should get COMPLEX prefix
            const codes = result.signals.map(s => s.activityCode);
            const hasComplex = codes.some(c => c.includes('COMPLEX'));
            const hasSimple = codes.some(c => c.includes('SIMPLE'));
            expect(hasComplex).toBe(true);
            expect(hasSimple).toBe(false);
        });
    });

    // ── 9. All tech categories ──────────────────────────────────────────

    describe('all tech categories produce valid signals', () => {
        for (const tech of ['POWER_PLATFORM', 'BACKEND', 'FRONTEND']) {
            it(`${tech}: logic/create produces signals`, () => {
                const catalog = buildTestCatalog(tech);
                const impacts = tech === 'FRONTEND'
                    ? [makeImpact({ layer: 'frontend', action: 'create', confidence: 0.85 })]
                    : [makeImpact({ layer: 'logic', action: 'create', confidence: 0.85 })];
                const result = extractImpactMapSignals(makeImpactMap(impacts), catalog, tech);
                expect(result.signalsProduced).toBeGreaterThan(0);
            });
        }
    });

    // ── 10. Score sorting ───────────────────────────────────────────────

    describe('result ordering', () => {
        it('signals are sorted by score descending', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create', confidence: 0.9 }),
                    makeImpact({ layer: 'data', action: 'modify', confidence: 0.6 }),
                    makeImpact({ layer: 'integration', action: 'create', confidence: 0.95 }),
                ]),
                catalog, 'BACKEND',
            );

            for (let i = 1; i < result.signals.length; i++) {
                expect(result.signals[i].score).toBeLessThanOrEqual(result.signals[i - 1].score);
            }
        });
    });

    // ── 11. Multi-layer realistic scenario ──────────────────────────────

    describe('realistic multi-layer scenario', () => {
        it('BACKEND: order management requirement produces expected signals', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({
                        layer: 'logic',
                        action: 'create',
                        components: ['order service', 'validation engine'],
                        reason: 'New order creation workflow with multi-step validation',
                        confidence: 0.9,
                    }),
                    makeImpact({
                        layer: 'data',
                        action: 'create',
                        components: ['orders table', 'order_items table', 'order_status enum'],
                        reason: 'New data entities for order management',
                        confidence: 0.95,
                    }),
                    makeImpact({
                        layer: 'integration',
                        action: 'create',
                        components: ['payment gateway connector', 'email notification service'],
                        reason: 'External payment and notification integrations',
                        confidence: 0.85,
                    }),
                ]),
                catalog, 'BACKEND',
            );

            expect(result.impactsProcessed).toBe(3);
            expect(result.signalsProduced).toBeGreaterThan(0);
            expect(result.unmappedLayers).toHaveLength(0);

            const codes = result.signals.map(s => s.activityCode);

            // Should include API, DB migration, and integration test activities
            expect(codes.some(c => c.startsWith('BE_API'))).toBe(true);
            expect(codes.some(c => c.startsWith('BE_DB_MIGRATION'))).toBe(true);

            // Every signal has full provenance
            for (const signal of result.signals) {
                expect(signal.provenance.length).toBeGreaterThanOrEqual(4);
                expect(signal.score).toBeGreaterThan(0);
                expect(signal.sources.length).toBeGreaterThan(0);
            }
        });

        it('POWER_PLATFORM: approval workflow produces expected signals', () => {
            const catalog = buildTestCatalog('POWER_PLATFORM');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({
                        layer: 'frontend',
                        action: 'create',
                        components: ['approval request form', 'approval status dashboard'],
                        reason: 'Users need to submit and track approval requests',
                        confidence: 0.9,
                    }),
                    makeImpact({
                        layer: 'automation',
                        action: 'create',
                        components: ['approval routing flow', 'escalation timer', 'notification dispatcher'],
                        reason: 'Multi-level approval with automatic escalation',
                        confidence: 0.85,
                    }),
                ]),
                catalog, 'POWER_PLATFORM',
            );

            const codes = result.signals.map(s => s.activityCode);

            // Frontend → should have form/field/analysis activities
            expect(codes.some(c => c.startsWith('PP_DV_FORM') || c.startsWith('PP_DV_FIELD') || c.startsWith('PP_ANL_ALIGN'))).toBe(true);

            // Automation with 3 components (MEDIUM) → should have flow activity
            expect(codes.some(c => c.startsWith('PP_FLOW'))).toBe(true);
        });
    });

    // ── 12. Score bounds ────────────────────────────────────────────────

    describe('score bounds', () => {
        it('scores are always between 0 and 1', () => {
            const catalog = buildTestCatalog('BACKEND');
            const result = extractImpactMapSignals(
                makeImpactMap([
                    makeImpact({ layer: 'logic', action: 'create', confidence: 1.0, components: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
                ]),
                catalog, 'BACKEND',
            );

            for (const signal of result.signals) {
                expect(signal.score).toBeGreaterThanOrEqual(0);
                expect(signal.score).toBeLessThanOrEqual(1.0);
            }
        });
    });
});
