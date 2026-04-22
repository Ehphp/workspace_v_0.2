import { describe, expect, it } from 'vitest';
import {
    formatRelevantProjectKnowledgeBlock,
    selectDeduplicationMode,
} from '../../netlify/functions/lib/ai/formatters/project-knowledge-formatter';
import type { RelevantProjectContext } from '../../netlify/functions/lib/domain/project/project-knowledge-layer.types';

function buildContext(overrides: Partial<RelevantProjectContext> = {}): RelevantProjectContext {
    return {
        queryTerms: ['ordine', 'sap'],
        selected: {
            components: [{
                node: {
                    nodeId: 'cmp_orders',
                    kind: 'component',
                    label: 'Order Service',
                    aliases: [],
                    searchText: 'Order Service',
                    hasEvidence: true,
                },
                score: 0.8,
                reasons: ['name_match', 'search_text_overlap'],
            }],
            integrations: [{
                node: {
                    nodeId: 'int_sap',
                    kind: 'integration',
                    label: 'SAP',
                    aliases: [],
                    searchText: 'SAP integration',
                    hasEvidence: true,
                },
                score: 0.7,
                reasons: ['name_match'],
            }],
            dataDomains: [],
            workflows: [],
            relations: [{ id: 'rel_1', fromNodeId: 'cmp_orders', toNodeId: 'int_sap', type: 'sync' }],
        },
        warnings: [],
        qualityFlags: [],
        retrievalConfidence: 0.72,
        retrievalCoverage: 0.66,
        weakMatch: false,
        ...overrides,
    };
}

describe('project-knowledge-formatter', () => {
    it('formats relevant block with confidence and selected nodes', () => {
        const block = formatRelevantProjectKnowledgeBlock(buildContext());
        expect(block).toContain('RELEVANT PROJECT CONTEXT');
        expect(block).toContain('retrievalConfidence');
        expect(block).toContain('Order Service');
        expect(block).toContain('SAP');
    });

    it('selects replace mode for high-confidence retrieval', () => {
        const context = buildContext({ retrievalConfidence: 0.8, retrievalCoverage: 0.7, weakMatch: false });
        const relevantBlock = formatRelevantProjectKnowledgeBlock(context);

        const result = selectDeduplicationMode({
            relevantProjectContext: context,
            relevantProjectContextBlock: relevantBlock,
            projectTechnicalBlueprintBlock: 'BASELINE ARCHITETTURA PROGETTO\ncomponenti e integrazioni',
            maxProjectContextChars: 3000,
        });

        expect(result.decision.modeSelected).toBe('replace');
        expect(result.blocks.relevantBlock.length).toBeGreaterThan(0);
        expect(result.blocks.ptbBlock.length).toBeGreaterThan(0);
    });

    it('selects hybrid mode for medium-confidence retrieval', () => {
        const context = buildContext({ retrievalConfidence: 0.45, retrievalCoverage: 0.5, weakMatch: false });
        const relevantBlock = formatRelevantProjectKnowledgeBlock(context);

        const result = selectDeduplicationMode({
            relevantProjectContext: context,
            relevantProjectContextBlock: relevantBlock,
            projectTechnicalBlueprintBlock: 'BASELINE ARCHITETTURA PROGETTO\nDIGEST STRUTTURATO DEL PROGETTO\n...',
            maxProjectContextChars: 3200,
        });

        expect(result.decision.modeSelected).toBe('hybrid');
        expect(result.decision.downgradeReason).toBeUndefined();
    });

    it('selects fallback mode for weak match', () => {
        const context = buildContext({ retrievalConfidence: 0.25, retrievalCoverage: 0.3, weakMatch: true });
        const relevantBlock = formatRelevantProjectKnowledgeBlock(context);

        const result = selectDeduplicationMode({
            relevantProjectContext: context,
            relevantProjectContextBlock: relevantBlock,
            projectTechnicalBlueprintBlock: 'BASELINE ARCHITETTURA PROGETTO\nfull',
            maxProjectContextChars: 3000,
        });

        expect(result.decision.modeSelected).toBe('fallback');
        expect(result.decision.downgradeReason).toBe('weak_match');
    });
});
