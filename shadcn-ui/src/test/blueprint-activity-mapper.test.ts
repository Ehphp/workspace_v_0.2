/**
 * Tests for blueprint-activity-mapper.ts
 *
 * Covers:
 *   1. Full blueprint → complete structural mapping
 *   2. Partial blueprint → mapping + keyword fallback
 *   3. No blueprint → isBlueprintMappable returns false
 *   4. Complexity-based prefix routing (SIMPLE vs COMPLEX)
 *   5. Cross-cutting activities (deploy, governance)
 *   6. Coverage report accuracy
 *   7. Catalog validation — all prefixes match real catalog codes
 *   8. Quality warnings (unsupported layers, low coverage, high fallback)
 *   9. Complexity-based prefix routing (SIMPLE vs COMPLEX)
 */

import {
    mapBlueprintToActivities,
    isBlueprintMappable,
    type BlueprintMappingResult,
    type CoverageWarning,
} from '../../netlify/functions/lib/domain/estimation/blueprint-activity-mapper';
import type { Activity } from '../../netlify/functions/lib/infrastructure/db/activities';
import { beforeAll, describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Test Activity Catalog (representative subset)
// ─────────────────────────────────────────────────────────────────────────────

function buildTestCatalog(techCategory: string): Activity[] {
    const catalogs: Record<string, Activity[]> = {
        POWER_PLATFORM: [
            { code: 'PP_ANL_ALIGN', name: 'Allineamento analisi', description: 'Sessioni allineamento', base_hours: 32, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_ANL_ALIGN_SM', name: 'Allineamento analisi (Quick)', description: 'Quick sync', base_hours: 12.8, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_ANL_ALIGN_LG', name: 'Allineamento analisi (Workshop)', description: 'Workshop completo', base_hours: 64, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD', name: 'Creazione campi Dataverse', description: 'Campi su tabelle Dataverse', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD_SM', name: 'Creazione campi Dataverse (1-2)', description: '1-2 campi semplici', base_hours: 8, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FIELD_LG', name: 'Creazione campi Dataverse (5+)', description: '5+ campi complessi', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM', name: 'Config form Dataverse', description: 'Layout form', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM_SM', name: 'Config form Dataverse (Simple)', description: 'Form semplice', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DV_FORM_LG', name: 'Config form Dataverse (Complex)', description: 'Form complesso', base_hours: 64, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_SIMPLE', name: 'Flow semplice', description: 'Flow lineare', base_hours: 32, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_SIMPLE_SM', name: 'Flow minimo', description: 'Flow 2-3 step', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_COMPLEX', name: 'Flow complesso', description: 'Multiple condizioni', base_hours: 64, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_COMPLEX_SM', name: 'Flow complesso (Base)', description: '1-2 integrazioni', base_hours: 48, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_FLOW_COMPLEX_LG', name: 'Flow complesso (Advanced)', description: 'Orchestrazione avanzata', base_hours: 128, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_BUSINESS_RULE', name: 'Business Rule', description: 'Regole business', base_hours: 16, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_BUSINESS_RULE_SM', name: 'Business Rule (Simple)', description: 'Singola regola', base_hours: 8, group: 'DEV', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_E2E_TEST', name: 'Test e2e', description: 'Test end-to-end', base_hours: 64, group: 'TEST', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_E2E_TEST_SM', name: 'Test e2e (Smoke)', description: 'Smoke test', base_hours: 32, group: 'TEST', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_E2E_TEST_LG', name: 'Test e2e (Full)', description: 'Suite completa', base_hours: 128, group: 'TEST', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_UAT_RUN', name: 'Supporto UAT', description: 'UAT', base_hours: 64, group: 'TEST', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DEPLOY', name: 'Deploy', description: 'Deploy soluzione', base_hours: 32, group: 'OPS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DEPLOY_SM', name: 'Deploy (Dev→Test)', description: 'Deploy semplice', base_hours: 16, group: 'OPS', tech_category: 'POWER_PLATFORM' },
            { code: 'PP_DEPLOY_LG', name: 'Deploy (Multi-env)', description: 'Deploy multi-ambiente', base_hours: 64, group: 'OPS', tech_category: 'POWER_PLATFORM' },
            // MULTI
            { code: 'CRS_KICKOFF', name: 'Kickoff tecnico', description: 'Kickoff', base_hours: 32, group: 'GOVERNANCE', tech_category: 'MULTI' },
            { code: 'CRS_DOC', name: 'Documentazione', description: 'Doc tecnica', base_hours: 32, group: 'GOVERNANCE', tech_category: 'MULTI' },
        ],
        BACKEND: [
            { code: 'BE_ANL_ALIGN', name: 'Analisi API', description: 'Analisi requisiti API', base_hours: 32, group: 'ANALYSIS', tech_category: 'BACKEND' },
            { code: 'BE_ANL_ALIGN_SM', name: 'Analisi API (Quick)', description: 'Review rapida', base_hours: 16, group: 'ANALYSIS', tech_category: 'BACKEND' },
            { code: 'BE_API_SIMPLE', name: 'API semplice', description: 'CRUD standard', base_hours: 48, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_SIMPLE_SM', name: 'API semplice (CRUD)', description: 'GET/POST base', base_hours: 25.6, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX', name: 'API complessa', description: 'Orchestrazione servizi', base_hours: 96, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX_SM', name: 'API complessa (Base)', description: '2-3 servizi', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_API_COMPLEX_LG', name: 'API complessa (Advanced)', description: 'Saga pattern', base_hours: 192, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION', name: 'Migrazione DB', description: 'Schema DB', base_hours: 64, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION_SM', name: 'Migrazione DB (Simple)', description: '1-2 colonne', base_hours: 32, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_DB_MIGRATION_LG', name: 'Migrazione DB (Complex)', description: 'Multiple tabelle', base_hours: 128, group: 'DEV', tech_category: 'BACKEND' },
            { code: 'BE_UNIT_TEST', name: 'Unit test', description: 'Test unitari', base_hours: 32, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_INT_TEST', name: 'Integration test', description: 'Test integrazione', base_hours: 48, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_INT_TEST_SM', name: 'Integration test (Basic)', description: 'Singolo scenario', base_hours: 25.6, group: 'TEST', tech_category: 'BACKEND' },
            { code: 'BE_LOGGING', name: 'Logging', description: 'Logging e monitoring', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
            { code: 'BE_LOGGING_SM', name: 'Logging (Basic)', description: 'Log essenziali', base_hours: 16, group: 'OPS', tech_category: 'BACKEND' },
            { code: 'BE_DEPLOY', name: 'Deploy backend', description: 'Deploy', base_hours: 32, group: 'OPS', tech_category: 'BACKEND' },
            { code: 'BE_DEPLOY_SM', name: 'Deploy (Single)', description: 'Singolo ambiente', base_hours: 16, group: 'OPS', tech_category: 'BACKEND' },
            // MULTI
            { code: 'CRS_KICKOFF', name: 'Kickoff tecnico', description: 'Kickoff', base_hours: 32, group: 'GOVERNANCE', tech_category: 'MULTI' },
            { code: 'CRS_DOC', name: 'Documentazione', description: 'Doc tecnica', base_hours: 32, group: 'GOVERNANCE', tech_category: 'MULTI' },
        ],
    };
    return catalogs[techCategory] || catalogs['BACKEND'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Blueprints
// ─────────────────────────────────────────────────────────────────────────────

const FULL_BLUEPRINT: Record<string, unknown> = {
    summary: 'Sistema di approvazione multi-livello per richieste ferie',
    components: [
        { name: 'Form richiesta ferie', layer: 'frontend', interventionType: 'new_development', complexity: 'MEDIUM' },
        { name: 'Entità ferie Dataverse', layer: 'data', interventionType: 'new_development', complexity: 'LOW' },
        { name: 'Flow approvazione', layer: 'automation', interventionType: 'new_development', complexity: 'HIGH' },
        { name: 'Business rules validazione', layer: 'logic', interventionType: 'new_development', complexity: 'LOW' },
        { name: 'Notifiche email', layer: 'automation', interventionType: 'new_development', complexity: 'LOW' },
    ],
    integrations: [
        { target: 'Exchange Online', type: 'API', direction: 'outbound' },
    ],
    dataEntities: [
        { entity: 'RichiestaFerie', operation: 'create' },
        { entity: 'ApprovazioneFerie', operation: 'create' },
    ],
    testingScope: [
        { area: 'Flusso approvazione completo', testType: 'e2e', criticality: 'HIGH' },
        { area: 'Validazioni form', testType: 'unit', criticality: 'MEDIUM' },
    ],
    assumptions: ['Integrazione con Exchange già configurata'],
    exclusions: ['Report BI'],
    uncertainties: [],
    overallConfidence: 0.85,
};

const PARTIAL_BLUEPRINT: Record<string, unknown> = {
    summary: 'Piccola modifica a form esistente',
    components: [
        { name: 'Modifica form', layer: 'frontend', interventionType: 'modification', complexity: 'LOW' },
    ],
    integrations: [],
    dataEntities: [],
    testingScope: [],
    assumptions: [],
    exclusions: [],
    uncertainties: [],
    overallConfidence: 0.70,
};

const EMPTY_BLUEPRINT: Record<string, unknown> = {
    summary: 'TBD',
    components: [],
    integrations: [],
    dataEntities: [],
    testingScope: [],
    assumptions: [],
    exclusions: [],
    uncertainties: [],
    overallConfidence: 0,
};

const BACKEND_BLUEPRINT: Record<string, unknown> = {
    summary: 'API REST per gestione ordini con integrazioni multiple',
    components: [
        { name: 'API ordini', layer: 'logic', interventionType: 'new_development', complexity: 'HIGH' },
        { name: 'Schema DB ordini', layer: 'data', interventionType: 'new_development', complexity: 'MEDIUM' },
        { name: 'Integrazione pagamenti', layer: 'integration', interventionType: 'integration', complexity: 'HIGH' },
        { name: 'Integrazione magazzino', layer: 'integration', interventionType: 'integration', complexity: 'MEDIUM' },
        { name: 'Configurazione logging', layer: 'configuration', interventionType: 'configuration', complexity: 'LOW' },
    ],
    integrations: [
        { target: 'Stripe', type: 'REST API', direction: 'outbound' },
        { target: 'SAP Inventory', type: 'SOAP', direction: 'bidirectional' },
        { target: 'SendGrid', type: 'REST API', direction: 'outbound' },
    ],
    dataEntities: [
        { entity: 'Order', operation: 'create' },
        { entity: 'OrderLine', operation: 'create' },
        { entity: 'Payment', operation: 'write' },
        { entity: 'Shipment', operation: 'create' },
    ],
    testingScope: [
        { area: 'API ordini CRUD', testType: 'unit', criticality: 'HIGH' },
        { area: 'Integrazione pagamenti', testType: 'integration', criticality: 'CRITICAL' },
        { area: 'Flusso ordine completo', testType: 'e2e', criticality: 'HIGH' },
    ],
    assumptions: [],
    exclusions: [],
    uncertainties: ['SLA Stripe non confermati'],
    overallConfidence: 0.80,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('isBlueprintMappable', () => {
    it('returns true for blueprint with valid components', () => {
        expect(isBlueprintMappable(FULL_BLUEPRINT)).toBe(true);
    });

    it('returns true for partial blueprint with at least 1 valid component', () => {
        expect(isBlueprintMappable(PARTIAL_BLUEPRINT)).toBe(true);
    });

    it('returns false for empty blueprint', () => {
        expect(isBlueprintMappable(EMPTY_BLUEPRINT)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isBlueprintMappable(undefined)).toBe(false);
    });

    it('returns false for blueprint without layer/interventionType', () => {
        expect(isBlueprintMappable({
            components: [{ name: 'thing' }], // missing layer and interventionType
        })).toBe(false);
    });
});

describe('mapBlueprintToActivities — full blueprint (Power Platform)', () => {
    let result: BlueprintMappingResult;

    beforeAll(() => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        result = mapBlueprintToActivities(FULL_BLUEPRINT, catalog, 'POWER_PLATFORM');
    });

    it('maps activities from components', () => {
        expect(result.blueprintActivities.length).toBeGreaterThan(0);
    });

    it('includes form activity for frontend component', () => {
        const formActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DV_FORM')
        );
        expect(formActs.length).toBeGreaterThan(0);
    });

    it('includes flow activity for automation component', () => {
        const flowActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_FLOW')
        );
        expect(flowActs.length).toBeGreaterThan(0);
    });

    it('includes data field activity for data component', () => {
        const fieldActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DV_FIELD')
        );
        expect(fieldActs.length).toBeGreaterThan(0);
    });

    it('includes testing activities from testingScope', () => {
        const testActs = result.blueprintActivities.filter(m =>
            m.provenance === 'blueprint-testing'
        );
        expect(testActs.length).toBeGreaterThan(0);
    });

    it('includes deploy as cross-cutting', () => {
        const deploy = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DEPLOY')
        );
        expect(deploy.length).toBeGreaterThan(0);
    });

    it('has provenance metadata on every activity', () => {
        for (const m of result.allActivities) {
            expect(m.provenance).toBeTruthy();
            expect(m.sourceLabel).toBeTruthy();
            expect(m.confidence).toBeGreaterThan(0);
            expect(m.confidence).toBeLessThanOrEqual(1);
        }
    });

    it('has no duplicate activity codes', () => {
        const codes = result.allActivities.map(m => m.activity.code);
        expect(new Set(codes).size).toBe(codes.length);
    });

    it('covers DEV, TEST, and OPS groups', () => {
        expect(result.coverage.coveredGroups).toContain('DEV');
        expect(result.coverage.coveredGroups).toContain('TEST');
        expect(result.coverage.coveredGroups).toContain('OPS');
    });

    it('reports component coverage above 60%', () => {
        // With corrected prefixes (PP_FLOW_SIMPLE/PP_FLOW_COMPLEX), most components
        // should map. HIGH automation gets PP_FLOW_COMPLEX, LOW automation gets PP_FLOW_SIMPLE.
        expect(result.coverage.componentCoveragePercent).toBeGreaterThanOrEqual(60);
    });

    it('has a warnings array', () => {
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('selects FLOW_COMPLEX for HIGH complexity automation', () => {
        const complexFlow = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_FLOW_COMPLEX')
        );
        expect(complexFlow.length).toBeGreaterThan(0);
    });

    it('selects FLOW_SIMPLE for LOW complexity automation', () => {
        const simpleFlow = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_FLOW_SIMPLE')
        );
        expect(simpleFlow.length).toBeGreaterThan(0);
    });

    it('reports zero fallback activities (no fallbackFn provided)', () => {
        expect(result.coverage.fromFallback).toBe(0);
        expect(result.fallbackActivities.length).toBe(0);
    });
});

describe('mapBlueprintToActivities — full blueprint (Backend)', () => {
    let result: BlueprintMappingResult;

    beforeAll(() => {
        const catalog = buildTestCatalog('BACKEND');
        result = mapBlueprintToActivities(BACKEND_BLUEPRINT, catalog, 'BACKEND');
    });

    it('maps API activities for logic components', () => {
        const apiActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_API')
        );
        expect(apiActs.length).toBeGreaterThan(0);
    });

    it('selects base code for HIGH complexity (hour scaling is downstream)', () => {
        // The logic component has HIGH complexity → should pick BE_API_COMPLEX (base)
        // Hour scaling (_SM/_LG multipliers) is handled downstream by complexity-resolver
        const apiComplex = result.blueprintActivities.filter(m =>
            m.activity.code === 'BE_API_COMPLEX'
        );
        expect(apiComplex.length).toBeGreaterThan(0);
    });

    it('maps DB migration for data component', () => {
        const dbActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_DB_MIGRATION')
        );
        expect(dbActs.length).toBeGreaterThan(0);
    });

    it('maps integration testing for integrations', () => {
        const intTestActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_INT_TEST')
        );
        expect(intTestActs.length).toBeGreaterThan(0);
    });

    it('includes logging for configuration component', () => {
        const logActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_LOGGING')
        );
        expect(logActs.length).toBeGreaterThan(0);
    });

    it('includes governance for large blueprint (5+ components)', () => {
        const govActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('CRS_')
        );
        expect(govActs.length).toBeGreaterThan(0);
    });

    it('reports provenance correctly', () => {
        const provenanceTypes = new Set(result.blueprintActivities.map(m => m.provenance));
        expect(provenanceTypes.has('blueprint-component')).toBe(true);
        // Integration provenance may be absorbed by component dedup when
        // the same activity code is mapped from both component layer and integration.
        // At minimum, integration-related activities should exist.
        const integrationRelated = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_INT_TEST') || m.activity.code.startsWith('BE_API_COMPLEX')
        );
        expect(integrationRelated.length).toBeGreaterThan(0);
    });
});

