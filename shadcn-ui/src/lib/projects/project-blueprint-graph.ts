/**
 * Blueprint Graph Model — Types & Mapper
 *
 * Transforms a ProjectTechnicalBlueprint into a React Flow graph model
 * with a structured 4-column layout:
 *   LEFT: Data Domains  |  CENTER-LEFT: Core Components  |  CENTER-RIGHT: Workflows  |  RIGHT: Integrations
 *
 * The graph is a VIEW-ONLY projection;
 * the blueprint structured data remains the source of truth.
 */

import { type Node, type Edge, Position } from '@xyflow/react';
import type {
    ProjectTechnicalBlueprint,
    BlueprintRelation,
    EvidenceRef,
    CriticalityLevel,
    ReviewStatus,
    NodeStructuralSignals,
    NodeEstimationSignals,
} from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Graph Node Data
// ─────────────────────────────────────────────────────────────────────────────

export type BlueprintNodeKind = 'component' | 'integration' | 'data_domain' | 'workflow';

export interface BlueprintGraphNodeData {
    kind: BlueprintNodeKind;
    label: string;
    description?: string;
    confidence?: number;
    typeLabel?: string;
    /** Original index in the blueprint array (for editing) */
    sourceIndex: number;
    /** Whether this is the primary/core component */
    isPrimary?: boolean;
    /** v2: node ID from domain model */
    nodeId?: string;
    /** v2: evidence snippets */
    evidence?: EvidenceRef[];
    /** v2: business criticality */
    businessCriticality?: CriticalityLevel;
    /** v2: estimation impact */
    estimationImpact?: CriticalityLevel;
    /** v2: change likelihood */
    changeLikelihood?: CriticalityLevel;
    /** v2: review status */
    reviewStatus?: ReviewStatus;
    /** v2: whether the node has no evidence */
    hasNoEvidence?: boolean;
    /** v3: structural signals (enrichment) */
    structuralSignals?: NodeStructuralSignals;
    /** v3: estimation signals (enrichment) */
    estimationSignals?: NodeEstimationSignals;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Edge Data
// ─────────────────────────────────────────────────────────────────────────────

export type BlueprintEdgeKind = 'structural' | 'inferred';

export interface BlueprintGraphEdgeData {
    kind: BlueprintEdgeKind;
    relationType?: string;
    relationConfidence?: number;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Model
// ─────────────────────────────────────────────────────────────────────────────

export interface BlueprintGraphModel {
    nodes: Node<BlueprintGraphNodeData>[];
    edges: Edge[];
    /** Pre-computed adjacency: nodeId → Set of connected nodeIds */
    adjacency: Map<string, Set<string>>;
    /** v2: typed relations from the blueprint (for inspector) */
    relations: BlueprintRelation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-Column Layout Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Column header height reserved at top */
const HEADER_Y = 0;
/** First node Y offset (below header area) */
const FIRST_NODE_Y = 60;

const COLUMN_X = {
    left: 0,          // Data Domains
    centerLeft: 300,  // Core Components
    centerRight: 600, // Workflows
    right: 900,       // Integrations
} as const;

const NODE_DIMENSIONS: Record<BlueprintNodeKind, { width: number; height: number }> = {
    component: { width: 240, height: 80 },
    data_domain: { width: 180, height: 64 },
    workflow: { width: 240, height: 88 },
    integration: { width: 200, height: 72 },
};

const VERTICAL_GAP = 24; // gap between nodes in same column

// ─────────────────────────────────────────────────────────────────────────────
// Color / style constants by kind
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_STYLES: Record<BlueprintNodeKind, {
    bg: string; border: string; badge: string; edgeColor: string;
}> = {
    component: { bg: '#eff6ff', border: '#3b82f6', badge: 'bg-blue-100 text-blue-800', edgeColor: '#3b82f6' },
    integration: { bg: '#faf5ff', border: '#a855f7', badge: 'bg-purple-100 text-purple-800', edgeColor: '#a855f7' },
    data_domain: { bg: '#f0fdf4', border: '#22c55e', badge: 'bg-green-100 text-green-800', edgeColor: '#22c55e' },
    workflow: { bg: '#fffbeb', border: '#f59e0b', badge: 'bg-amber-100 text-amber-800', edgeColor: '#f59e0b' },
};

/** Column header labels exported for the canvas overlay */
export const COLUMN_HEADERS: { key: BlueprintNodeKind; label: string; x: number }[] = [
    { key: 'data_domain', label: 'Data Domains', x: COLUMN_X.left },
    { key: 'component', label: 'Core Components', x: COLUMN_X.centerLeft },
    { key: 'workflow', label: 'Workflows', x: COLUMN_X.centerRight },
    { key: 'integration', label: 'External Systems', x: COLUMN_X.right },
];

// ─────────────────────────────────────────────────────────────────────────────
// Relation edge style constants
// ─────────────────────────────────────────────────────────────────────────────

const RELATION_EDGE_COLORS: Record<string, string> = {
    reads: '#0ea5e9',       // sky
    writes: '#f59e0b',      // amber
    orchestrates: '#6366f1', // indigo
    syncs: '#14b8a6',       // teal
    owns: '#22c55e',        // green
    depends_on: '#ef4444',  // red
};

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildProjectBlueprintGraph(
    blueprint: ProjectTechnicalBlueprint,
): BlueprintGraphModel {
    const nodes: Node<BlueprintGraphNodeData>[] = [];
    const edges: Edge[] = [];

    // ── Identify core component ids ─────────────────────────────────
    const coreTypes = new Set(['backend', 'database', 'infrastructure']);
    const coreComponentIndices = new Set<number>();
    blueprint.components.forEach((comp, i) => {
        if (coreTypes.has(comp.type)) coreComponentIndices.add(i);
    });
    // Fallback: first component is core
    if (coreComponentIndices.size === 0 && blueprint.components.length > 0) {
        coreComponentIndices.add(0);
    }

    // ── Node ID map: domain id → graph node id ──────────────────────
    const domainIdToGraphId = new Map<string, string>();

    // ── Column trackers ─────────────────────────────────────────────
    let leftY = FIRST_NODE_Y;
    let centerLeftY = FIRST_NODE_Y;
    let centerRightY = FIRST_NODE_Y;
    let rightY = FIRST_NODE_Y;

    // ── Components → CENTER column ──────────────────────────────────
    blueprint.components.forEach((comp, i) => {
        const dim = NODE_DIMENSIONS.component;
        const isPrimary = coreComponentIndices.has(i);
        const graphId = `comp-${i}`;
        if (comp.id) domainIdToGraphId.set(comp.id, graphId);
        nodes.push({
            id: graphId,
            type: 'blueprintNode',
            position: { x: COLUMN_X.centerLeft, y: centerLeftY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
                kind: 'component',
                label: comp.name || 'Unnamed',
                description: comp.description,
                confidence: comp.confidence,
                typeLabel: comp.type,
                sourceIndex: i,
                isPrimary,
                nodeId: comp.id,
                evidence: comp.evidence,
                businessCriticality: comp.businessCriticality,
                estimationImpact: comp.estimationImpact,
                changeLikelihood: comp.changeLikelihood,
                reviewStatus: comp.reviewStatus,
                hasNoEvidence: !comp.evidence || comp.evidence.length === 0,
                structuralSignals: comp.structuralSignals,
                estimationSignals: comp.estimationSignals,
            },
        });
        centerLeftY += dim.height + VERTICAL_GAP;
    });

    // ── Data Domains → LEFT column ──────────────────────────────────
    blueprint.dataDomains.forEach((dd, i) => {
        const dim = NODE_DIMENSIONS.data_domain;
        const graphId = `dd-${i}`;
        if (dd.id) domainIdToGraphId.set(dd.id, graphId);
        nodes.push({
            id: graphId,
            type: 'blueprintNode',
            position: { x: COLUMN_X.left, y: leftY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
                kind: 'data_domain',
                label: dd.name || 'Unnamed',
                description: dd.description,
                confidence: dd.confidence,
                typeLabel: 'Data Domain',
                sourceIndex: i,
                nodeId: dd.id,
                evidence: dd.evidence,
                businessCriticality: dd.businessCriticality,
                estimationImpact: dd.estimationImpact,
                changeLikelihood: dd.changeLikelihood,
                reviewStatus: dd.reviewStatus,
                hasNoEvidence: !dd.evidence || dd.evidence.length === 0,
                structuralSignals: dd.structuralSignals,
                estimationSignals: dd.estimationSignals,
            },
        });
        leftY += dim.height + VERTICAL_GAP;
    });

    // ── Integrations → RIGHT column ─────────────────────────────────
    blueprint.integrations.forEach((integ, i) => {
        const dim = NODE_DIMENSIONS.integration;
        const graphId = `integ-${i}`;
        if (integ.id) domainIdToGraphId.set(integ.id, graphId);
        nodes.push({
            id: graphId,
            type: 'blueprintNode',
            position: { x: COLUMN_X.right, y: rightY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
                kind: 'integration',
                label: integ.systemName || 'Unnamed',
                description: integ.description,
                confidence: integ.confidence,
                typeLabel: integ.direction ?? 'unknown',
                sourceIndex: i,
                nodeId: integ.id,
                evidence: integ.evidence,
                businessCriticality: integ.businessCriticality,
                estimationImpact: integ.estimationImpact,
                changeLikelihood: integ.changeLikelihood,
                reviewStatus: integ.reviewStatus,
                hasNoEvidence: !integ.evidence || integ.evidence.length === 0,
                structuralSignals: integ.structuralSignals,
                estimationSignals: integ.estimationSignals,
            },
        });
        rightY += dim.height + VERTICAL_GAP;
    });

    // ── Workflows → CENTER-RIGHT column ─────────────────────────────
    const workflows = blueprint.workflows ?? [];
    workflows.forEach((wf, i) => {
        const dim = NODE_DIMENSIONS.workflow;
        const graphId = `wf-${i}`;
        if (wf.id) domainIdToGraphId.set(wf.id, graphId);
        nodes.push({
            id: graphId,
            type: 'blueprintNode',
            position: { x: COLUMN_X.centerRight, y: centerRightY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
                kind: 'workflow',
                label: wf.name || 'Unnamed',
                description: wf.description,
                confidence: wf.confidence,
                typeLabel: wf.trigger ?? 'workflow',
                sourceIndex: i,
                nodeId: wf.id,
                evidence: wf.evidence,
                businessCriticality: wf.complexity as CriticalityLevel | undefined,
                reviewStatus: wf.reviewStatus,
                hasNoEvidence: !wf.evidence || wf.evidence.length === 0,
                structuralSignals: wf.structuralSignals,
                estimationSignals: wf.estimationSignals,
            },
        });
        centerRightY += dim.height + VERTICAL_GAP;
    });

    // ── Typed relation edges (v2) ───────────────────────────────────
    const usedRelationEdges = new Set<string>();
    const blueprintRelations = blueprint.relations ?? [];

    for (const rel of blueprintRelations) {
        const sourceId = domainIdToGraphId.get(rel.fromNodeId);
        const targetId = domainIdToGraphId.get(rel.toNodeId);
        if (!sourceId || !targetId) continue;

        const edgeId = `rel-${rel.id ?? `${sourceId}-${targetId}`}`;
        if (usedRelationEdges.has(edgeId)) continue;
        usedRelationEdges.add(edgeId);

        // Track that these nodes are connected via a typed relation
        const edgeColor = RELATION_EDGE_COLORS[rel.type] ?? '#94a3b8';
        edges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            style: {
                stroke: edgeColor,
                strokeWidth: 2,
                strokeDasharray: rel.confidence != null && rel.confidence < 0.5 ? '5,5' : undefined,
            },
            type: 'smoothstep',
            label: rel.type,
            labelStyle: { fontSize: 9, fill: edgeColor },
            data: { kind: 'inferred' as BlueprintEdgeKind, relationType: rel.type, relationConfidence: rel.confidence },
        });
    }

