/**
 * Tests for normalize-blueprint.ts
 *
 * Covers:
 *   a. Component with type 'integration' → reclassified to integrations
 *   b. Component with known external name (Outlook, SAP, Stripe) → reclassified
 *   c. Same entity in components + integrations → cross-category dedup
 *   d. Duplicate names within components → within-category dedup
 *   e. Generic/useless names → removed
 *   f. Structural warnings when dataDomains/integrations are empty
 *   g. Idempotency → applying twice yields same result
 *   h. Extra fields (summary, architecturalNotes, confidence) preserved
 */

import {
    normalizeProjectTechnicalBlueprint,
    type RawBlueprint,
} from '../../netlify/functions/lib/ai/post-processing/normalize-blueprint';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBlueprint(overrides: Partial<RawBlueprint> = {}): RawBlueprint {
    return {
        summary: 'Test blueprint summary',
        components: [],
        dataDomains: [],
        integrations: [],
        architecturalNotes: ['Microservices architecture'],
        assumptions: ['Team of 5'],
        missingInformation: ['Deployment target unclear'],
        confidence: 0.85,
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeProjectTechnicalBlueprint', () => {
    // ── a. Component with type 'integration' → reclassified ─────────
    describe('Step 1: reclassify by component type', () => {
        it('moves component with type "integration" to integrations', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Backend API', type: 'backend', description: 'Core API' },
                    { name: 'Payment Gateway', type: 'integration', description: 'Processes payments' },
                ],
                integrations: [],
            });

            const { blueprint, warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components).toHaveLength(1);
            expect(blueprint.components[0].name).toBe('Backend API');
            expect(blueprint.integrations).toHaveLength(1);
            expect(blueprint.integrations[0].systemName).toBe('Payment Gateway');
            expect(blueprint.integrations[0].direction).toBe('unknown');
            expect(warnings.some((w) => w.includes('Reclassified'))).toBe(true);
        });

        it('moves component with type "external_system" to integrations', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'HR System', type: 'external_system', description: 'External HR' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components).toHaveLength(0);
            expect(blueprint.integrations).toHaveLength(1);
            expect(blueprint.integrations[0].systemName).toBe('HR System');
        });
    });

    // ── b. Component with known external name → reclassified ────────
    describe('Step 1: reclassify by known external name pattern', () => {
        it.each([
            ['Outlook Integration', 'backend'],
            ['SAP ERP Connector', 'workflow'],
            ['Stripe Payment Module', 'other'],
            ['Salesforce Sync', 'backend'],
            ['Active Directory Auth', 'security'],
            ['SMTP Email Service', 'infrastructure'],
        ] as const)('reclassifies "%s" (type: %s) to integrations', (name, type) => {
            const raw = makeBlueprint({
                components: [
                    { name, type, description: 'Some description' },
                    { name: 'Core Engine', type: 'backend', description: 'Internal' },
                ],
            });

            const { blueprint, warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components.map((c) => c.name)).not.toContain(name);
            expect(blueprint.integrations.map((i) => i.systemName)).toContain(name);
            expect(warnings.some((w) => w.includes('Reclassified'))).toBe(true);
        });

        it('does NOT reclassify a legitimate internal component', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Notification Engine', type: 'backend', description: 'Sends internal alerts' },
                    { name: 'Report Generator', type: 'reporting', description: 'PDF reports' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components).toHaveLength(2);
            expect(blueprint.integrations).toHaveLength(0);
        });
    });

    // ── c. Cross-category dedup ─────────────────────────────────────
    describe('Step 2: cross-category deduplication', () => {
        it('removes component that duplicates an integration name', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Backend API', type: 'backend', description: 'Core' },
                    { name: 'PayPal', type: 'backend', description: 'Payment handling' },
                ],
                integrations: [
                    { systemName: 'PayPal', direction: 'outbound', description: 'Payment gateway' },
                ],
            });

            const { blueprint, warnings } = normalizeProjectTechnicalBlueprint(raw);

            // PayPal component was first reclassified (name match), then deduped
            // The integration should remain, component should be gone
            const compNames = blueprint.components.map((c) => c.name);
            expect(compNames).not.toContain('PayPal');
            expect(blueprint.integrations.some((i) => i.systemName === 'PayPal')).toBe(true);
            expect(warnings.length).toBeGreaterThan(0);
        });

        it('removes dataDomain that duplicates an integration name', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Core Engine', type: 'backend' },
                ],
                dataDomains: [
                    { name: 'Outlook', description: 'Email data' },
                ],
                integrations: [
                    { systemName: 'Outlook', direction: 'bidirectional', description: 'Email' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.dataDomains.map((d) => d.name)).not.toContain('Outlook');
            expect(blueprint.integrations).toHaveLength(1);
        });
    });

    // ── d. Within-category dedup ────────────────────────────────────
    describe('Step 3: within-category deduplication', () => {
        it('removes duplicate components (case-insensitive, whitespace-normalized)', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Backend API', type: 'backend', description: 'First' },
                    { name: 'backend_api', type: 'backend', description: 'Duplicate' },
                    { name: 'Frontend App', type: 'frontend', description: 'UI' },
                ],
            });

            const { blueprint, warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components).toHaveLength(2);
            expect(blueprint.components[0].name).toBe('Backend API');
            expect(blueprint.components[1].name).toBe('Frontend App');
            expect(warnings.some((w) => w.includes('duplicate component'))).toBe(true);
        });

        it('removes duplicate integrations', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Core', type: 'backend' },
                ],
                integrations: [
                    { systemName: 'SAP', direction: 'inbound', description: 'First' },
                    { systemName: 'sap', direction: 'outbound', description: 'Duplicate' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.integrations).toHaveLength(1);
            expect(blueprint.integrations[0].systemName).toBe('SAP');
        });
    });

    // ── e. Generic/useless names removed ────────────────────────────
    describe('Step 4: remove generic names', () => {
        it.each([
            'System', 'Backend', 'Database', 'API', 'Service',
            'Module', 'App', 'Data', 'Integration',
        ])('removes generic component named "%s"', (name) => {
            const raw = makeBlueprint({
                components: [
                    { name, type: 'other', description: 'Generic' },
                    { name: 'Notification Engine', type: 'backend', description: 'Real' },
                ],
            });

            const { blueprint, warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components.map((c) => c.name)).not.toContain(name);
            expect(blueprint.components.some((c) => c.name === 'Notification Engine')).toBe(true);
            expect(warnings.some((w) => w.includes('generic'))).toBe(true);
        });

        it('removes generic dataDomain names', () => {
            const raw = makeBlueprint({
                components: [{ name: 'Core', type: 'backend' }],
                dataDomains: [
                    { name: 'Dati', description: 'Too generic' },
                    { name: 'Ordini', description: 'Business entity' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.dataDomains).toHaveLength(1);
            expect(blueprint.dataDomains[0].name).toBe('Ordini');
        });
    });

    // ── f. Structural warnings ──────────────────────────────────────
    describe('Step 5: structural warnings', () => {
        it('warns when no components remain', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'System', type: 'other' }, // will be removed as generic
                ],
            });

            const { warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(warnings.some((w) => w.includes('No components found'))).toBe(true);
        });

        it('warns when dataDomains is empty', () => {
            const raw = makeBlueprint({
                components: [{ name: 'Core Engine', type: 'backend' }],
                dataDomains: [],
            });

            const { warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(warnings.some((w) => w.includes('No data domains found'))).toBe(true);
        });

        it('warns when integrations is empty', () => {
            const raw = makeBlueprint({
                components: [{ name: 'Core Engine', type: 'backend' }],
                integrations: [],
            });

            const { warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(warnings.some((w) => w.includes('No integrations found'))).toBe(true);
        });

        it('warns about components with no description', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Undocumented Module', type: 'backend' },
                ],
            });

            const { warnings } = normalizeProjectTechnicalBlueprint(raw);

            expect(warnings.some((w) => w.includes('have no description'))).toBe(true);
        });
    });

    // ── g. Idempotency ──────────────────────────────────────────────
    describe('idempotency', () => {
        it('applying normalization twice produces identical result', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Backend API', type: 'backend', description: 'Core' },
                    { name: 'Outlook Connector', type: 'integration', description: 'Email' },
                    { name: 'Backend API', type: 'backend', description: 'Duplicate' },
                    { name: 'System', type: 'other', description: 'Generic' },
                ],
                dataDomains: [
                    { name: 'Candidati', description: 'HR entity' },
                ],
                integrations: [
                    { systemName: 'SAP', direction: 'inbound', description: 'ERP' },
                ],
            });

            const first = normalizeProjectTechnicalBlueprint(raw);
            const second = normalizeProjectTechnicalBlueprint(first.blueprint);

            // Blueprint data should be identical
            expect(second.blueprint.components).toEqual(first.blueprint.components);
            expect(second.blueprint.dataDomains).toEqual(first.blueprint.dataDomains);
            expect(second.blueprint.integrations).toEqual(first.blueprint.integrations);

            // Second pass should produce no action warnings (only INFO/structural)
            const actionWarnings = second.warnings.filter(
                (w) => !w.startsWith('INFO:') && !w.startsWith('WARN:'),
            );
            expect(actionWarnings).toHaveLength(0);
        });
    });

    // ── h. Extra fields preserved ───────────────────────────────────
    describe('field preservation', () => {
        it('preserves summary, architecturalNotes, assumptions, missingInformation, confidence', () => {
            const raw = makeBlueprint({
                summary: 'Microservices CRM platform',
                architecturalNotes: ['Event-driven architecture', 'CQRS pattern'],
                assumptions: ['Team knows TypeScript'],
                missingInformation: ['Deployment environment'],
                confidence: 0.72,
                components: [
                    { name: 'User Service', type: 'backend', description: 'Handles users' },
                ],
                dataDomains: [
                    { name: 'Clienti', description: 'Customer data' },
                ],
                integrations: [
                    { systemName: 'Stripe', direction: 'outbound', description: 'Payments' },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.summary).toBe('Microservices CRM platform');
            expect(blueprint.architecturalNotes).toEqual(['Event-driven architecture', 'CQRS pattern']);
            expect(blueprint.assumptions).toEqual(['Team knows TypeScript']);
            expect(blueprint.missingInformation).toEqual(['Deployment environment']);
            expect(blueprint.confidence).toBe(0.72);
        });

        it('preserves confidence and description on reclassified components', () => {
            const raw = makeBlueprint({
                components: [
                    { name: 'Jira Tracker', type: 'workflow', description: 'Issue tracking', confidence: 0.9 },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.integrations).toHaveLength(1);
            expect(blueprint.integrations[0].description).toBe('Issue tracking');
            expect(blueprint.integrations[0].confidence).toBe(0.9);
        });
    });

    // ── Edge case: description-triggered reclassification ───────────
    describe('description-based reclassification', () => {
        it('reclassifies component whose description mentions an external system', () => {
            const raw = makeBlueprint({
                components: [
                    {
                        name: 'Email Module',
                        type: 'backend',
                        description: 'Sends emails via SMTP server and Exchange',
                    },
                ],
            });

            const { blueprint } = normalizeProjectTechnicalBlueprint(raw);

            expect(blueprint.components).toHaveLength(0);
            expect(blueprint.integrations).toHaveLength(1);
            expect(blueprint.integrations[0].systemName).toBe('Email Module');
        });
    });
});