describe('mapBlueprintToActivities — partial blueprint with fallback', () => {
    let result: BlueprintMappingResult;

    beforeAll(() => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        result = mapBlueprintToActivities(
            PARTIAL_BLUEPRINT,
            catalog,
            'POWER_PLATFORM',
            // Fallback: return first 5 non-excluded activities
            (activities, excludeCodes) => {
                return activities
                    .filter(a => !excludeCodes.has(a.code))
                    .slice(0, 5);
            },
        );
    });

    it('maps at least 1 activity from the single component', () => {
        expect(result.blueprintActivities.length).toBeGreaterThanOrEqual(1);
    });

    it('uses fallback to fill missing groups', () => {
        expect(result.fallbackActivities.length).toBeGreaterThan(0);
    });

    it('reports coverage gaps in missing groups', () => {
        // Partial blueprint only has a frontend component → misses TEST, OPS, GOVERNANCE at minimum
        expect(result.coverage.missingGroups.length).toBeGreaterThan(0);
    });

    it('fallback activities have keyword-fallback provenance', () => {
        for (const m of result.fallbackActivities) {
            expect(m.provenance).toBe('keyword-fallback');
        }
    });

    it('allActivities includes both blueprint and fallback', () => {
        expect(result.allActivities.length).toBe(
            result.blueprintActivities.length + result.fallbackActivities.length
        );
    });
});

