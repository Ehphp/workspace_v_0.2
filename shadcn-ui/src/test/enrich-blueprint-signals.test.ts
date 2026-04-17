/**
 * Unit tests for enrich-blueprint-signals.ts
 *
 * Covers: structural signals, estimation signals, recurring patterns,
 * estimation context, and full integration with graceful degradation.
 */

import { describe, it, expect } from 'vitest';
import {
    enrichBlueprintSignals,
    computeNodeStructuralSignals,
    computeNodeEstimationSignals,
    computeRecurringPatterns,
    computeEstimationContext,
} from '../../netlify/functions/lib/ai/post-processing/enrich-blueprint-signals';
import type {
    BlueprintRelation,
    BlueprintWorkflow,
    BlueprintComponent,
    NodeStructuralSignals,
} from '../../netlify/functions/lib/domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRelation(from: string, to: string): BlueprintRelation {
    return { id: `${from}-${to}`, fromNodeId: from, toNodeId: to, type: 'depends_on' };
}

function makeWorkflow(name: string, components: string[] = [], dataDomains: string[] = []): BlueprintWorkflow {
    return {
        name,
        description: '',
        trigger: 'user action',
        steps: [{ order: 1, action: 'do something' }],
        involvedComponents: components,
        involvedDataDomains: dataDomains,
    };
}

