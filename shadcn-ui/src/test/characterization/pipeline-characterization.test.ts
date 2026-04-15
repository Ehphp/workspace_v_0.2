/**
 * Pipeline Characterization Tests — Phase 0 Safety Net
 *
 * Questi test NON verificano la "correttezza" della stima: verificano la
 * STABILITÀ del pipeline deterministico. Qualsiasi modifica al comportamento
 * (ordine candidati, activity codes selezionate, score relativi) causerà un
 * fail qui, richiedendo una revisione esplicita e un aggiornamento snapshot.
 *
 * Come aggiornare gli snapshot dopo una modifica intenzionale:
 *   pnpm test:run -- --update-snapshots
 *
 * Le tre fixture coprono le 3 "shape" principali del pipeline:
 *   A) Keyword-only  — nessun artefatto strutturale disponibile (fallback)
 *   B) Blueprint + Understanding — artefatti pre-save disponibili
 *   C) Full pipeline — tutte e 6 le sorgenti di signal attive
 */

import { describe, it, expect } from 'vitest';
import {
    synthesizeCandidates,
} from '../../../netlify/functions/lib/domain/pipeline/candidate-synthesizer';
import { runDecisionEngine } from '../../../netlify/functions/lib/domain/pipeline/decision-engine';
import type { Activity } from '../../../netlify/functions/lib/activities';
import type {
    NormalizedSignal,
    SignalSet,
} from '../../../netlify/functions/lib/domain/pipeline/signal-types';

// ─────────────────────────────────────────────────────────────────────────────
// Activity Catalog Fixture
// Codici che coprono tutti e 6 i layer (frontend, logic, data, integration,
// automation, configuration) per tech category BACKEND.
// ─────────────────────────────────────────────────────────────────────────────