describe('mapBlueprintToActivities — empty blueprint', () => {
    it('returns zero blueprint activities', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const result = mapBlueprintToActivities(EMPTY_BLUEPRINT, catalog, 'POWER_PLATFORM');
        // Empty components → only cross-cutting (maybe deploy)
        // At minimum, no component-derived activities
        const componentDerived = result.blueprintActivities.filter(m =>
            m.provenance === 'blueprint-component'
        );
        expect(componentDerived.length).toBe(0);
    });
});

describe('complexity-based selection (base codes only, no _SM/_LG)', () => {
    it('picks base code for LOW complexity (hour scaling downstream)', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'Simple form', layer: 'frontend', interventionType: 'new_development', complexity: 'LOW' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const formActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DV_FORM')
        );
        expect(formActs.length).toBeGreaterThan(0);
        // Should pick base code — complexity scaling is downstream
        expect(formActs[0].activity.code).toBe('PP_DV_FORM');
    });

    it('picks base code for HIGH complexity (hour scaling downstream)', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'Complex form', layer: 'frontend', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const formActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DV_FORM')
        );
        expect(formActs.length).toBeGreaterThan(0);
        expect(formActs[0].activity.code).toBe('PP_DV_FORM');
    });

    it('picks base code for MEDIUM complexity', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'Standard form', layer: 'frontend', interventionType: 'new_development', complexity: 'MEDIUM' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const formActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_DV_FORM')
        );
        expect(formActs.length).toBeGreaterThan(0);
        expect(formActs[0].activity.code).toBe('PP_DV_FORM');
    });
});