    // ── Structural edges: LEFT → CENTER → RIGHT (fallback for nodes without typed relations) ───
    const coreIds = Array.from(coreComponentIndices).map((i) => `comp-${i}`);

    // Data Domains → nearest core component (round-robin to spread)
    if (coreIds.length > 0) {
        blueprint.dataDomains.forEach((_, i) => {
            const graphId = `dd-${i}`;
            // Skip if already connected via typed relation
            if (edges.some((e) => (e.source === graphId || e.target === graphId) && e.data?.kind === 'inferred')) return;
            const target = coreIds[i % coreIds.length];
            edges.push({
                id: `e-dd-${i}-${target}`,
                source: graphId,
                target,
                style: { stroke: NODE_STYLES.data_domain.edgeColor, strokeWidth: 1.5, opacity: 0.6 },
                type: 'smoothstep',
                data: { kind: 'structural' as BlueprintEdgeKind },
            });
        });
    }

    // Core components → integrations (round-robin)
    if (coreIds.length > 0) {
        blueprint.integrations.forEach((_, i) => {
            const graphId = `integ-${i}`;
            if (edges.some((e) => (e.source === graphId || e.target === graphId) && e.data?.kind === 'inferred')) return;
            const source = coreIds[i % coreIds.length];
            edges.push({
                id: `e-${source}-integ-${i}`,
                source,
                target: graphId,
                animated: true,
                style: { stroke: NODE_STYLES.integration.edgeColor, strokeWidth: 1.5, opacity: 0.6 },
                type: 'smoothstep',
                data: { kind: 'structural' as BlueprintEdgeKind },
            });
        });
    }

