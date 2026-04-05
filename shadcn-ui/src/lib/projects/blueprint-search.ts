/**
 * blueprint-search.ts — Client-side full-text search for blueprint nodes
 *
 * Provides fast substring-based search across components, data domains,
 * integrations, and relations. No embeddings required — runs entirely
 * in the browser for instant results.
 *
 * For future vector search, the corresponding search text entries can be
 * pre-computed via buildBlueprintSearchEntries() and embedded server-side.
 */

import type {
    ProjectTechnicalBlueprint,
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintRelation,
} from '@/types/project-technical-blueprint';

// ─── Types ──────────────────────────────────────────────────────

export interface BlueprintSearchResult {
    nodeId: string;
    kind: 'component' | 'data_domain' | 'integration' | 'relation';
    label: string;
    /** Graph node id (comp-0, dd-1, etc.) for cross-referencing with the graph */
    graphNodeId?: string;
    /** Index in the source array */
    sourceIndex: number;
    /** Matching context snippet */
    matchSnippet: string;
    /** Relevance score (0–1) */
    score: number;
}

// ─── Main search function ───────────────────────────────────────

/**
 * Search across all blueprint nodes and relations.
 *
 * Uses case-insensitive substring matching across name, description,
 * type, evidence snippets, and relation types.
 */
export function searchBlueprint(
    blueprint: ProjectTechnicalBlueprint,
    query: string,
): BlueprintSearchResult[] {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];

    const results: BlueprintSearchResult[] = [];

    // Components
    blueprint.components.forEach((comp, i) => {
        const score = scoreComponent(comp, q);
        if (score > 0) {
            results.push({
                nodeId: comp.id ?? `cmp_${i}`,
                kind: 'component',
                label: comp.name,
                graphNodeId: `comp-${i}`,
                sourceIndex: i,
                matchSnippet: findMatchSnippet(comp, q),
                score,
            });
        }
    });

    // Data Domains
    blueprint.dataDomains.forEach((dd, i) => {
        const score = scoreDataDomain(dd, q);
        if (score > 0) {
            results.push({
                nodeId: dd.id ?? `dom_${i}`,
                kind: 'data_domain',
                label: dd.name,
                graphNodeId: `dd-${i}`,
                sourceIndex: i,
                matchSnippet: findMatchSnippetDD(dd, q),
                score,
            });
        }
    });

    // Integrations
    blueprint.integrations.forEach((integ, i) => {
        const score = scoreIntegration(integ, q);
        if (score > 0) {
            results.push({
                nodeId: integ.id ?? `int_${i}`,
                kind: 'integration',
                label: integ.systemName,
                graphNodeId: `integ-${i}`,
                sourceIndex: i,
                matchSnippet: findMatchSnippetInteg(integ, q),
                score,
            });
        }
    });

    // Relations
    (blueprint.relations ?? []).forEach((rel, i) => {
        const score = scoreRelation(rel, q, blueprint);
        if (score > 0) {
            results.push({
                nodeId: rel.id,
                kind: 'relation',
                label: `${resolveLabel(rel.fromNodeId, blueprint)} → ${resolveLabel(rel.toNodeId, blueprint)}`,
                sourceIndex: i,
                matchSnippet: rel.type,
                score,
            });
        }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
}

// ─── Scoring functions ──────────────────────────────────────────

function scoreComponent(comp: BlueprintComponent, q: string): number {
    let score = 0;
    if (comp.name.toLowerCase().includes(q)) score += 1.0;
    if (comp.description?.toLowerCase().includes(q)) score += 0.6;
    if (comp.type.toLowerCase().includes(q)) score += 0.4;
    if (comp.evidence?.some((e) => e.snippet.toLowerCase().includes(q))) score += 0.3;
    return score;
}

function scoreDataDomain(dd: BlueprintDataDomain, q: string): number {
    let score = 0;
    if (dd.name.toLowerCase().includes(q)) score += 1.0;
    if (dd.description?.toLowerCase().includes(q)) score += 0.6;
    if (dd.evidence?.some((e) => e.snippet.toLowerCase().includes(q))) score += 0.3;
    return score;
}

function scoreIntegration(integ: BlueprintIntegration, q: string): number {
    let score = 0;
    if (integ.systemName.toLowerCase().includes(q)) score += 1.0;
    if (integ.description?.toLowerCase().includes(q)) score += 0.6;
    if (integ.protocol?.toLowerCase().includes(q)) score += 0.4;
    if (integ.direction?.toLowerCase().includes(q)) score += 0.3;
    if (integ.evidence?.some((e) => e.snippet.toLowerCase().includes(q))) score += 0.3;
    return score;
}

function scoreRelation(rel: BlueprintRelation, q: string, bp: ProjectTechnicalBlueprint): number {
    let score = 0;
    if (rel.type.toLowerCase().includes(q)) score += 0.8;
    const fromLabel = resolveLabel(rel.fromNodeId, bp).toLowerCase();
    const toLabel = resolveLabel(rel.toNodeId, bp).toLowerCase();
    if (fromLabel.includes(q)) score += 0.5;
    if (toLabel.includes(q)) score += 0.5;
    if (rel.evidence?.some((e) => e.snippet.toLowerCase().includes(q))) score += 0.3;
    return score;
}

// ─── Snippet helpers ────────────────────────────────────────────

function findMatchSnippet(comp: BlueprintComponent, q: string): string {
    if (comp.name.toLowerCase().includes(q)) return comp.name;
    if (comp.description?.toLowerCase().includes(q)) return truncate(comp.description, 80);
    if (comp.type.toLowerCase().includes(q)) return `Type: ${comp.type}`;
    const ev = comp.evidence?.find((e) => e.snippet.toLowerCase().includes(q));
    if (ev) return truncate(ev.snippet, 80);
    return comp.name;
}

function findMatchSnippetDD(dd: BlueprintDataDomain, q: string): string {
    if (dd.name.toLowerCase().includes(q)) return dd.name;
    if (dd.description?.toLowerCase().includes(q)) return truncate(dd.description, 80);
    const ev = dd.evidence?.find((e) => e.snippet.toLowerCase().includes(q));
    if (ev) return truncate(ev.snippet, 80);
    return dd.name;
}

function findMatchSnippetInteg(integ: BlueprintIntegration, q: string): string {
    if (integ.systemName.toLowerCase().includes(q)) return integ.systemName;
    if (integ.description?.toLowerCase().includes(q)) return truncate(integ.description, 80);
    if (integ.protocol?.toLowerCase().includes(q)) return `Protocol: ${integ.protocol}`;
    const ev = integ.evidence?.find((e) => e.snippet.toLowerCase().includes(q));
    if (ev) return truncate(ev.snippet, 80);
    return integ.systemName;
}

// ─── Utilities ──────────────────────────────────────────────────

function resolveLabel(nodeId: string, bp: ProjectTechnicalBlueprint): string {
    for (const c of bp.components) if (c.id === nodeId) return c.name;
    for (const d of bp.dataDomains) if (d.id === nodeId) return d.name;
    for (const i of bp.integrations) if (i.id === nodeId) return i.systemName;
    return nodeId;
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
