/**
 * Blueprint Graph Model — Types & Mapper
 *
 * Transforms a ProjectTechnicalBlueprint into a React Flow graph model
 * with a structured 3-column layout:
 *   LEFT: Data Domains  |  CENTER: Core Components  |  RIGHT: Integrations
 *
 * The graph is a VIEW-ONLY projection;
 * the blueprint structured data remains the source of truth.
 */

import { type Node, type Edge, Position } from '@xyflow/react';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Graph Node Data
// ─────────────────────────────────────────────────────────────────────────────

export type BlueprintNodeKind = 'component' | 'integration' | 'data_domain';

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
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-Column Layout Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Column header height reserved at top */
const HEADER_Y = 0;
/** First node Y offset (below header area) */
const FIRST_NODE_Y = 60;

const COLUMN_X = {
    left: 0,        // Data Domains
    center: 400,    // Core Components
    right: 800,     // Integrations
} as const;

const NODE_DIMENSIONS: Record<BlueprintNodeKind, { width: number; height: number }> = {
    component: { width: 240, height: 80 },
    data_domain: { width: 180, height: 64 },
    integration: { width: 200, height: 72 },
};

const VERTICAL_GAP = 24; // gap between nodes in same column

// ─────────────────────────────────────────────────────────────────────────────
// Color / style constants by kind
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_STYLES: Record<BlueprintNodeKind, {
    bg: string; border: string; badge: string; edgeColor: string;
}> = {
    component:   { bg: '#eff6ff', border: '#3b82f6', badge: 'bg-blue-100 text-blue-800',   edgeColor: '#3b82f6' },
    integration: { bg: '#faf5ff', border: '#a855f7', badge: 'bg-purple-100 text-purple-800', edgeColor: '#a855f7' },
    data_domain: { bg: '#f0fdf4', border: '#22c55e', badge: 'bg-green-100 text-green-800',  edgeColor: '#22c55e' },
};

/** Column header labels exported for the canvas overlay */
export const COLUMN_HEADERS: { key: BlueprintNodeKind; label: string; x: number }[] = [
    { key: 'data_domain', label: 'Data Domains', x: COLUMN_X.left },
    { key: 'component',   label: 'Core Components', x: COLUMN_X.center },
    { key: 'integration', label: 'External Systems', x: COLUMN_X.right },
];

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

    // ── Column trackers ─────────────────────────────────────────────
    let leftY = FIRST_NODE_Y;
    let centerY = FIRST_NODE_Y;
    let rightY = FIRST_NODE_Y;

    // ── Components → CENTER column ──────────────────────────────────
    blueprint.components.forEach((comp, i) => {
        const dim = NODE_DIMENSIONS.component;
        const isPrimary = coreComponentIndices.has(i);
        nodes.push({
            id: `comp-${i}`,
            type: 'blueprintNode',
            position: { x: COLUMN_X.center, y: centerY },
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
            },
        });
        centerY += dim.height + VERTICAL_GAP;
    });

    // ── Data Domains → LEFT column ──────────────────────────────────
    blueprint.dataDomains.forEach((dd, i) => {
        const dim = NODE_DIMENSIONS.data_domain;
        nodes.push({
            id: `dd-${i}`,
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
            },
        });
        leftY += dim.height + VERTICAL_GAP;
    });

    // ── Integrations → RIGHT column ─────────────────────────────────
    blueprint.integrations.forEach((integ, i) => {
        const dim = NODE_DIMENSIONS.integration;
        nodes.push({
            id: `integ-${i}`,
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
            },
        });
        rightY += dim.height + VERTICAL_GAP;
    });

    // ── Edges: LEFT → CENTER → RIGHT (clean horizontal flow) ───────
    const coreIds = Array.from(coreComponentIndices).map((i) => `comp-${i}`);

    // Data Domains → nearest core component (round-robin to spread)
    if (coreIds.length > 0) {
        blueprint.dataDomains.forEach((_, i) => {
            const target = coreIds[i % coreIds.length];
            edges.push({
                id: `e-dd-${i}-${target}`,
                source: `dd-${i}`,
                target,
                style: { stroke: NODE_STYLES.data_domain.edgeColor, strokeWidth: 1.5 },
                type: 'smoothstep',
            });
        });
    }

    // Core components → integrations (round-robin)
    if (coreIds.length > 0) {
        blueprint.integrations.forEach((_, i) => {
            const source = coreIds[i % coreIds.length];
            edges.push({
                id: `e-${source}-integ-${i}`,
                source,
                target: `integ-${i}`,
                animated: true,
                style: { stroke: NODE_STYLES.integration.edgeColor, strokeWidth: 1.5 },
                type: 'smoothstep',
            });
        });
    }

    // ── Build adjacency map ─────────────────────────────────────────
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
        if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }

    return { nodes, edges, adjacency };
}
