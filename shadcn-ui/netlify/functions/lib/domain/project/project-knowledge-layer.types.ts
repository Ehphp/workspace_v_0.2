/**
 * Project Knowledge Layer runtime types.
 *
 * v1 is runtime-only (no persistence) and deterministic-first.
 */

import type { PipelineLayer } from '../pipeline/pipeline-domain';

export type KnowledgeNodeKind = 'component' | 'integration' | 'data_domain' | 'workflow';

export type KnowledgeSelectionReason =
    | 'name_match'
    | 'alias_match'
    | 'search_text_overlap'
    | 'workflow_match'
    | 'layer_overlap'
    | 'relation_proximity'
    | 'estimation_signal_boost'
    | 'quality_penalty'
    | 'fallback_criticality'
    | 'fallback_confidence'
    | 'no_relations_available'
    | 'invalid_ptb_input';

export interface KnowledgeNode {
    nodeId: string;
    kind: KnowledgeNodeKind;
    label: string;
    description?: string;
    aliases: string[];
    searchText: string;
    layer?: PipelineLayer;
    confidence?: number;
    businessCriticality?: 'low' | 'medium' | 'high';
    hasEvidence: boolean;
}

export interface KnowledgeRelation {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    type: string;
    confidence?: number;
}

export interface ProjectKnowledgeSnapshot {
    nodes: KnowledgeNode[];
    relations: KnowledgeRelation[];
    qualityFlags: string[];
    estimationSignals: {
        highCostAreas: string[];
        fragileAreas: string[];
        reusableCapabilities: string[];
        signalsDegraded: boolean;
    };
}

export interface KnowledgeScoredNode {
    node: KnowledgeNode;
    score: number;
    reasons: KnowledgeSelectionReason[];
}

export interface RelevantProjectContext {
    queryTerms: string[];
    selected: {
        components: KnowledgeScoredNode[];
        integrations: KnowledgeScoredNode[];
        dataDomains: KnowledgeScoredNode[];
        workflows: KnowledgeScoredNode[];
        relations: KnowledgeRelation[];
    };
    warnings: string[];
    qualityFlags: string[];
    retrievalConfidence: number;
    retrievalCoverage: number;
    weakMatch: boolean;
}

export interface DeriveProjectKnowledgeInput {
    requirementDescription: string;
    projectTechnicalBlueprint?: Record<string, unknown> | null;
    requirementUnderstanding?: Record<string, unknown> | null;
    impactMap?: Record<string, unknown> | null;
    estimationBlueprint?: Record<string, unknown> | null;
    maxPerKind?: {
        component?: number;
        integration?: number;
        dataDomain?: number;
        workflow?: number;
    };
}
