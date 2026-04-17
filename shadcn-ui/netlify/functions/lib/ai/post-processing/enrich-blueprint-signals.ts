/**
 * Deterministic enrichment module for Project Technical Blueprint.
 *
 * Computes structural signals (objective graph metrics), estimation signals
 * (heuristic derivations), recurring patterns, and a blueprint-level
 * estimation context — all from the normalized blueprint data.
 *
 * NO AI calls. Pure deterministic computation.
 */

import type {
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintWorkflow,
    BlueprintRelation,
    BlueprintConstraint,
    BlueprintExtensionPoint,
    BlueprintRecurringPattern,
    BlueprintEstimationContext,
    NodeStructuralSignals,
    NodeEstimationSignals,
    EvidenceRef,
    BlueprintComponentType,
} from '../../domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichmentInput {
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    workflows: BlueprintWorkflow[];
    relations: BlueprintRelation[];
    constraints: BlueprintConstraint[];
    extensionPoints: BlueprintExtensionPoint[];
}

export interface EnrichmentResult {
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    workflows: BlueprintWorkflow[];
    estimationContext: BlueprintEstimationContext;
}

/**
 * Main enrichment entry point.
 * Takes normalized blueprint data and returns the same structures
 * decorated with structural + estimation signals, plus a
 * blueprint-level estimation context.
 */
