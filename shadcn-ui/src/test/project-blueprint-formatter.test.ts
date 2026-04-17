/**
 * Regression tests for project-blueprint-formatter.ts
 *
 * Verifies backward compatibility and new estimation-oriented output.
 */

import { describe, it, expect } from 'vitest';
import { formatProjectTechnicalBlueprintBlock } from '../../netlify/functions/lib/ai/formatters/project-blueprint-formatter';

describe('formatProjectTechnicalBlueprintBlock', () => {
    it('old blueprint (no estimationContext) → legacy output format', () => {
        const ptb = {
            summary: 'A CRM system',
            components: [{ name: 'UserService', type: 'backend' }],
            integrations: [{ systemName: 'SAP', direction: 'outbound' }],
            dataDomains: [{ name: 'Customers' }],
            workflows: [{ name: 'CreateOrder', trigger: 'user click' }],
            architecturalNotes: ['Microservices'],
        };

        const output = formatProjectTechnicalBlueprintBlock(ptb);
        expect(output).toContain('BASELINE ARCHITETTURA PROGETTO');
        expect(output).toContain('Sintesi progetto: A CRM system');
        expect(output).toContain('UserService (backend)');
        expect(output).toContain('SAP [outbound]');
        expect(output).toContain('Customers');
        expect(output).not.toContain('CONTESTO PROGETTO PER LA STIMA');
    });

    it('new blueprint (with estimationContext) → estimation-oriented format', () => {
        const ptb = {
            summary: 'A CRM system',
            components: [{ name: 'UserService', type: 'backend' }],
            integrations: [{ systemName: 'SAP', direction: 'outbound' }],
            dataDomains: [{ name: 'Customers' }],
            workflows: [{ name: 'CreateOrder', trigger: 'user click' }],
            estimationContext: {
                coordinationCost: 'medium',
                overallFragility: 'low',
                highCostAreas: ['UserService'],
                fragileAreas: [],
                reusableCapabilities: [],
                constraints: [{ type: 'technical', description: 'Must use REST', estimationImpact: 'high' }],
                extensionPoints: [{ area: 'UserService', description: 'Pluggable auth', naturalFit: 'add' }],
                recurringPatterns: [],
                signalsDegraded: false,
            },
        };

        const output = formatProjectTechnicalBlueprintBlock(ptb);
        expect(output).toContain('CONTESTO PROGETTO PER LA STIMA');
        expect(output).toContain('BASELINE ARCHITETTURALE');
        expect(output).toContain('SEGNALI PER LA STIMA');
        expect(output).toContain('Aree ad alto costo di modifica: UserService');
        expect(output).toContain('VINCOLI');
        expect(output).toContain('Must use REST');
        expect(output).toContain('PUNTI DI ESTENSIONE');
        expect(output).toContain('Pluggable auth');
        expect(output).not.toContain('BASELINE ARCHITETTURA PROGETTO');
    });

    it('signalsDegraded → includes reliability warning', () => {
        const ptb = {
            summary: 'Test',
            components: [{ name: 'A', type: 'backend' }],
            estimationContext: {
                coordinationCost: 'low',
                overallFragility: 'low',
                highCostAreas: [],
                fragileAreas: [],
                reusableCapabilities: [],
                constraints: [],
                extensionPoints: [],
                recurringPatterns: [],
                signalsDegraded: true,
            },
        };

        const output = formatProjectTechnicalBlueprintBlock(ptb);
        expect(output).toContain('affidabilità ridotta');
    });

    it('empty constraints/extensionPoints/patterns → sections omitted', () => {
        const ptb = {
            summary: 'Test',
            components: [{ name: 'A', type: 'backend' }],
            estimationContext: {
                coordinationCost: 'low',
                overallFragility: 'low',
                highCostAreas: [],
                fragileAreas: [],
                reusableCapabilities: [],
                constraints: [],
                extensionPoints: [],
                recurringPatterns: [],
                signalsDegraded: false,
            },
        };

        const output = formatProjectTechnicalBlueprintBlock(ptb);
        expect(output).not.toContain('═ VINCOLI');
        expect(output).not.toContain('═ PUNTI DI ESTENSIONE');
        expect(output).not.toContain('═ PATTERN RICORRENTI');
    });
});