    // Workflows → involved components & data domains (dashed edges)
    workflows.forEach((wf, wfIdx) => {
        const wfGraphId = `wf-${wfIdx}`;
        // Link to involved components by name match
        for (const compRef of wf.involvedComponents ?? []) {
            const compIdx = blueprint.components.findIndex(
                (c) => c.name === compRef || c.id === compRef,
            );
            if (compIdx >= 0) {
                edges.push({
                    id: `e-wf-${wfIdx}-comp-${compIdx}`,
                    source: wfGraphId,
                    target: `comp-${compIdx}`,
                    style: { stroke: NODE_STYLES.workflow.edgeColor, strokeWidth: 1.5, strokeDasharray: '5,5', opacity: 0.7 },
                    type: 'smoothstep',
                    data: { kind: 'structural' as BlueprintEdgeKind },
                });
            }
        }
        // Link to involved data domains by name match
        for (const ddRef of wf.involvedDataDomains ?? []) {
            const ddIdx = blueprint.dataDomains.findIndex(
                (d) => d.name === ddRef || d.id === ddRef,
            );
            if (ddIdx >= 0) {
                edges.push({
                    id: `e-wf-${wfIdx}-dd-${ddIdx}`,
                    source: wfGraphId,
                    target: `dd-${ddIdx}`,
                    style: { stroke: NODE_STYLES.workflow.edgeColor, strokeWidth: 1.5, strokeDasharray: '5,5', opacity: 0.7 },
                    type: 'smoothstep',
                    data: { kind: 'structural' as BlueprintEdgeKind },
                });
            }
        }
    });

    // ── Build adjacency map ─────────────────────────────────────────
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
        if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }

    return { nodes, edges, adjacency, relations: blueprintRelations };
}
