/**
 * Blueprint Diff Engine
 *
 * Computes a semantic diff between two blueprint versions.
 * Used during persistence to populate change_summary and diff_from_previous.
 */

import type {
    ProjectTechnicalBlueprint,
    BlueprintRelation,
    BlueprintDiffSummary,
} from '../../domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two blueprint versions and return a structured diff summary.
 */
export function computeProjectBlueprintDiff(
    previous: ProjectTechnicalBlueprint,
    next: ProjectTechnicalBlueprint,
): BlueprintDiffSummary {
    const prevNodeMap = buildNodeMap(previous);
    const nextNodeMap = buildNodeMap(next);

    const addedNodes: string[] = [];
    const removedNodes: string[] = [];
    const updatedNodes: string[] = [];
    const reclassifiedNodes: string[] = [];

    // Find added and updated nodes
    for (const [id, node] of nextNodeMap) {
        const prevNode = prevNodeMap.get(id);
        if (!prevNode) {
            addedNodes.push(node.label);
        } else {
            if (prevNode.kind !== node.kind) {
                reclassifiedNodes.push(`${node.label} (${prevNode.kind} → ${node.kind})`);
            } else if (prevNode.description !== node.description || prevNode.type !== node.type) {
                updatedNodes.push(node.label);
            }
        }
    }

    // Find removed nodes
    for (const [id, node] of prevNodeMap) {
        if (!nextNodeMap.has(id)) {
            removedNodes.push(node.label);
        }
    }

    // Relations diff
    const prevRelKeys = new Set(
        (previous.relations ?? []).map((r) => relationKey(r)),
    );
    const nextRelKeys = new Set(
        (next.relations ?? []).map((r) => relationKey(r)),
    );

    const addedRelations: string[] = [];
    const removedRelations: string[] = [];

    for (const r of (next.relations ?? [])) {
        const key = relationKey(r);
        if (!prevRelKeys.has(key)) {
            addedRelations.push(`${r.fromNodeId} —${r.type}→ ${r.toNodeId}`);
        }
    }
    for (const r of (previous.relations ?? [])) {
        const key = relationKey(r);
        if (!nextRelKeys.has(key)) {
            removedRelations.push(`${r.fromNodeId} —${r.type}→ ${r.toNodeId}`);
        }
    }

    // Metadata diffs
    const changedAssumptions = !arraysEqual(previous.assumptions, next.assumptions);
    const changedMissingInformation = !arraysEqual(previous.missingInformation, next.missingInformation);

    // Breaking changes detection
    const breakingArchitecturalChanges = detectBreakingChanges(
        previous, next, removedNodes, reclassifiedNodes,
    );

    return {
        addedNodes,
        removedNodes,
        updatedNodes,
        reclassifiedNodes,
        addedRelations,
        removedRelations,
        changedAssumptions,
        changedMissingInformation,
        breakingArchitecturalChanges,
    };
}

/**
 * Generate a human-readable change summary from a diff.
 */
export function formatChangeSummary(diff: BlueprintDiffSummary): string {
    const parts: string[] = [];

    if (diff.addedNodes.length > 0) {
        parts.push(`Added: ${diff.addedNodes.join(', ')}`);
    }
    if (diff.removedNodes.length > 0) {
        parts.push(`Removed: ${diff.removedNodes.join(', ')}`);
    }
    if (diff.updatedNodes.length > 0) {
        parts.push(`Updated: ${diff.updatedNodes.join(', ')}`);
    }
    if (diff.reclassifiedNodes.length > 0) {
        parts.push(`Reclassified: ${diff.reclassifiedNodes.join(', ')}`);
    }
    if (diff.addedRelations.length > 0) {
        parts.push(`+${diff.addedRelations.length} relation(s)`);
    }
    if (diff.removedRelations.length > 0) {
        parts.push(`-${diff.removedRelations.length} relation(s)`);
    }
    if (diff.changedAssumptions) {
        parts.push('Assumptions changed');
    }
    if (diff.changedMissingInformation) {
        parts.push('Missing information changed');
    }
    if (diff.breakingArchitecturalChanges) {
        parts.push('⚠ BREAKING architectural changes');
    }

    return parts.length > 0 ? parts.join(' | ') : 'No significant changes';
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface NodeInfo {
    id: string;
    kind: 'component' | 'data_domain' | 'integration';
    label: string;
    type?: string;
    description?: string;
}

function normalizeName(s: string): string {
    return s.toLowerCase().replace(/[\s\-_.,;:!?()]+/g, '').trim();
}

function buildNodeMap(bp: ProjectTechnicalBlueprint): Map<string, NodeInfo> {
    const map = new Map<string, NodeInfo>();

    for (const c of bp.components) {
        const id = c.id || `cmp_${normalizeName(c.name)}`;
        map.set(id, { id, kind: 'component', label: c.name, type: c.type, description: c.description });
    }
    for (const d of bp.dataDomains) {
        const id = d.id || `dom_${normalizeName(d.name)}`;
        map.set(id, { id, kind: 'data_domain', label: d.name, description: d.description });
    }
    for (const i of bp.integrations) {
        const id = i.id || `int_${normalizeName(i.systemName)}`;
        map.set(id, { id, kind: 'integration', label: i.systemName, description: i.description });
    }

    return map;
}

function relationKey(r: BlueprintRelation): string {
    return `${r.fromNodeId}→${r.toNodeId}→${r.type}`;
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
}

/** Core component types whose removal constitutes a breaking change */
const CORE_TYPES = new Set(['backend', 'database', 'infrastructure']);

function detectBreakingChanges(
    previous: ProjectTechnicalBlueprint,
    next: ProjectTechnicalBlueprint,
    removedNodes: string[],
    reclassifiedNodes: string[],
): boolean {
    // Removal of a database component
    const removedCoreComps = previous.components.filter(
        (c) => CORE_TYPES.has(c.type) && removedNodes.includes(c.name),
    );
    if (removedCoreComps.length > 0) return true;

    // Removal of an integration
    const prevIntegNames = new Set(previous.integrations.map((i) => i.systemName));
    const nextIntegNames = new Set(next.integrations.map((i) => i.systemName));
    for (const name of prevIntegNames) {
        if (!nextIntegNames.has(name)) {
            // An integration was removed entirely
            const prevInteg = previous.integrations.find((i) => i.systemName === name);
            if (prevInteg?.direction === 'bidirectional') return true;
        }
    }

    // Integration direction change from bidirectional to something else
    for (const nextInteg of next.integrations) {
        const prevInteg = previous.integrations.find((i) => i.systemName === nextInteg.systemName);
        if (prevInteg?.direction === 'bidirectional' && nextInteg.direction !== 'bidirectional') {
            return true;
        }
    }

    // Any reclassification is potentially breaking
    if (reclassifiedNodes.length > 0) return true;

    return false;
}
