import { describe, expect, it } from 'vitest';
import {
    deriveProjectKnowledgeContext,
    normalizeProjectTechnicalBlueprintToKnowledgeSnapshot,
} from '../../netlify/functions/lib/domain/project/project-knowledge-layer';

describe('project-knowledge-layer', () => {
    it('returns neutral context when PTB is invalid', () => {
        const result = deriveProjectKnowledgeContext({
            requirementDescription: 'Gestione ordini e sincronizzazione con ERP',
            projectTechnicalBlueprint: null,
        });

        expect(result.weakMatch).toBe(true);
        expect(result.retrievalConfidence).toBe(0);
        expect(result.warnings).toContain('invalid_ptb_input');
    });

    it('adds no_relations_available quality flag when relations are missing', () => {
        const snapshot = normalizeProjectTechnicalBlueprintToKnowledgeSnapshot({
            projectId: 'p1',
            version: 1,
            components: [{ id: 'cmp_orders', name: 'Order Service', type: 'backend', confidence: 0.8 }],
            integrations: [],
            dataDomains: [],
            workflows: [],
            qualityFlags: [],
        });

        expect(snapshot).not.toBeNull();
        expect(snapshot!.qualityFlags).toContain('no_relations_available');
    });

    it('selects requirement-relevant nodes with deterministic scoring', () => {
        const result = deriveProjectKnowledgeContext({
            requirementDescription: 'Aggiungere validazione ordine e sync con SAP',
            projectTechnicalBlueprint: {
                projectId: 'p1',
                version: 1,
                components: [
                    {
                        id: 'cmp_order_service',
                        name: 'Order Service',
                        type: 'backend',
                        description: 'Handles order validation and pricing',
                        confidence: 0.9,
                        businessCriticality: 'high',
                        evidence: [{ snippet: 'Order flow validation' }],
                    },
                    {
                        id: 'cmp_inventory',
                        name: 'Inventory Service',
                        type: 'backend',
                        description: 'Tracks stock levels',
                        confidence: 0.7,
                        businessCriticality: 'medium',
                    },
                ],
                integrations: [
                    {
                        id: 'int_sap',
                        systemName: 'SAP',
                        direction: 'outbound',
                        description: 'Sync orders to SAP',
                        confidence: 0.9,
                        evidence: [{ snippet: 'ERP sync' }],
                    },
                ],
                dataDomains: [
                    { id: 'dom_orders', name: 'Orders', confidence: 0.8, evidence: [{ snippet: 'Order records' }] },
                ],
                workflows: [],
                relations: [
                    { id: 'rel_1', fromNodeId: 'cmp_order_service', toNodeId: 'int_sap', type: 'sync', confidence: 0.9 },
                ],
                qualityFlags: [],
                estimationContext: {
                    highCostAreas: ['Order Service'],
                    fragileAreas: [],
                    reusableCapabilities: [],
                    signalsDegraded: false,
                },
            },
        });

        expect(result.selected.components.length).toBeGreaterThan(0);
        expect(result.selected.integrations.length).toBeGreaterThan(0);
        expect(result.selected.components[0].node.label).toBe('Order Service');
        expect(result.selected.integrations[0].node.label).toBe('SAP');
        expect(result.retrievalConfidence).toBeGreaterThan(0.05);
    });
});
