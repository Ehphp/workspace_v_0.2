/**
 * Project Knowledge Layer - deterministic retrieval over ProjectTechnicalBlueprint.
 */

import { buildBlueprintSearchEntries } from './blueprint-search-text';
import type { PipelineLayer } from '../pipeline/pipeline-domain';
import type {
    DeriveProjectKnowledgeInput,
    KnowledgeNode,
    KnowledgeNodeKind,
    KnowledgeRelation,
    KnowledgeScoredNode,
    KnowledgeSelectionReason,
    ProjectKnowledgeSnapshot,
    RelevantProjectContext,
} from './project-knowledge-layer.types';
import type { ProjectTechnicalBlueprint } from './project-technical-blueprint.types';

const DEFAULT_MAX_PER_KIND = {
    component: 4,
    integration: 3,
    dataDomain: 3,
    workflow: 2,
};

function tokenize(input: string): string[] {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u00FF]+/gi, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 3);
}

function overlapScore(queryTerms: string[], targetTerms: string[]): number {
    if (queryTerms.length === 0 || targetTerms.length === 0) return 0;
    const target = new Set(targetTerms);
    let matches = 0;
    for (const q of queryTerms) {
        if (target.has(q)) matches += 1;
    }
    return matches / queryTerms.length;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function inferLayerFromType(type?: string): PipelineLayer | undefined {
    const normalized = String(type || '').toLowerCase();
    if (!normalized) return undefined;

    if (['frontend', 'canvas_app', 'model_driven_app', 'page', 'form', 'component_library', 'data_grid'].includes(normalized)) return 'frontend';
    if (['backend', 'api_controller', 'service_layer', 'repository', 'middleware', 'logic', 'state_manager'].includes(normalized)) return 'logic';
    if (['database', 'dataverse_table'].includes(normalized)) return 'data';
    if (['integration', 'external_system', 'custom_connector'].includes(normalized)) return 'integration';
    if (['workflow', 'cloud_flow', 'power_automate_desktop', 'scheduled_job', 'queue_processor'].includes(normalized)) return 'automation';
    if (['security', 'infrastructure', 'configuration'].includes(normalized)) return 'configuration';
    return undefined;
}

function toProjectTechnicalBlueprint(raw: Record<string, unknown> | null | undefined): ProjectTechnicalBlueprint | null {
    if (!raw || typeof raw !== 'object') return null;

    const components = Array.isArray(raw.components) ? raw.components : [];
    const integrations = Array.isArray(raw.integrations) ? raw.integrations : [];
    const dataDomains = Array.isArray(raw.dataDomains) ? raw.dataDomains : [];
    const workflows = Array.isArray(raw.workflows) ? raw.workflows : [];
    const relations = Array.isArray(raw.relations) ? raw.relations : [];

    if (components.length === 0 && integrations.length === 0 && dataDomains.length === 0 && workflows.length === 0) {
        return null;
    }

    return {
        projectId: String(raw.projectId || 'runtime'),
        version: Number(raw.version || 0),
        sourceText: typeof raw.sourceText === 'string' ? raw.sourceText : undefined,
        summary: typeof raw.summary === 'string' ? raw.summary : undefined,
        components: components as any,
        integrations: integrations as any,
        dataDomains: dataDomains as any,
        workflows: workflows as any,
        architecturalNotes: (Array.isArray(raw.architecturalNotes) ? raw.architecturalNotes : []) as any,
        assumptions: (Array.isArray(raw.assumptions) ? raw.assumptions : []) as any,
        missingInformation: (Array.isArray(raw.missingInformation) ? raw.missingInformation : []) as any,
        relations: relations as any,
        coverage: typeof raw.coverage === 'number' ? raw.coverage : undefined,
        qualityFlags: (Array.isArray(raw.qualityFlags) ? raw.qualityFlags : []) as any,
        qualityScore: typeof raw.qualityScore === 'number' ? raw.qualityScore : undefined,
        estimationContext: (raw.estimationContext && typeof raw.estimationContext === 'object') ? raw.estimationContext as any : undefined,
    };
}

export function normalizeProjectTechnicalBlueprintToKnowledgeSnapshot(
    raw: Record<string, unknown> | null | undefined,
): ProjectKnowledgeSnapshot | null {
    const ptb = toProjectTechnicalBlueprint(raw);
    if (!ptb) return null;

    const searchEntries = buildBlueprintSearchEntries(ptb);
    const byNodeId = new Map<string, string>();
    for (const entry of searchEntries) {
        if (entry.kind === 'component' || entry.kind === 'integration' || entry.kind === 'data_domain') {
            byNodeId.set(entry.nodeId, entry.searchText);
        }
    }

    const nodes: KnowledgeNode[] = [];

    for (const c of ptb.components) {
        const nodeId = c.id ?? `cmp_${c.name}`;
        nodes.push({
            nodeId,
            kind: 'component',
            label: c.name,
            description: c.description,
            aliases: Array.isArray(c.aliases) ? c.aliases : [],
            searchText: byNodeId.get(nodeId) ?? c.name,
            layer: inferLayerFromType(c.type),
            confidence: c.confidence,
            businessCriticality: c.businessCriticality,
            hasEvidence: Array.isArray(c.evidence) && c.evidence.length > 0,
        });
    }

    for (const i of ptb.integrations) {
        const nodeId = i.id ?? `int_${i.systemName}`;
        nodes.push({
            nodeId,
            kind: 'integration',
            label: i.systemName,
            description: i.description,
            aliases: Array.isArray(i.aliases) ? i.aliases : [],
            searchText: byNodeId.get(nodeId) ?? i.systemName,
            layer: 'integration',
            confidence: i.confidence,
            businessCriticality: i.businessCriticality,
            hasEvidence: Array.isArray(i.evidence) && i.evidence.length > 0,
        });
    }

    for (const d of ptb.dataDomains) {
        const nodeId = d.id ?? `dom_${d.name}`;
        nodes.push({
            nodeId,
            kind: 'data_domain',
            label: d.name,
            description: d.description,
            aliases: Array.isArray(d.aliases) ? d.aliases : [],
            searchText: byNodeId.get(nodeId) ?? d.name,
            layer: 'data',
            confidence: d.confidence,
            businessCriticality: d.businessCriticality,
            hasEvidence: Array.isArray(d.evidence) && d.evidence.length > 0,
        });
    }

    for (const w of ptb.workflows ?? []) {
        nodes.push({
            nodeId: w.id ?? `wf_${w.name}`,
            kind: 'workflow',
            label: w.name,
            description: [w.description, w.trigger].filter(Boolean).join(' - '),
            aliases: Array.isArray(w.aliases) ? w.aliases : [],
            searchText: `${w.name}. ${w.trigger}. ${w.steps?.map(s => s.action).join(' ') || ''}`,
            layer: 'automation',
            confidence: w.confidence,
            businessCriticality: w.businessCriticality,
            hasEvidence: Array.isArray(w.evidence) && w.evidence.length > 0,
        });
    }

    const relations: KnowledgeRelation[] = (ptb.relations ?? []).map(r => ({
        id: r.id,
        fromNodeId: r.fromNodeId,
        toNodeId: r.toNodeId,
        type: r.type,
        confidence: r.confidence,
    }));

    const qualityFlags = [...(ptb.qualityFlags ?? [])];
    if (relations.length === 0) {
        qualityFlags.push('no_relations_available');
    }

    return {
        nodes,
        relations,
        qualityFlags,
        estimationSignals: {
            highCostAreas: ptb.estimationContext?.highCostAreas ?? [],
            fragileAreas: ptb.estimationContext?.fragileAreas ?? [],
            reusableCapabilities: ptb.estimationContext?.reusableCapabilities ?? [],
            signalsDegraded: ptb.estimationContext?.signalsDegraded === true,
        },
    };
}

function collectQueryTerms(input: DeriveProjectKnowledgeInput): string[] {
    const chunks: string[] = [input.requirementDescription || ''];

    const ru = input.requirementUnderstanding as any;
    if (ru) {
        if (Array.isArray(ru.functionalPerimeter)) chunks.push(ru.functionalPerimeter.join(' '));
        if (typeof ru.businessObjective === 'string') chunks.push(ru.businessObjective);
        if (typeof ru.expectedOutput === 'string') chunks.push(ru.expectedOutput);
    }

    const im = input.impactMap as any;
    if (im) {
        if (Array.isArray(im.impacts)) {
            for (const impact of im.impacts) {
                if (Array.isArray(impact?.components)) chunks.push(impact.components.join(' '));
                if (typeof impact?.reason === 'string') chunks.push(impact.reason);
            }
        }
    }

    const eb = input.estimationBlueprint as any;
    if (eb) {
        if (Array.isArray(eb.components)) {
            chunks.push(eb.components.map((c: any) => c?.name || '').join(' '));
        }
        if (typeof eb.summary === 'string') chunks.push(eb.summary);
    }

    return tokenize(chunks.join(' '));
}

function collectExpectedLayers(input: DeriveProjectKnowledgeInput): Set<PipelineLayer> {
    const layers = new Set<PipelineLayer>();

    const im = input.impactMap as any;
    if (im && Array.isArray(im.impacts)) {
        for (const impact of im.impacts) {
            const layer = String(impact?.layer || '');
            if (['frontend', 'logic', 'data', 'integration', 'automation', 'configuration'].includes(layer)) {
                layers.add(layer as PipelineLayer);
            }
        }
    }

    const eb = input.estimationBlueprint as any;
    if (eb && Array.isArray(eb.components)) {
        for (const c of eb.components) {
            const layer = String(c?.layer || '');
            if (['frontend', 'logic', 'data', 'integration', 'automation', 'configuration'].includes(layer)) {
                layers.add(layer as PipelineLayer);
            }
        }
    }

    return layers;
}

function scoreNode(
    node: KnowledgeNode,
    queryTerms: string[],
    expectedLayers: Set<PipelineLayer>,
    snapshot: ProjectKnowledgeSnapshot,
): { score: number; reasons: KnowledgeSelectionReason[] } {
    const reasons: KnowledgeSelectionReason[] = [];

    const nameScore = overlapScore(queryTerms, tokenize(node.label));
    const aliasScore = overlapScore(queryTerms, tokenize(node.aliases.join(' ')));
    const searchScore = overlapScore(queryTerms, tokenize(node.searchText));
    const workflowScore = node.kind === 'workflow' ? searchScore : 0;

    let layerScore = 0;
    if (node.layer && expectedLayers.has(node.layer)) {
        layerScore = 1;
    }

    let estimationBoost = 0;
    const nodeLabel = node.label.toLowerCase();
    if (snapshot.estimationSignals.highCostAreas.some(a => nodeLabel.includes(String(a).toLowerCase()))) estimationBoost = Math.max(estimationBoost, 1);
    if (snapshot.estimationSignals.fragileAreas.some(a => nodeLabel.includes(String(a).toLowerCase()))) estimationBoost = Math.max(estimationBoost, 0.8);
    if (snapshot.estimationSignals.reusableCapabilities.some(a => nodeLabel.includes(String(a).toLowerCase()))) estimationBoost = Math.max(estimationBoost, 0.6);

    let qualityPenalty = 0;
    if (!node.hasEvidence) qualityPenalty += 0.5;
    if (typeof node.confidence === 'number' && node.confidence < 0.5) qualityPenalty += 0.3;

    if (nameScore > 0) reasons.push('name_match');
    if (aliasScore > 0) reasons.push('alias_match');
    if (searchScore > 0) reasons.push('search_text_overlap');
    if (workflowScore > 0) reasons.push('workflow_match');
    if (layerScore > 0) reasons.push('layer_overlap');
    if (estimationBoost > 0) reasons.push('estimation_signal_boost');
    if (qualityPenalty > 0) reasons.push('quality_penalty');

    const raw =
        (nameScore * 0.30) +
        (aliasScore * 0.20) +
        (searchScore * 0.20) +
        (workflowScore * 0.10) +
        (layerScore * 0.10) +
        (estimationBoost * 0.10) -
        (qualityPenalty * 0.05);

    return {
        score: clamp01(raw),
        reasons,
    };
}

function applyRelationProximity(
    scored: KnowledgeScoredNode[],
    snapshot: ProjectKnowledgeSnapshot,
): KnowledgeScoredNode[] {
    const hasNoRelations = snapshot.qualityFlags.includes('no_relations_available');
    if (hasNoRelations || snapshot.relations.length === 0) {
        return scored.map(s => {
            if (!s.reasons.includes('no_relations_available')) {
                s.reasons.push('no_relations_available');
            }
            return s;
        });
    }

    const topNodeIds = new Set(
        [...scored]
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(4, scored.length))
            .map(s => s.node.nodeId),
    );

    for (const item of scored) {
        const related = snapshot.relations.some(r =>
            (r.fromNodeId === item.node.nodeId && topNodeIds.has(r.toNodeId)) ||
            (r.toNodeId === item.node.nodeId && topNodeIds.has(r.fromNodeId))
        );
        if (related) {
            item.score = clamp01(item.score + 0.05);
            if (!item.reasons.includes('relation_proximity')) {
                item.reasons.push('relation_proximity');
            }
        }
    }

    return scored;
}