function makeComponent(name: string, type = 'backend' as any, confidence?: number): BlueprintComponent {
    return { id: name, name, type, confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeNodeStructuralSignals
// ─────────────────────────────────────────────────────────────────────────────

describe('computeNodeStructuralSignals', () => {
    it('0 relations → loose coupling', () => {
        const result = computeNodeStructuralSignals('A', 'A', [], [], []);
        expect(result.relationsCount).toBe(0);
        expect(result.couplingDegree).toBe('loose');
    });

    it('3 relations → moderate coupling', () => {
        const rels = [makeRelation('A', 'B'), makeRelation('A', 'C'), makeRelation('D', 'A')];
        const result = computeNodeStructuralSignals('A', 'A', [], rels, []);
        expect(result.relationsCount).toBe(3);
        expect(result.couplingDegree).toBe('moderate');
    });

    it('7 relations → tight coupling', () => {
        const rels = Array.from({ length: 7 }, (_, i) => makeRelation('A', `X${i}`));
        const result = computeNodeStructuralSignals('A', 'A', [], rels, []);
        expect(result.relationsCount).toBe(7);
        expect(result.couplingDegree).toBe('tight');
    });

    it('evidence: 0 → missing, 1 → partial, 2 → good', () => {
        const r0 = computeNodeStructuralSignals('A', 'A', [], [], []);
        expect(r0.documentationCoverage).toBe('missing');

        const r1 = computeNodeStructuralSignals('A', 'A', [{ sourceType: 'source_text', snippet: 'x' }], [], []);
        expect(r1.documentationCoverage).toBe('partial');

        const r2 = computeNodeStructuralSignals('A', 'A', [
            { sourceType: 'source_text', snippet: 'x' },
            { sourceType: 'source_text', snippet: 'y' },
        ], [], []);
        expect(r2.documentationCoverage).toBe('good');
    });

    it('counts workflow participation by ID and name', () => {
        const wf = [makeWorkflow('W1', ['A']), makeWorkflow('W2', [], ['A'])];
        const result = computeNodeStructuralSignals('A', 'A', [], [], wf);
        expect(result.workflowParticipation).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeNodeEstimationSignals
// ─────────────────────────────────────────────────────────────────────────────

describe('computeNodeEstimationSignals', () => {
    it('database + tight coupling → modificationCost high', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 6, couplingDegree: 'tight',
            documentationCoverage: 'good', workflowParticipation: 1,
        };
        const result = computeNodeEstimationSignals('database', 0.9, null, structural);
        expect(result.modificationCost).toBe('high');
    });

    it('page + loose + confidence 0.9 → modificationCost low', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 1, couplingDegree: 'loose',
            documentationCoverage: 'good', workflowParticipation: 0,
        };
        const result = computeNodeEstimationSignals('page', 0.9, null, structural);
        expect(result.modificationCost).toBe('low');
    });

    it('confidence undefined → fragile = false (graceful)', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 4, couplingDegree: 'moderate',
            documentationCoverage: 'good', workflowParticipation: 1,
        };
        const result = computeNodeEstimationSignals('backend', undefined, null, structural);
        expect(result.fragile).toBe(false);
    });

    it('confidence 0.3 + moderate coupling → fragile = true', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 4, couplingDegree: 'moderate',
            documentationCoverage: 'good', workflowParticipation: 1,
        };
        const result = computeNodeEstimationSignals('backend', 0.3, null, structural);
        expect(result.fragile).toBe(true);
    });

    it('confidence 0.3 + loose coupling → fragile = false (degradation)', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 1, couplingDegree: 'loose',
            documentationCoverage: 'good', workflowParticipation: 1,
        };
        const result = computeNodeEstimationSignals('backend', 0.3, null, structural);
        expect(result.fragile).toBe(false);
    });

    it('loose + multi-workflow + service type → reusable = true', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 2, couplingDegree: 'loose',
            documentationCoverage: 'good', workflowParticipation: 3,
        };
        const result = computeNodeEstimationSignals('service_layer', 0.8, null, structural);
        expect(result.reusable).toBe(true);
    });

    it('changeSurface equals relationsCount', () => {
        const structural: NodeStructuralSignals = {
            relationsCount: 5, couplingDegree: 'moderate',
            documentationCoverage: 'good', workflowParticipation: 1,
        };
        const result = computeNodeEstimationSignals('backend', 0.8, null, structural);
        expect(result.changeSurface).toBe(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRecurringPatterns
// ─────────────────────────────────────────────────────────────────────────────

describe('computeRecurringPatterns', () => {
    it('2 workflows sharing 2 components → cross-component pattern', () => {
        const workflows = [
            makeWorkflow('W1', ['A', 'B', 'C']),
            makeWorkflow('W2', ['A', 'B', 'D']),
        ];
        const components = [makeComponent('A'), makeComponent('B'), makeComponent('C'), makeComponent('D')];
        const patterns = computeRecurringPatterns(workflows, components);
        // 1 cross-component cluster + 2 central hubs (A and B each in 100% of workflows)
        expect(patterns.length).toBe(3);
        expect(patterns[0].typicalEffort).toBe('medium');
        expect(patterns[0].name).toContain('Cross-component');
    });

    it('no overlaps → empty', () => {
        const workflows = [
            makeWorkflow('W1', ['A']),
            makeWorkflow('W2', ['B']),
        ];
        const patterns = computeRecurringPatterns(workflows, [makeComponent('A'), makeComponent('B')]);
        expect(patterns.length).toBe(0);
    });

    it('central hub detected when component in >50% workflows', () => {
        const workflows = [
            makeWorkflow('W1', ['Hub', 'A']),
            makeWorkflow('W2', ['Hub', 'B']),
            makeWorkflow('W3', ['Hub', 'C']),
        ];
        const components = [makeComponent('Hub'), makeComponent('A'), makeComponent('B'), makeComponent('C')];
        const patterns = computeRecurringPatterns(workflows, components);
        expect(patterns.some(p => p.name.includes('Central hub'))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeEstimationContext
// ─────────────────────────────────────────────────────────────────────────────

describe('computeEstimationContext', () => {
    it('0 relations → signalsDegraded = true', () => {
        const ctx = computeEstimationContext(
            [{ name: 'A', estimation: { modificationCost: 'medium', fragile: false, reusable: false, changeSurface: 0 } }],
            [], [], [], [], [], [], 1,
        );
        expect(ctx.signalsDegraded).toBe(true);
    });

    it('10 relations → signalsDegraded = false', () => {
        const relations = Array.from({ length: 10 }, (_, i) => makeRelation(`A${i}`, `B${i}`));
        const ctx = computeEstimationContext([], [], [], [], [], [], relations, 5);
        expect(ctx.signalsDegraded).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// enrichBlueprintSignals (full integration)
// ─────────────────────────────────────────────────────────────────────────────

describe('enrichBlueprintSignals', () => {
    it('all nodes get signals, context populated', () => {
        const result = enrichBlueprintSignals({
            components: [makeComponent('Comp1', 'backend', 0.8)],
            dataDomains: [{ name: 'Domain1' }],
            integrations: [{ systemName: 'ExtSys', direction: 'inbound' as any }],
            workflows: [makeWorkflow('W1', ['Comp1'], ['Domain1'])],
            relations: [makeRelation('Comp1', 'Domain1')],
            constraints: [{ type: 'technical', description: 'Must use REST', estimationImpact: 'medium' }],
            extensionPoints: [],
        });

        expect(result.components[0].structuralSignals).toBeDefined();
        expect(result.components[0].estimationSignals).toBeDefined();
        expect(result.dataDomains[0].structuralSignals).toBeDefined();
        expect(result.integrations[0].structuralSignals).toBeDefined();
        expect(result.estimationContext).toBeDefined();
        expect(result.estimationContext.constraints).toHaveLength(1);
    });

    it('empty relations → all signals conservative/loose, signalsDegraded true', () => {
        const result = enrichBlueprintSignals({
            components: [makeComponent('Comp1', 'page', 0.9)],
            dataDomains: [],
            integrations: [],
            workflows: [],
            relations: [],
            constraints: [],
            extensionPoints: [],
        });

        expect(result.components[0].structuralSignals!.couplingDegree).toBe('loose');
        expect(result.components[0].estimationSignals!.modificationCost).toBe('low');
        expect(result.components[0].estimationSignals!.fragile).toBe(false);
        expect(result.estimationContext.signalsDegraded).toBe(true);
    });
});