export function enrichBlueprintSignals(input: EnrichmentInput): EnrichmentResult {
    const { relations, workflows, constraints, extensionPoints } = input;

    // ── Enrich components ───────────────────────────────────────────
    const components = input.components.map((c) => {
        const nodeId = c.id ?? c.name;
        const structural = computeNodeStructuralSignals(
            nodeId, c.name, c.evidence, relations, workflows,
        );
        const estimation = computeNodeEstimationSignals(
            c.type, c.confidence, c.businessCriticality, structural,
        );
        return { ...c, structuralSignals: structural, estimationSignals: estimation };
    });

    // ── Enrich data domains ─────────────────────────────────────────
    const dataDomains = input.dataDomains.map((d) => {
        const nodeId = d.id ?? d.name;
        const structural = computeNodeStructuralSignals(
            nodeId, d.name, d.evidence, relations, workflows,
        );
        // Data domains use 'database' as a proxy type for estimation heuristics
        const estimation = computeNodeEstimationSignals(
            'database', d.confidence, d.businessCriticality, structural,
        );
        return { ...d, structuralSignals: structural, estimationSignals: estimation };
    });

    // ── Enrich integrations ─────────────────────────────────────────
    const integrations = input.integrations.map((i) => {
        const nodeId = i.id ?? i.systemName;
        const structural = computeNodeStructuralSignals(
            nodeId, i.systemName, i.evidence, relations, workflows,
        );
        const estimation = computeNodeEstimationSignals(
            'integration', i.confidence, i.businessCriticality, structural,
        );
        return { ...i, structuralSignals: structural, estimationSignals: estimation };
    });

    // ── Enrich workflows ────────────────────────────────────────────
    const enrichedWorkflows = input.workflows.map((w) => {
        const nodeId = w.id ?? w.name;
        const structural = computeNodeStructuralSignals(
            nodeId, w.name, w.evidence, relations, workflows,
        );
        // Workflows don't have a component type — use 'other'
        const estimation = computeNodeEstimationSignals(
            'other', w.confidence, w.businessCriticality, structural,
        );
        return { ...w, structuralSignals: structural, estimationSignals: estimation };
    });

    // ── Recurring patterns ──────────────────────────────────────────
    const recurringPatterns = computeRecurringPatterns(input.workflows, input.components);

    // ── Blueprint-level estimation context ───────────────────────────
    const allNodes = [
        ...components.map((c) => ({ name: c.name, estimation: c.estimationSignals })),
        ...dataDomains.map((d) => ({ name: d.name, estimation: d.estimationSignals })),
        ...integrations.map((i) => ({ name: i.systemName, estimation: i.estimationSignals })),
    ];

    const estimationContext = computeEstimationContext(
        allNodes,
        constraints,
        extensionPoints,
        recurringPatterns,
        input.integrations,
        input.workflows,
        relations,
        components.length + dataDomains.length + integrations.length,
    );

    return {
        components,
        dataDomains,
        integrations,
        workflows: enrichedWorkflows,
        estimationContext,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural signal computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute objective structural metrics for a single blueprint node.
 */
export function computeNodeStructuralSignals(
    nodeId: string,
    nodeName: string,
    evidence: EvidenceRef[] | undefined,
    relations: BlueprintRelation[],
    workflows: BlueprintWorkflow[],
): NodeStructuralSignals {
    const relationsCount = relations.filter(
        (r) => r.fromNodeId === nodeId || r.toNodeId === nodeId,
    ).length;

    const couplingDegree: NodeStructuralSignals['couplingDegree'] =
        relationsCount <= 2 ? 'loose' :
            relationsCount <= 5 ? 'moderate' :
                'tight';

    const evidenceLength = evidence?.length ?? 0;
    const documentationCoverage: NodeStructuralSignals['documentationCoverage'] =
        evidenceLength >= 2 ? 'good' :
            evidenceLength === 1 ? 'partial' :
                'missing';

    const normalizedName = nodeName.toLowerCase().trim();
    const workflowParticipation = workflows.filter((w) =>
        (w.involvedComponents ?? []).some(
            (ref) => ref === nodeId || ref.toLowerCase().trim() === normalizedName,
        ) ||
        (w.involvedDataDomains ?? []).some(
            (ref) => ref === nodeId || ref.toLowerCase().trim() === normalizedName,
        ),
    ).length;

    return { relationsCount, couplingDegree, documentationCoverage, workflowParticipation };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation signal computation
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_COST_TYPES: ReadonlySet<string> = new Set([
    'database', 'security', 'infrastructure', 'middleware',
]);

const LOW_COST_TYPES: ReadonlySet<string> = new Set([
    'page', 'form', 'component_library', 'data_grid', 'pcf_control',
]);

const REUSABLE_TYPES: ReadonlySet<string> = new Set([
    'service_layer', 'component_library', 'custom_connector', 'repository', 'api_controller',
]);

/**
 * Derive estimation-relevant heuristics from structural signals + node metadata.
 * Degrades gracefully when optional fields (confidence, businessCriticality) are absent.
 */
export function computeNodeEstimationSignals(
    nodeType: BlueprintComponentType | string,
    confidence: number | undefined | null,
    businessCriticality: string | undefined | null,
    structural: NodeStructuralSignals,
): NodeEstimationSignals {
    const { couplingDegree, documentationCoverage, relationsCount, workflowParticipation } = structural;

    // ── modificationCost ────────────────────────────────────────────
    let modificationCost: NodeEstimationSignals['modificationCost'] = 'medium';

    if (
        couplingDegree === 'tight' ||
        HIGH_COST_TYPES.has(nodeType) ||
        (businessCriticality === 'high' && couplingDegree !== 'loose')
    ) {
        modificationCost = 'high';
    } else if (
        couplingDegree === 'loose' &&
        LOW_COST_TYPES.has(nodeType) &&
        confidence != null && confidence >= 0.7
    ) {
        modificationCost = 'low';
    }

    // ── fragile ─────────────────────────────────────────────────────
    let fragile = false;
    if (confidence != null && confidence < 0.5 && couplingDegree !== 'loose') {
        fragile = true;
    } else if (documentationCoverage === 'missing' && couplingDegree === 'tight') {
        fragile = true;
    }

    // ── reusable ────────────────────────────────────────────────────
    const reusable =
        couplingDegree === 'loose' &&
        workflowParticipation >= 2 &&
        REUSABLE_TYPES.has(nodeType);

    // ── changeSurface ───────────────────────────────────────────────
    const changeSurface = relationsCount;

    return { modificationCost, fragile, reusable, changeSurface };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recurring patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect recurring implementation patterns from workflow/component overlaps.
 * Returns at most 5 patterns.
 */
export function computeRecurringPatterns(
    workflows: BlueprintWorkflow[],
    components: BlueprintComponent[],
): BlueprintRecurringPattern[] {
    const patterns: BlueprintRecurringPattern[] = [];

    // Pattern 1: Cross-component clusters — pairs of workflows sharing ≥2 components
    for (let i = 0; i < workflows.length; i++) {
        for (let j = i + 1; j < workflows.length; j++) {
            const a = new Set(workflows[i].involvedComponents ?? []);
            const shared = (workflows[j].involvedComponents ?? []).filter((c) => a.has(c));
            if (shared.length >= 2) {
                patterns.push({
                    name: `Cross-component cluster: ${shared.join(', ')}`,
                    description: `Workflows "${workflows[i].name}" and "${workflows[j].name}" share ${shared.length} components`,
                    involvedNodeIds: shared,
                    typicalEffort: 'medium',
                });
            }
        }
    }

    // Pattern 2: Central hubs — components appearing in >50% of workflows
    if (workflows.length >= 2) {
        const threshold = workflows.length / 2;
        for (const comp of components) {
            const compId = comp.id ?? comp.name;
            const compName = comp.name.toLowerCase().trim();
            const count = workflows.filter((w) =>
                (w.involvedComponents ?? []).some(
                    (ref) => ref === compId || ref.toLowerCase().trim() === compName,
                ),
            ).length;
            if (count > threshold) {
                patterns.push({
                    name: `Central hub: ${comp.name}`,
                    description: `Appears in ${count}/${workflows.length} workflows`,
                    involvedNodeIds: [compId],
                    typicalEffort: 'high',
                });
            }
        }
    }

    return patterns.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint-level estimation context
// ─────────────────────────────────────────────────────────────────────────────

interface EnrichedNodeSummary {
    name: string;
    estimation: NodeEstimationSignals;
}

/**
 * Compute the blueprint-level estimation context from all enriched nodes.
 */
export function computeEstimationContext(
    allNodes: EnrichedNodeSummary[],
    constraints: BlueprintConstraint[],
    extensionPoints: BlueprintExtensionPoint[],
    recurringPatterns: BlueprintRecurringPattern[],
    integrations: BlueprintIntegration[],
    workflows: BlueprintWorkflow[],
    relations: BlueprintRelation[],
    totalNodeCount: number,
): BlueprintEstimationContext {
    // ── coordinationCost ────────────────────────────────────────────
    let coordinationCost: BlueprintEstimationContext['coordinationCost'] = 'medium';
    if (integrations.length >= 4 && (workflows.length >= 3 || relations.length >= 10)) {
        coordinationCost = 'high';
    } else if (integrations.length <= 1 && workflows.length <= 1) {
        coordinationCost = 'low';
    }

    // ── overallFragility ────────────────────────────────────────────
    const fragileCount = allNodes.filter((n) => n.estimation.fragile).length;
    const fragileRatio = totalNodeCount > 0 ? fragileCount / totalNodeCount : 0;
    let overallFragility: BlueprintEstimationContext['overallFragility'] = 'medium';
    if (fragileRatio > 0.4) {
        overallFragility = 'high';
    } else if (fragileRatio < 0.15 || totalNodeCount === 0) {
        overallFragility = 'low';
    }

    // ── integrationDensity ──────────────────────────────────────────
    const integrationDensity = totalNodeCount > 0
        ? Math.round((relations.length / totalNodeCount) * 100) / 100
        : 0;

    // ── signalsDegraded ─────────────────────────────────────────────
    const signalsDegraded = relations.length < 3;

    // ── area lists ──────────────────────────────────────────────────
    const highCostAreas = allNodes
        .filter((n) => n.estimation.modificationCost === 'high')
        .map((n) => n.name);
    const fragileAreas = allNodes
        .filter((n) => n.estimation.fragile)
        .map((n) => n.name);
    const reusableCapabilities = allNodes
        .filter((n) => n.estimation.reusable)
        .map((n) => n.name);

    return {
        coordinationCost,
        overallFragility,
        integrationDensity,
        highCostAreas,
        fragileAreas,
        reusableCapabilities,
        constraints,
        extensionPoints,
        recurringPatterns,
        signalsDegraded,
    };
}