function topByKind(items: KnowledgeScoredNode[], kind: KnowledgeNodeKind, limit: number): KnowledgeScoredNode[] {
    return items
        .filter(i => i.node.kind === kind)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function applyFallback(items: KnowledgeScoredNode[]): KnowledgeScoredNode[] {
    if (items.length > 0) return items;
    return [];
}

export function deriveProjectKnowledgeContext(input: DeriveProjectKnowledgeInput): RelevantProjectContext {
    const snapshot = normalizeProjectTechnicalBlueprintToKnowledgeSnapshot(input.projectTechnicalBlueprint);

    const neutral: RelevantProjectContext = {
        queryTerms: tokenize(input.requirementDescription || ''),
        selected: {
            components: [],
            integrations: [],
            dataDomains: [],
            workflows: [],
            relations: [],
        },
        warnings: [],
        qualityFlags: [],
        retrievalConfidence: 0,
        retrievalCoverage: 0,
        weakMatch: true,
    };

    if (!snapshot) {
        neutral.warnings.push('invalid_ptb_input');
        neutral.qualityFlags.push('invalid_ptb_input');
        return neutral;
    }

    const queryTerms = collectQueryTerms(input);
    const expectedLayers = collectExpectedLayers(input);
    const maxPerKind = {
        ...DEFAULT_MAX_PER_KIND,
        ...(input.maxPerKind || {}),
    };

    let scored: KnowledgeScoredNode[] = snapshot.nodes.map(node => {
        const base = scoreNode(node, queryTerms, expectedLayers, snapshot);
        return {
            node,
            score: base.score,
            reasons: base.reasons,
        };
    });

    scored = applyRelationProximity(scored, snapshot);

    let components = topByKind(scored, 'component', maxPerKind.component);
    let integrations = topByKind(scored, 'integration', maxPerKind.integration);
    let dataDomains = topByKind(scored, 'data_domain', maxPerKind.dataDomain);
    let workflows = topByKind(scored, 'workflow', maxPerKind.workflow);

    // Fallback: keep deterministic context even when lexical recall is low.
    if (components.length === 0) {
        components = scored
            .filter(s => s.node.kind === 'component')
            .sort((a, b) => {
                const criticalityRank = { high: 3, medium: 2, low: 1 } as Record<string, number>;
                const cA = criticalityRank[s.node.businessCriticality || 'low'] || 0;
                const cB = criticalityRank[b.node.businessCriticality || 'low'] || 0;
                if (cA !== cB) return cB - cA;
                return (b.node.confidence || 0) - (a.node.confidence || 0);
            })
            .slice(0, maxPerKind.component)
            .map(s => ({ ...s, reasons: [...new Set([...s.reasons, 'fallback_criticality', 'fallback_confidence'])] }));
    }

    integrations = applyFallback(integrations);
    dataDomains = applyFallback(dataDomains);
    workflows = applyFallback(workflows);

    const selectedAll = [...components, ...integrations, ...dataDomains, ...workflows];
    const topScore = selectedAll.length > 0 ? Math.max(...selectedAll.map(s => s.score)) : 0;
    const retrievalConfidence = selectedAll.length > 0
        ? selectedAll.reduce((sum, s) => sum + s.score, 0) / selectedAll.length
        : 0;

    const availableKinds = new Set(snapshot.nodes.map(n => n.kind));
    const coveredKinds = new Set(selectedAll.map(n => n.node.kind));
    const expectedKindCount = ['component', 'integration', 'data_domain', 'workflow'].filter(k => availableKinds.has(k as KnowledgeNodeKind)).length;
    const retrievalCoverage = expectedKindCount > 0
        ? coveredKinds.size / expectedKindCount
        : 0;

    const weakMatch = topScore < 0.30 || selectedAll.length < 2;

    const selectedNodeIds = new Set(selectedAll.map(s => s.node.nodeId));
    const selectedRelations = snapshot.relations.filter(r => selectedNodeIds.has(r.fromNodeId) && selectedNodeIds.has(r.toNodeId));

    const warnings: string[] = [];
    if (snapshot.qualityFlags.includes('no_relations_available')) {
        warnings.push('relationProximity_disabled_no_relations_available');
    }
    if (weakMatch) {
        warnings.push('weak_match_low_retrieval_confidence');
    }
    if (snapshot.estimationSignals.signalsDegraded) {
        warnings.push('estimation_signals_degraded');
    }

    return {
        queryTerms,
        selected: {
            components,
            integrations,
            dataDomains,
            workflows,
            relations: selectedRelations,
        },
        warnings,
        qualityFlags: snapshot.qualityFlags,
        retrievalConfidence: Number(retrievalConfidence.toFixed(3)),
        retrievalCoverage: Number(retrievalCoverage.toFixed(3)),
        weakMatch,
    };
}
