/**
 * blueprint-search-text.ts — Generate search texts for blueprint nodes
 *
 * Produces plain-text representations of blueprint components, data domains,
 * integrations, and relations suitable for:
 *   - Embedding generation (vector search)
 *   - Full-text search in the blueprint tab
 *   - Matching requirements ↔ blueprint parts
 *
 * Pure function. No side effects.
 */

import type {
    ProjectTechnicalBlueprint,
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintRelation,
} from './project-technical-blueprint.types';

// ─── Output type ────────────────────────────────────────────────

export interface BlueprintSearchEntry {
    /** Domain node ID (e.g. cmp_xxx, dom_xxx, int_xxx) */
    nodeId: string;
    /** Human-readable kind */
    kind: 'component' | 'data_domain' | 'integration' | 'relation';
    /** Display label */
    label: string;
    /** Search text for embedding / full-text matching */
    searchText: string;
}

// ─── Main entry point ───────────────────────────────────────────

/**
 * Generate searchable text entries for all nodes and relations in a blueprint.
 */
export function buildBlueprintSearchEntries(
    blueprint: ProjectTechnicalBlueprint,
): BlueprintSearchEntry[] {
    const entries: BlueprintSearchEntry[] = [];

    for (const comp of blueprint.components) {
        entries.push({
            nodeId: comp.id ?? `cmp_${slugify(comp.name)}`,
            kind: 'component',
            label: comp.name,
            searchText: buildComponentSearchText(comp),
        });
    }

    for (const dd of blueprint.dataDomains) {
        entries.push({
            nodeId: dd.id ?? `dom_${slugify(dd.name)}`,
            kind: 'data_domain',
            label: dd.name,
            searchText: buildDataDomainSearchText(dd),
        });
    }

    for (const integ of blueprint.integrations) {
        entries.push({
            nodeId: integ.id ?? `int_${slugify(integ.systemName)}`,
            kind: 'integration',
            label: integ.systemName,
            searchText: buildIntegrationSearchText(integ),
        });
    }

    for (const rel of blueprint.relations ?? []) {
        entries.push({
            nodeId: rel.id,
            kind: 'relation',
            label: `${rel.fromNodeId} → ${rel.toNodeId}`,
            searchText: buildRelationSearchText(rel, blueprint),
        });
    }

    return entries;
}

// ─── Individual builders ────────────────────────────────────────

function buildComponentSearchText(comp: BlueprintComponent): string {
    const parts: string[] = [
        `Component: ${comp.name}`,
        `Type: ${comp.type}`,
    ];
    if (comp.description) parts.push(comp.description);
    if (comp.businessCriticality) parts.push(`Business criticality: ${comp.businessCriticality}`);
    if (comp.estimationImpact) parts.push(`Estimation impact: ${comp.estimationImpact}`);
    if (comp.evidence?.length) {
        parts.push('Evidence: ' + comp.evidence.map((e) => e.snippet).join(' | '));
    }
    return parts.join('. ');
}

function buildDataDomainSearchText(dd: BlueprintDataDomain): string {
    const parts: string[] = [
        `Data domain: ${dd.name}`,
    ];
    if (dd.description) parts.push(dd.description);
    if (dd.businessCriticality) parts.push(`Business criticality: ${dd.businessCriticality}`);
    if (dd.evidence?.length) {
        parts.push('Evidence: ' + dd.evidence.map((e) => e.snippet).join(' | '));
    }
    return parts.join('. ');
}

function buildIntegrationSearchText(integ: BlueprintIntegration): string {
    const parts: string[] = [
        `External system: ${integ.systemName}`,
        `Direction: ${integ.direction ?? 'unknown'}`,
    ];
    if (integ.description) parts.push(integ.description);
    if (integ.protocol) parts.push(`Protocol: ${integ.protocol}`);
    if (integ.businessCriticality) parts.push(`Business criticality: ${integ.businessCriticality}`);
    if (integ.evidence?.length) {
        parts.push('Evidence: ' + integ.evidence.map((e) => e.snippet).join(' | '));
    }
    return parts.join('. ');
}

function buildRelationSearchText(
    rel: BlueprintRelation,
    blueprint: ProjectTechnicalBlueprint,
): string {
    const fromLabel = resolveNodeLabel(rel.fromNodeId, blueprint);
    const toLabel = resolveNodeLabel(rel.toNodeId, blueprint);
    const parts: string[] = [
        `Relation: ${fromLabel} ${rel.type} ${toLabel}`,
    ];
    if (rel.evidence?.length) {
        parts.push('Evidence: ' + rel.evidence.map((e) => e.snippet).join(' | '));
    }
    return parts.join('. ');
}

// ─── Helpers ────────────────────────────────────────────────────

function resolveNodeLabel(nodeId: string, bp: ProjectTechnicalBlueprint): string {
    for (const c of bp.components) {
        if (c.id === nodeId) return c.name;
    }
    for (const d of bp.dataDomains) {
        if (d.id === nodeId) return d.name;
    }
    for (const i of bp.integrations) {
        if (i.id === nodeId) return i.systemName;
    }
    return nodeId;
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 40);
}