function buildCatalog(): Activity[] {
    return [
        // ANALYSIS
        { code: 'BE_ANL_ALIGN',      name: 'Analisi API',             description: 'Analisi requisiti backend',    base_hours: 32,   group: 'ANALYSIS', tech_category: 'BACKEND' },
        { code: 'BE_ANL_ALIGN_SM',   name: 'Analisi API (Quick)',      description: 'Review rapida',               base_hours: 16,   group: 'ANALYSIS', tech_category: 'BACKEND' },

        // LOGIC layer — API
        { code: 'BE_API_SIMPLE',     name: 'API semplice',            description: 'CRUD endpoint',               base_hours: 48,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_API_SIMPLE_SM',  name: 'API semplice (CRUD)',     description: 'Singolo GET/POST',            base_hours: 25.6, group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX',    name: 'API complessa',           description: 'Orchestrazione servizi',      base_hours: 96,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX_SM', name: 'API complessa (Base)',    description: '2-3 servizi',                 base_hours: 64,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_API_COMPLEX_LG', name: 'API complessa (Advanced)',description: 'Saga pattern',               base_hours: 192,  group: 'DEV',      tech_category: 'BACKEND' },

        // DATA layer — DB
        { code: 'BE_DB_MIGRATION',    name: 'Migrazione DB',          description: 'Schema migration',            base_hours: 64,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_DB_MIGRATION_SM', name: 'Migrazione DB (Simple)', description: '1-2 colonne',                 base_hours: 32,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_DB_MIGRATION_LG', name: 'Migrazione DB (Complex)',description: 'Multi-table FK',             base_hours: 128,  group: 'DEV',      tech_category: 'BACKEND' },

        // INTEGRATION layer
        { code: 'BE_INT_WEBHOOK',    name: 'Webhook integration',     description: 'Inbound webhook',            base_hours: 32,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_INT_EXTAPI',     name: 'External API call',       description: 'HTTP client verso terze parti',base_hours: 40,  group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_INT_QUEUE',      name: 'Queue integration',       description: 'Async message queue',        base_hours: 48,   group: 'DEV',      tech_category: 'BACKEND' },

        // TEST layer
        { code: 'BE_UNIT_TEST',      name: 'Unit test',               description: 'Test unitari backend',        base_hours: 32,   group: 'TEST',     tech_category: 'BACKEND' },
        { code: 'BE_INT_TEST',       name: 'Integration test',        description: 'Test integrazione',          base_hours: 48,   group: 'TEST',     tech_category: 'BACKEND' },
        { code: 'BE_INT_TEST_SM',    name: 'Integration test (Basic)',description: 'Singolo endpoint',           base_hours: 25.6, group: 'TEST',     tech_category: 'BACKEND' },
        { code: 'BE_E2E_TEST',       name: 'E2E test',                description: 'End-to-end',                 base_hours: 64,   group: 'TEST',     tech_category: 'BACKEND' },

        // OPS / CONFIGURATION layer
        { code: 'BE_LOGGING',        name: 'Logging',                 description: 'Logging strutturato',         base_hours: 32,   group: 'OPS',      tech_category: 'BACKEND' },
        { code: 'BE_LOGGING_SM',     name: 'Logging (Basic)',         description: 'Log essenziali',              base_hours: 16,   group: 'OPS',      tech_category: 'BACKEND' },
        { code: 'BE_DEPLOY',         name: 'Deploy backend',          description: 'Deploy CI/CD',               base_hours: 32,   group: 'OPS',      tech_category: 'BACKEND' },
        { code: 'BE_ENV_CONFIG',     name: 'Environment config',      description: 'Env vars e secrets',         base_hours: 8,    group: 'OPS',      tech_category: 'BACKEND' },

        // AUTOMATION layer
        { code: 'BE_CRON_JOB',       name: 'Cron job',                description: 'Job schedulato',             base_hours: 24,   group: 'DEV',      tech_category: 'BACKEND' },
        { code: 'BE_PIPELINE_CI',    name: 'CI pipeline',             description: 'Build & test pipeline',      base_hours: 16,   group: 'OPS',      tech_category: 'BACKEND' },

        // FRONTEND-like (some multi-category catalogs have these)
        { code: 'FE_ANL_ALIGN',      name: 'Analisi UI',              description: 'Analisi UI/UX',              base_hours: 24,   group: 'ANALYSIS', tech_category: 'FRONTEND' },
        { code: 'FE_UI_FORM',        name: 'Form UI',                 description: 'Form con validazione',       base_hours: 40,   group: 'DEV',      tech_category: 'FRONTEND' },
        { code: 'FE_UI_LIST',        name: 'List view',               description: 'Tabella/lista dati',         base_hours: 32,   group: 'DEV',      tech_category: 'FRONTEND' },
        { code: 'FE_UI_DASHBOARD',   name: 'Dashboard',               description: 'Dashboard con charts',      base_hours: 64,   group: 'DEV',      tech_category: 'FRONTEND' },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Factory Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeKeywordSignal(
    activityCode: string,
    score: number,
    layer?: NormalizedSignal['layer'],
): NormalizedSignal {
    return {
        activityCode,
        score,
        kind: 'keyword-match',
        source: 'keyword',
        confidence: 0.6,
        contributions: { keywordMatch: score },
        provenance: [`keyword match → ${activityCode}`],
        layer,
    };
}

function makeBlueprintSignal(
    activityCode: string,
    score: number,
    componentName: string,
    layer: NormalizedSignal['layer'],
): NormalizedSignal {
    return {
        activityCode,
        score,
        kind: 'blueprint-component',
        source: 'blueprint',
        confidence: 0.85,
        contributions: { componentMatch: score * 0.8, interventionBonus: score * 0.2 },
        provenance: [`blueprint[${componentName}] → ${activityCode}`],
        layer,
    };
}

function makeUnderstandingSignal(
    activityCode: string,
    score: number,
    term: string,
    layer: NormalizedSignal['layer'],
): NormalizedSignal {
    return {
        activityCode,
        score,
        kind: 'understanding-perimeter',
        source: 'understanding',
        confidence: 0.7,
        contributions: { perimeterMatch: score },
        provenance: [`understanding[${term}] → ${activityCode}`],
        layer,
    };
}

function makeImpactMapSignal(
    activityCode: string,
    score: number,
    layer: NormalizedSignal['layer'],
): NormalizedSignal {
    return {
        activityCode,
        score,
        kind: 'impact-map-layer',
        source: 'impact-map',
        confidence: 0.75,
        contributions: { layerMatch: score },
        provenance: [`impact-map[${layer}] → ${activityCode}`],
        layer,
    };
}

function makeProjectActivitySignal(
    activityCode: string,
    score: number,
    layer: NormalizedSignal['layer'],
): NormalizedSignal {
    return {
        activityCode,
        score,
        kind: 'project-activity-match',
        source: 'project-activity',
        confidence: 0.9,
        contributions: { projectMatch: score },
        provenance: [`project-activity → ${activityCode}`],
        layer,
    };
}

function makeSignalSet(
    source: SignalSet['source'],
    signals: NormalizedSignal[],
): SignalSet {
    return {
        source,
        signals,
        diagnostics: { processed: signals.length, produced: signals.length, unmapped: [] },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario A — Keyword-only
// Simula: nessun blueprint, nessuna understanding, nessuna impact map.
// Fallback puro su keyword ranking.
// Requirement: "Create a REST API with CRUD for user management, with logging"
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario A — Keyword-only pipeline', () => {
    const catalog = buildCatalog();
    const description = 'Create a REST API with CRUD for user management, with logging';

    const keywordSignalSet = makeSignalSet('keyword', [
        makeKeywordSignal('BE_ANL_ALIGN_SM', 0.9, 'logic'),
        makeKeywordSignal('BE_API_SIMPLE',    0.8, 'logic'),
        makeKeywordSignal('BE_DB_MIGRATION_SM', 0.6, 'data'),
        makeKeywordSignal('BE_UNIT_TEST',     0.5, 'logic'),
        makeKeywordSignal('BE_LOGGING_SM',    0.45, 'configuration'),
        makeKeywordSignal('BE_DEPLOY',        0.3, 'configuration'),
    ]);

    it('synthesizer — candidate order and scores match snapshot', () => {
        const result = synthesizeCandidates({
            signalSets: [keywordSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        // Snapshot: top codes in order + scores
        const snapshot = result.candidates.map(c => ({
            code: c.activity.code,
            score: c.score,
            primarySource: c.primarySource,
        }));
        expect(snapshot).toMatchSnapshot();
    });

    it('synthesizer — strategy is keyword-based', () => {
        const result = synthesizeCandidates({
            signalSets: [keywordSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });
        expect(result.strategy).toMatchSnapshot();
    });

    it('decision engine — selected codes match snapshot', () => {
        const synthesized = synthesizeCandidates({
            signalSets: [keywordSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description,
        });

        const selected = decision.selectedCandidates.map(c => c.activity.code);
        expect(selected).toMatchSnapshot();
        expect(decision.confidence).toMatchSnapshot();
    });

    it('decision engine — trace phases match snapshot', () => {
        const synthesized = synthesizeCandidates({
            signalSets: [keywordSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description,
        });

        // Snapshot: quali fasi hanno incluso/escluso activities e perché
        const phaseHits = decision.decisionTrace.map(t => ({
            step: t.step,
            action: t.action,
            code: t.code,
            reason: t.reason,
        }));
        expect(phaseHits).toMatchSnapshot();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario B — Blueprint + Understanding (nessun project-activity, nessuna impact-map)
// Simula: progetto senza blueprint approvato ancora, understanding generata.
// Requirement: "Implementare API per creazione ordini con validazione e persistenza su DB"
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario B — Blueprint + Understanding', () => {
    const catalog = buildCatalog();
    const description = 'Implementare API per creazione ordini con validazione e persistenza su DB';

    const blueprintSignalSet = makeSignalSet('blueprint', [
        makeBlueprintSignal('BE_ANL_ALIGN',      0.9, 'OrderService',  'logic'),
        makeBlueprintSignal('BE_API_COMPLEX_SM', 0.85, 'OrderService', 'logic'),
        makeBlueprintSignal('BE_DB_MIGRATION',   0.8,  'OrdersTable',  'data'),
        makeBlueprintSignal('BE_UNIT_TEST',      0.6,  'OrderService', 'logic'),
        makeBlueprintSignal('BE_INT_TEST_SM',    0.55, 'OrdersTable',  'data'),
        makeBlueprintSignal('BE_LOGGING',        0.4,  'OrderService', 'configuration'),
    ]);

    const understandingSignalSet = makeSignalSet('understanding', [
        makeUnderstandingSignal('BE_ANL_ALIGN',      0.8, 'order validation',  'logic'),
        makeUnderstandingSignal('BE_API_SIMPLE',     0.6, 'api endpoint',      'logic'),
        makeUnderstandingSignal('BE_DB_MIGRATION_SM',0.7, 'database write',    'data'),
        makeUnderstandingSignal('BE_UNIT_TEST',      0.5, 'validation logic',  'logic'),
        makeUnderstandingSignal('BE_DEPLOY',         0.3, 'deployment',        'configuration'),
    ]);

    it('synthesizer — blueprint contribution outweighs understanding for shared activities', () => {
        const result = synthesizeCandidates({
            signalSets: [blueprintSignalSet, understandingSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        // BE_ANL_ALIGN è in entrambi i signal set.
        // Blueprint score: 3.0 × 0.9 = 2.7 | Understanding score: 1.5 × 0.8 = 1.2
        // Il contributo blueprint deve essere il dominante nel breakdown.
        const analisi = result.candidates.find(c => c.activity.code === 'BE_ANL_ALIGN');
        expect(analisi).toBeDefined();
        expect(analisi!.contributions.blueprint).toBeGreaterThan(
            analisi!.contributions.understanding ?? 0,
        );
    });

    it('synthesizer — candidate order and scores match snapshot', () => {
        const result = synthesizeCandidates({
            signalSets: [blueprintSignalSet, understandingSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const snapshot = result.candidates.map(c => ({
            code: c.activity.code,
            score: c.score,
            primarySource: c.primarySource,
        }));
        expect(snapshot).toMatchSnapshot();
    });

    it('synthesizer — signal summary matches snapshot', () => {
        const result = synthesizeCandidates({
            signalSets: [blueprintSignalSet, understandingSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });
        expect(result.signalSummary).toMatchSnapshot();
    });

    it('decision engine — selected codes match snapshot', () => {
        const synthesized = synthesizeCandidates({
            signalSets: [blueprintSignalSet, understandingSignalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {
                complexity: { questionId: 'complexity', category: 'technical', value: 'MEDIUM' },
            },
            techCategory: 'BACKEND',
            catalog,
            description,
        });

        expect(decision.selectedCandidates.map(c => c.activity.code)).toMatchSnapshot();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario C — Full pipeline (tutte e 6 le sorgenti)
// Simula: progetto con blueprint approvato, understanding, impact map,
// keyword hints, project activities calibrate, e project context.
// Requirement: "Integrare sistema esterno di pagamento con webhook callback,
//               persistenza transazioni, e notifiche async"
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario C — Full pipeline (all 6 sources)', () => {
    const catalog = buildCatalog();
    const description =
        'Integrare sistema esterno di pagamento con webhook callback, persistenza transazioni, e notifiche async';

    const blueprintSignalSet = makeSignalSet('blueprint', [
        makeBlueprintSignal('BE_INT_WEBHOOK',    0.95, 'PaymentGatewayIntegration', 'integration'),
        makeBlueprintSignal('BE_INT_EXTAPI',     0.9,  'PaymentGatewayIntegration', 'integration'),
        makeBlueprintSignal('BE_DB_MIGRATION',   0.8,  'TransactionsTable',         'data'),
        makeBlueprintSignal('BE_API_COMPLEX_SM', 0.7,  'PaymentService',            'logic'),
        makeBlueprintSignal('BE_INT_TEST',       0.6,  'PaymentGatewayIntegration', 'integration'),
        makeBlueprintSignal('BE_LOGGING',        0.5,  'PaymentService',            'configuration'),
    ]);

    const impactMapSignalSet = makeSignalSet('impact-map', [
        makeImpactMapSignal('BE_INT_WEBHOOK',    0.9,  'integration'),
        makeImpactMapSignal('BE_INT_QUEUE',      0.8,  'automation'),
        makeImpactMapSignal('BE_DB_MIGRATION',   0.7,  'data'),
        makeImpactMapSignal('BE_API_COMPLEX_SM', 0.6,  'logic'),
        makeImpactMapSignal('BE_INT_TEST',       0.5,  'integration'),
    ]);

    const understandingSignalSet = makeSignalSet('understanding', [
        makeUnderstandingSignal('BE_INT_WEBHOOK',    0.85, 'webhook callback',     'integration'),
        makeUnderstandingSignal('BE_INT_EXTAPI',     0.75, 'external payment api', 'integration'),
        makeUnderstandingSignal('BE_DB_MIGRATION',   0.65, 'transaction storage',  'data'),
        makeUnderstandingSignal('BE_API_COMPLEX_SM', 0.55, 'payment processing',   'logic'),
        makeUnderstandingSignal('BE_CRON_JOB',       0.4,  'async notification',   'automation'),
    ]);

    const keywordSignalSet = makeSignalSet('keyword', [
        makeKeywordSignal('BE_ANL_ALIGN_SM', 0.5, 'logic'),
        makeKeywordSignal('BE_INT_WEBHOOK',  0.4, 'integration'),
        makeKeywordSignal('BE_UNIT_TEST',    0.35, 'logic'),
    ]);

    // Project activities calibrate (peso 4.0 — dominano sulle altre)
    const projectActivitySignalSet = makeSignalSet('project-activity', [
        makeProjectActivitySignal('BE_INT_WEBHOOK',    1.0, 'integration'),
        makeProjectActivitySignal('BE_DB_MIGRATION_SM',0.9, 'data'),
        makeProjectActivitySignal('BE_INT_QUEUE',      0.8, 'automation'),
        makeProjectActivitySignal('BE_API_COMPLEX_SM', 0.7, 'logic'),
        makeProjectActivitySignal('BE_LOGGING',        0.6, 'configuration'),
    ]);

    // Context signal (peso 0.5 — low boost)
    const contextSignalSet = makeSignalSet('context', [
        {
            activityCode: 'BE_ENV_CONFIG',
            score: 0.7,
            kind: 'project-context',
            source: 'context',
            confidence: 0.5,
            contributions: { contextBoost: 0.7 },
            provenance: ['context[BACKEND] → BE_ENV_CONFIG'],
            layer: 'configuration' as const,
        },
    ]);

    it('synthesizer — project-activity signals dominate (weight 4.0)', () => {
        const result = synthesizeCandidates({
            signalSets: [
                blueprintSignalSet,
                impactMapSignalSet,
                understandingSignalSet,
                keywordSignalSet,
                projectActivitySignalSet,
                contextSignalSet,
            ],
            catalog,
            techCategory: 'BACKEND',
        });

        // BE_INT_WEBHOOK ha segnali da 5 fonti, project-activity inclusa (peso 4.0)
        const webhookCandidate = result.candidates.find(
            c => c.activity.code === 'BE_INT_WEBHOOK',
        );
        expect(webhookCandidate).toBeDefined();

        // Deve essere in cima o quasi per via del project-activity signal
        const topCodes = result.candidates.slice(0, 3).map(c => c.activity.code);
        expect(topCodes).toContain('BE_INT_WEBHOOK');
    });

    it('synthesizer — full candidate scores match snapshot', () => {
        const result = synthesizeCandidates({
            signalSets: [
                blueprintSignalSet,
                impactMapSignalSet,
                understandingSignalSet,
                keywordSignalSet,
                projectActivitySignalSet,
                contextSignalSet,
            ],
            catalog,
            techCategory: 'BACKEND',
        });

        const snapshot = result.candidates.map(c => ({
            code: c.activity.code,
            score: c.score,
            primarySource: c.primarySource,
            sourceCount: c.sources.length,
        }));
        expect(snapshot).toMatchSnapshot();
    });

    it('synthesizer — layer coverage matches snapshot', () => {
        const result = synthesizeCandidates({
            signalSets: [
                blueprintSignalSet,
                impactMapSignalSet,
                understandingSignalSet,
                keywordSignalSet,
                projectActivitySignalSet,
                contextSignalSet,
            ],
            catalog,
            techCategory: 'BACKEND',
        });

        // Serializza solo i campi stabili (evita oggetti con funzioni o Date)
        const coverageSnapshot = Object.fromEntries(
            Object.entries(result.layerCoverage).map(([layer, info]) => [
                layer,
                { covered: info.covered, count: info.count, priority: info.priority },
            ]),
        );
        expect(coverageSnapshot).toMatchSnapshot();
        expect(result.gaps).toMatchSnapshot();
    });

    it('decision engine — full pipeline selection matches snapshot', () => {
        const synthesized = synthesizeCandidates({
            signalSets: [
                blueprintSignalSet,
                impactMapSignalSet,
                understandingSignalSet,
                keywordSignalSet,
                projectActivitySignalSet,
                contextSignalSet,
            ],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {
                complexity: { questionId: 'complexity', category: 'technical', value: 'HIGH' },
                integration: { questionId: 'integration', category: 'technical', value: 'webhook,external-api' },
            },
            techCategory: 'BACKEND',
            catalog,
            description,
        });

        expect(decision.selectedCandidates.map(c => c.activity.code)).toMatchSnapshot();
        expect(decision.confidence).toMatchSnapshot();
    });

    it('decision engine — no duplicate activity codes in selection', () => {
        const synthesized = synthesizeCandidates({
            signalSets: [
                blueprintSignalSet,
                impactMapSignalSet,
                understandingSignalSet,
                keywordSignalSet,
                projectActivitySignalSet,
                contextSignalSet,
            ],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description,
        });

        const codes = decision.selectedCandidates.map(c => c.activity.code);
        const unique = new Set(codes);
        expect(unique.size).toBe(codes.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invarianti cross-scenario
// Queste proprietà devono valere in tutti gli scenari — non cambiano mai.
// ─────────────────────────────────────────────────────────────────────────────

describe('Pipeline invariants (cross-scenario)', () => {
    const catalog = buildCatalog();

    it('synthesizer — candidates always sorted by score descending', () => {
        const signalSet = makeSignalSet('keyword', [
            makeKeywordSignal('BE_API_SIMPLE',  0.9, 'logic'),
            makeKeywordSignal('BE_API_COMPLEX', 0.5, 'logic'),
            makeKeywordSignal('BE_UNIT_TEST',   0.7, 'logic'),
        ]);

        const result = synthesizeCandidates({
            signalSets: [signalSet],
            catalog,
            techCategory: 'BACKEND',
        });

        for (let i = 1; i < result.candidates.length; i++) {
            expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(
                result.candidates[i].score,
            );
        }
    });

    it('synthesizer — blueprint contribution is stored separately from keyword', () => {
        // Il scoring usa media pesata normalizzata (weightedSum / weightTotal).
        // Un segnale blueprint al 70% non supera necessariamente un keyword al 90%
        // perché vengono normalizzati per i pesi presenti.
        // Quello che garantiamo: le contributions sono salvate per source correttamente.
        const bpSet = makeSignalSet('blueprint', [
            makeBlueprintSignal('BE_API_SIMPLE', 0.7, 'Service', 'logic'),
        ]);
        const kwSet = makeSignalSet('keyword', [
            makeKeywordSignal('BE_API_SIMPLE', 0.5, 'logic'),
        ]);

        const result = synthesizeCandidates({
            signalSets: [bpSet, kwSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const apiSimple = result.candidates.find(c => c.activity.code === 'BE_API_SIMPLE');
        expect(apiSimple).toBeDefined();

        // Blueprint contribution = 0.7 (best blueprint score)
        expect(apiSimple!.contributions.blueprint).toBeCloseTo(0.7, 5);
        // Keyword contribution = 0.5 (best keyword score)
        expect(apiSimple!.contributions.keyword).toBeCloseTo(0.5, 5);

        // Score = (3.0×0.7 + 1.0×0.5) / (3.0 + 1.0) = 2.6/4.0 = 0.65
        expect(apiSimple!.score).toBeCloseTo(0.65, 5);
    });

    it('synthesizer — every candidate has non-empty provenance', () => {
        const kwSet = makeSignalSet('keyword', [
            makeKeywordSignal('BE_API_SIMPLE', 0.7, 'logic'),
            makeKeywordSignal('BE_DB_MIGRATION', 0.5, 'data'),
        ]);

        const result = synthesizeCandidates({
            signalSets: [kwSet],
            catalog,
            techCategory: 'BACKEND',
        });

        for (const candidate of result.candidates) {
            expect(candidate.provenance.length).toBeGreaterThan(0);
        }
    });

    it('decision engine — respects maxSelected cap', () => {
        // Inietta 15 segnali keyword con score alti
        const signals: NormalizedSignal[] = catalog.slice(0, 15).map((a, i) =>
            makeKeywordSignal(a.code, 1.0 - i * 0.05, 'logic'),
        );
        const kwSet = makeSignalSet('keyword', signals);

        const synthesized = synthesizeCandidates({
            signalSets: [kwSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const decision = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description: 'generic requirement',
            config: { maxSelected: 5 },
        });

        expect(decision.selectedCandidates.length).toBeLessThanOrEqual(5);
    });

    it('decision engine — result is deterministic (same input = same output)', () => {
        const kwSet = makeSignalSet('keyword', [
            makeKeywordSignal('BE_API_COMPLEX', 0.9, 'logic'),
            makeKeywordSignal('BE_DB_MIGRATION', 0.7, 'data'),
            makeKeywordSignal('BE_INT_TEST', 0.5, 'logic'),
        ]);

        const synthesized = synthesizeCandidates({
            signalSets: [kwSet],
            catalog,
            techCategory: 'BACKEND',
        });

        const run1 = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description: 'REST API with database',
        });

        const run2 = runDecisionEngine({
            candidates: synthesized.candidates,
            answers: {},
            techCategory: 'BACKEND',
            catalog,
            description: 'REST API with database',
        });

        expect(run1.selectedCandidates.map(c => c.activity.code)).toEqual(
            run2.selectedCandidates.map(c => c.activity.code),
        );
    });
});