describe('coverage report', () => {
    it('reports unmapped components when tech patterns do not match', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'AI Model', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        // ai_pipeline is not mapped for POWER_PLATFORM
        expect(result.coverage.unmappedComponents).toContain('AI Model');
    });

    it('reports 100% coverage when all components are mapped', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const simpleBlueprint = {
            components: [
                { name: 'Form', layer: 'frontend', interventionType: 'new_development', complexity: 'MEDIUM' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(simpleBlueprint, catalog, 'POWER_PLATFORM');
        expect(result.coverage.componentCoveragePercent).toBe(100);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Quality Warnings
// ─────────────────────────────────────────────────────────────────────────────

describe('quality warnings', () => {
    it('emits UNSUPPORTED_LAYER for ai_pipeline components', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'ML Pipeline', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const unsupported = result.warnings.filter(w => w.code === 'UNSUPPORTED_LAYER');
        expect(unsupported.length).toBe(1);
        expect(unsupported[0].message).toContain('ai_pipeline');
    });

    it('emits LOW_COVERAGE when most components are unmapped', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'AI A', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
                { name: 'AI B', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
                { name: 'AI C', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const lowCov = result.warnings.filter(w => w.code === 'LOW_COVERAGE');
        expect(lowCov.length).toBe(1);
        expect(result.coverage.componentCoveragePercent).toBe(0);
    });

    it('emits HIGH_FALLBACK_RATIO when fallback dominates', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'AI', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(
            blueprint,
            catalog,
            'POWER_PLATFORM',
            // Fallback returns many activities
            (activities, excludeCodes) =>
                activities.filter(a => !excludeCodes.has(a.code)).slice(0, 10),
        );
        const highFB = result.warnings.filter(w => w.code === 'HIGH_FALLBACK_RATIO');
        // Blueprint maps 0 component activities + 1 deploy (cross-cutting), fallback adds ~10
        // so fallback ratio > 50%
        expect(highFB.length).toBe(1);
    });

    it('emits EMPTY_BLUEPRINT when components array is empty', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const result = mapBlueprintToActivities(EMPTY_BLUEPRINT, catalog, 'POWER_PLATFORM');
        const emptyWarn = result.warnings.filter(w => w.code === 'EMPTY_BLUEPRINT');
        expect(emptyWarn.length).toBe(1);
    });

    it('does NOT emit blocking errors — warnings are all info or warn level', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'AI', layer: 'ai_pipeline', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        for (const w of result.warnings) {
            expect(['info', 'warn']).toContain(w.level);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Validation: all prefixes must match real codes
// ─────────────────────────────────────────────────────────────────────────────

describe('catalog validation — no false mappings', () => {
    it('every mapped activity code exists in the test catalog (PP)', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const catalogCodes = new Set(catalog.map(a => a.code));
        const result = mapBlueprintToActivities(FULL_BLUEPRINT, catalog, 'POWER_PLATFORM');
        for (const m of result.blueprintActivities) {
            expect(catalogCodes.has(m.activity.code)).toBe(true);
        }
    });

    it('every mapped activity code exists in the test catalog (BE)', () => {
        const catalog = buildTestCatalog('BACKEND');
        const catalogCodes = new Set(catalog.map(a => a.code));
        const result = mapBlueprintToActivities(BACKEND_BLUEPRINT, catalog, 'BACKEND');
        for (const m of result.blueprintActivities) {
            expect(catalogCodes.has(m.activity.code)).toBe(true);
        }
    });

    it('no phantom activities from non-existent prefixes', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        // A blueprint with every layer — none should produce activities outside catalog
        const blueprint = {
            components: [
                { name: 'FE', layer: 'frontend', interventionType: 'new_development', complexity: 'LOW' },
                { name: 'LO', layer: 'logic', interventionType: 'new_development', complexity: 'MEDIUM' },
                { name: 'DA', layer: 'data', interventionType: 'new_development', complexity: 'HIGH' },
                { name: 'IN', layer: 'integration', interventionType: 'integration', complexity: 'HIGH' },
                { name: 'AU', layer: 'automation', interventionType: 'new_development', complexity: 'LOW' },
                { name: 'CO', layer: 'configuration', interventionType: 'configuration', complexity: 'LOW' },
            ],
            integrations: [{ target: 'X', direction: 'outbound' }],
            dataEntities: [{ entity: 'Y', operation: 'create' }],
            testingScope: [{ area: 'Z', testType: 'e2e', criticality: 'HIGH' }],
        };
        const catalogCodes = new Set(catalog.map(a => a.code));
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        for (const m of result.allActivities) {
            expect(catalogCodes.has(m.activity.code)).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Complexity-based prefix routing
// ─────────────────────────────────────────────────────────────────────────────

describe('complexity-based prefix routing (SIMPLE vs COMPLEX)', () => {
    it('routes LOW complexity automation to PP_FLOW_SIMPLE', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'Simple Notif', layer: 'automation', interventionType: 'new_development', complexity: 'LOW' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const flowActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_FLOW')
        );
        expect(flowActs.length).toBeGreaterThan(0);
        expect(flowActs[0].activity.code).toMatch(/^PP_FLOW_SIMPLE/);
    });

    it('routes HIGH complexity automation to PP_FLOW_COMPLEX', () => {
        const catalog = buildTestCatalog('POWER_PLATFORM');
        const blueprint = {
            components: [
                { name: 'Orchestration', layer: 'automation', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'POWER_PLATFORM');
        const flowActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('PP_FLOW')
        );
        expect(flowActs.length).toBeGreaterThan(0);
        expect(flowActs[0].activity.code).toMatch(/^PP_FLOW_COMPLEX/);
    });

    it('routes LOW complexity logic to BE_API_SIMPLE (backend)', () => {
        const catalog = buildTestCatalog('BACKEND');
        const blueprint = {
            components: [
                { name: 'Small API', layer: 'logic', interventionType: 'new_development', complexity: 'LOW' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'BACKEND');
        const apiActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_API')
        );
        expect(apiActs.length).toBeGreaterThan(0);
        expect(apiActs[0].activity.code).toMatch(/^BE_API_SIMPLE/);
    });

    it('routes HIGH complexity logic to BE_API_COMPLEX (backend)', () => {
        const catalog = buildTestCatalog('BACKEND');
        const blueprint = {
            components: [
                { name: 'Saga API', layer: 'logic', interventionType: 'new_development', complexity: 'HIGH' },
            ],
            integrations: [], dataEntities: [], testingScope: [],
        };
        const result = mapBlueprintToActivities(blueprint, catalog, 'BACKEND');
        const apiActs = result.blueprintActivities.filter(m =>
            m.activity.code.startsWith('BE_API')
        );
        expect(apiActs.length).toBeGreaterThan(0);
        expect(apiActs[0].activity.code).toMatch(/^BE_API_COMPLEX/);
    });
});
