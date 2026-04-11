/**
 * Post-processing normalization for ProjectTechnicalBlueprint.
 *
 * Runs after AI generation to fix classification errors, deduplicate,
 * merge micro-components, validate structural constraints, stabilize
 * node IDs, validate relations, consolidate evidence, and produce
 * deterministic quality flags.
 *
 * Ensures the blueprint is consistent with the 3-column visualization:
 *   LEFT: Data Domains  |  CENTER: Components  |  RIGHT: Integrations
 */

import type {
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintComponentType,
    BlueprintRelation,
    EvidenceRef,
} from '../../domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface RawBlueprint {
    summary?: string | null;
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    relations?: BlueprintRelation[];
    coverage?: number;
    qualityFlags?: string[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence: number;
}

export interface NormalizationResult {
    blueprint: RawBlueprint;
    warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Max length for evidence snippets before truncation */
const MAX_SNIPPET_LENGTH = 200;

// ─────────────────────────────────────────────────────────────────────────────
// ID generation helpers
// ─────────────────────────────────────────────────────────────────────────────

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}

function generateNodeId(prefix: string, name: string): string {
    return `${prefix}${slugify(name)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw AI-generated blueprint.
 * Fixes classification errors, deduplicates, merges, validates,
 * stabilizes IDs, validates relations, consolidates evidence,
 * and produces deterministic quality flags.
 */
export function normalizeProjectTechnicalBlueprint(raw: RawBlueprint): NormalizationResult {
    const warnings: string[] = [];

    let components = [...raw.components];
    let dataDomains = [...raw.dataDomains];
    let integrations = [...raw.integrations];
    let relations = [...(raw.relations ?? [])];

    // ── Step 1: Reclassify misplaced components ─────────────────────
    const { kept, movedToIntegrations } = reclassifyComponents(components);
    components = kept;
    if (movedToIntegrations.length > 0) {
        integrations.push(...movedToIntegrations);
        warnings.push(
            `Reclassified ${movedToIntegrations.length} component(s) to integrations: ${movedToIntegrations.map((i) => i.systemName).join(', ')}`,
        );
    }

    // ── Step 2: Deduplicate across categories ───────────────────────
    const dedup = deduplicateAcrossCategories(components, dataDomains, integrations);
    if (dedup.removedCount > 0) {
        components = dedup.components;
        dataDomains = dedup.dataDomains;
        integrations = dedup.integrations;
        warnings.push(`Removed ${dedup.removedCount} duplicate(s) across categories`);
    }

    // ── Step 3: Semantic deduplication within categories ─────────────
    const compsBefore = components.length;
    components = semanticDeduplicateArray(components, (c) => c.name);
    if (components.length < compsBefore) {
        warnings.push(`Removed ${compsBefore - components.length} duplicate component(s)`);
    }

    const ddBefore = dataDomains.length;
    dataDomains = semanticDeduplicateArray(dataDomains, (d) => d.name);
    if (dataDomains.length < ddBefore) {
        warnings.push(`Removed ${ddBefore - dataDomains.length} duplicate data domain(s)`);
    }

    const integBefore = integrations.length;
    integrations = semanticDeduplicateArray(integrations, (i) => i.systemName);
    if (integrations.length < integBefore) {
        warnings.push(`Removed ${integBefore - integrations.length} duplicate integration(s)`);
    }

    // ── Step 4: Remove useless/generic nodes ────────────────────────
    const filteredComps = removeUselessNodes(components, (c) => c.name);
    if (filteredComps.removed.length > 0) {
        components = filteredComps.kept;
        warnings.push(`Removed generic component(s): ${filteredComps.removed.join(', ')}`);
    }

    const filteredDDs = removeUselessNodes(dataDomains, (d) => d.name);
    if (filteredDDs.removed.length > 0) {
        dataDomains = filteredDDs.kept;
        warnings.push(`Removed generic data domain(s): ${filteredDDs.removed.join(', ')}`);
    }

    const filteredIntegs = removeUselessNodes(integrations, (i) => i.systemName);
    if (filteredIntegs.removed.length > 0) {
        integrations = filteredIntegs.kept;
        warnings.push(`Removed generic integration(s): ${filteredIntegs.removed.join(', ')}`);
    }

    // ── Step 5: Stabilize node IDs ──────────────────────────────────
    components = components.map((c) => ({
        ...c,
        id: c.id || generateNodeId('cmp_', c.name),
    }));
    dataDomains = dataDomains.map((d) => ({
        ...d,
        id: d.id || generateNodeId('dom_', d.name),
    }));
    integrations = integrations.map((i) => ({
        ...i,
        id: i.id || generateNodeId('int_', i.systemName),
    }));

    // Build lookup of all valid node IDs and names
    const validNodeIds = new Set<string>();
    const nameToIdMap = new Map<string, string>();
    for (const c of components) {
        validNodeIds.add(c.id!);
        nameToIdMap.set(normalizeName(c.name), c.id!);
    }
    for (const d of dataDomains) {
        validNodeIds.add(d.id!);
        nameToIdMap.set(normalizeName(d.name), d.id!);
    }
    for (const i of integrations) {
        validNodeIds.add(i.id!);
        nameToIdMap.set(normalizeName(i.systemName), i.id!);
    }

    // ── Step 6: Validate & clean relations ──────────────────────────
    const relResult = validateRelations(relations, validNodeIds, nameToIdMap);
    relations = relResult.relations;
    if (relResult.removedCount > 0) {
        warnings.push(`Removed ${relResult.removedCount} invalid relation(s)`);
    }

    // ── Step 7: Consolidate evidence ────────────────────────────────
    components = components.map((c) => ({ ...c, evidence: consolidateEvidence(c.evidence) }));
    dataDomains = dataDomains.map((d) => ({ ...d, evidence: consolidateEvidence(d.evidence) }));
    integrations = integrations.map((i) => ({ ...i, evidence: consolidateEvidence(i.evidence) }));
    relations = relations.map((r) => ({ ...r, evidence: consolidateEvidence(r.evidence) }));

    // ── Step 8: Deterministic quality flags ─────────────────────────
    const qualityFlags = computeQualityFlags(
        components, dataDomains, integrations, relations,
        raw.qualityFlags ?? [],
    );

    // ── Step 9: Deterministic coverage ──────────────────────────────
    const coverage = computeCoverage(raw.coverage, components, dataDomains, integrations, relations);

    // ── Step 10: Structural validation warnings ─────────────────────
    if (components.length === 0) {
        warnings.push('WARN: No components found — graph will have empty center column');
    }
    if (components.length > 10) {
        warnings.push(`WARN: Too many components (${components.length}) — consider merging related ones`);
    }
    if (dataDomains.length === 0) {
        warnings.push('INFO: No data domains found — left column will be empty');
    }
    if (integrations.length === 0) {
        warnings.push('INFO: No integrations found — right column will be empty');
    }

    const emptyDescComps = components.filter((c) => !c.description?.trim());
    if (emptyDescComps.length > 0) {
        warnings.push(`INFO: ${emptyDescComps.length} component(s) have no description`);
    }

    return {
        blueprint: {
            ...raw,
            components,
            dataDomains,
            integrations,
            relations,
            coverage,
            qualityFlags,
        },
        warnings,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
    return s.toLowerCase().replace(/[\s\-_.,;:!?()]+/g, '').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Reclassify misplaced components
// ─────────────────────────────────────────────────────────────────────────────

/** Component types that actually belong in integrations */
const INTEGRATION_COMPONENT_TYPES: Set<BlueprintComponentType> = new Set([
    'integration',
    'external_system',
    'custom_connector',
]);

/** Known external system name patterns → should be integrations, not components */
const KNOWN_EXTERNAL_PATTERNS: RegExp[] = [
    /\b(outlook|exchange|sharepoint|teams|office\s*365|microsoft\s*365)\b/i,
    /\b(salesforce|sap|oracle|workday|servicenow)\b/i,
    /\b(stripe|paypal|braintree|adyen)\b/i,
    /\b(twilio|sendgrid|mailchimp|mailgun)\b/i,
    /\b(slack|discord|telegram|whatsapp)\b/i,
    /\b(google\s*(maps|analytics|calendar|workspace|drive))\b/i,
    /\b(aws|azure|gcp)\b/i,
    /\b(jira|confluence|trello|asana)\b/i,
    /\b(github|gitlab|bitbucket)\b/i,
    /\b(active\s*directory|ldap|okta|auth0)\b/i,
    /\b(smtp|imap|pop3)\b/i,
    /\b(external|third.party|3rd.party|terze?\s*parti)\b/i,
];

function reclassifyComponents(components: BlueprintComponent[]): {
    kept: BlueprintComponent[];
    movedToIntegrations: BlueprintIntegration[];
} {
    const kept: BlueprintComponent[] = [];
    const movedToIntegrations: BlueprintIntegration[] = [];

    for (const comp of components) {
        const shouldMove =
            INTEGRATION_COMPONENT_TYPES.has(comp.type) ||
            KNOWN_EXTERNAL_PATTERNS.some((p) => p.test(comp.name) || p.test(comp.description ?? ''));

        if (shouldMove) {
            movedToIntegrations.push({
                systemName: comp.name,
                direction: 'unknown',
                description: comp.description,
                confidence: comp.confidence,
                evidence: comp.evidence,
            });
        } else {
            kept.push(comp);
        }
    }

    return { kept, movedToIntegrations };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Deduplicate across categories
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateAcrossCategories(
    components: BlueprintComponent[],
    dataDomains: BlueprintDataDomain[],
    integrations: BlueprintIntegration[],
): {
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    removedCount: number;
} {
    let removedCount = 0;

    const integNames = new Set(integrations.map((i) => normalizeName(i.systemName)));
    const compNames = new Set(components.map((c) => normalizeName(c.name)));

    const filteredDD = dataDomains.filter((dd) => {
        const n = normalizeName(dd.name);
        if (integNames.has(n) || compNames.has(n)) {
            removedCount++;
            return false;
        }
        return true;
    });

    const filteredComps = components.filter((c) => {
        const n = normalizeName(c.name);
        if (integNames.has(n)) {
            removedCount++;
            return false;
        }
        return true;
    });

    return {
        components: filteredComps,
        dataDomains: filteredDD,
        integrations,
        removedCount,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Semantic deduplication within arrays
// ─────────────────────────────────────────────────────────────────────────────

/** Common aliases for well-known systems */
const KNOWN_ALIASES: Map<string, string> = new Map([
    ['office365', 'microsoft365'],
    ['o365', 'microsoft365'],
    ['ms365', 'microsoft365'],
    ['mssql', 'sqlserver'],
    ['postgres', 'postgresql'],
    ['mongo', 'mongodb'],
    ['ad', 'activedirectory'],
    ['gcp', 'googlecloudplatform'],
    ['aws', 'amazonwebservices'],
]);

function semanticDeduplicateArray<T>(items: T[], getName: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        let key = normalizeName(getName(item));
        // Resolve known aliases
        key = KNOWN_ALIASES.get(key) ?? key;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Remove useless/generic nodes
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_NAMES: Set<string> = new Set([
    'system', 'sistema', 'module', 'modulo', 'backend', 'frontend',
    'database', 'db', 'api', 'service', 'servizio', 'app', 'application',
    'applicazione', 'data', 'dati', 'integration', 'integrazione',
    'other', 'altro', 'misc', 'general', 'generale',
]);

function removeUselessNodes<T>(
    items: T[],
    getName: (item: T) => string,
): { kept: T[]; removed: string[] } {
    const kept: T[] = [];
    const removed: string[] = [];

    for (const item of items) {
        const name = getName(item).trim();
        const normalized = normalizeName(name);

        if (!name || GENERIC_NAMES.has(normalized)) {
            removed.push(name || '(empty)');
        } else {
            kept.push(item);
        }
    }

    return { kept, removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Relation validation
// ─────────────────────────────────────────────────────────────────────────────

function validateRelations(
    relations: BlueprintRelation[],
    validNodeIds: Set<string>,
    nameToIdMap: Map<string, string>,
): { relations: BlueprintRelation[]; removedCount: number } {
    let removedCount = 0;
    const seenKeys = new Set<string>();
    const validated: BlueprintRelation[] = [];

    for (const rel of relations) {
        // Resolve name-based references to stable IDs
        let fromId = validNodeIds.has(rel.fromNodeId)
            ? rel.fromNodeId
            : nameToIdMap.get(normalizeName(rel.fromNodeId));
        let toId = validNodeIds.has(rel.toNodeId)
            ? rel.toNodeId
            : nameToIdMap.get(normalizeName(rel.toNodeId));

        // Skip if either node doesn't exist
        if (!fromId || !toId) {
            removedCount++;
            continue;
        }

        // Skip self-loops
        if (fromId === toId) {
            removedCount++;
            continue;
        }

        // Skip duplicates (same from→to→type)
        const key = `${fromId}→${toId}→${rel.type}`;
        if (seenKeys.has(key)) {
            removedCount++;
            continue;
        }
        seenKeys.add(key);

        // Generate stable relation ID
        const id = rel.id || `rel_${slugify(fromId)}_${rel.type}_${slugify(toId)}`;

        validated.push({
            ...rel,
            id,
            fromNodeId: fromId,
            toNodeId: toId,
        });
    }

    return { relations: validated, removedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7: Evidence consolidation
// ─────────────────────────────────────────────────────────────────────────────

function consolidateEvidence(evidence?: EvidenceRef[]): EvidenceRef[] | undefined {
    if (!evidence || evidence.length === 0) return undefined;

    const seenSnippets = new Set<string>();
    const result: EvidenceRef[] = [];

    for (const ev of evidence) {
        const normalized = ev.snippet.trim().toLowerCase();
        if (seenSnippets.has(normalized)) continue;
        seenSnippets.add(normalized);

        result.push({
            ...ev,
            snippet: ev.snippet.length > MAX_SNIPPET_LENGTH
                ? ev.snippet.slice(0, MAX_SNIPPET_LENGTH) + '…'
                : ev.snippet,
        });
    }

    return result.length > 0 ? result : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 8: Deterministic quality flags
// ─────────────────────────────────────────────────────────────────────────────

function computeQualityFlags(
    components: BlueprintComponent[],
    dataDomains: BlueprintDataDomain[],
    integrations: BlueprintIntegration[],
    relations: BlueprintRelation[],
    aiFlags: string[],
): string[] {
    const flags = new Set<string>(aiFlags);

    if (components.length === 0) flags.add('empty_column_components');
    if (dataDomains.length === 0) flags.add('empty_column_data_domains');
    if (integrations.length === 0) flags.add('empty_column_integrations');

    if (relations.length === 0) flags.add('missing_relations');

    // Count nodes without evidence
    const allNodes = [
        ...components.map((c) => c.evidence),
        ...dataDomains.map((d) => d.evidence),
        ...integrations.map((i) => i.evidence),
    ];
    const nodesWithoutEvidence = allNodes.filter((e) => !e || e.length === 0).length;
    if (nodesWithoutEvidence > 0 && allNodes.length > 0) {
        const ratio = nodesWithoutEvidence / allNodes.length;
        if (ratio > 0.5) flags.add('weak_evidence');
    }

    // Core nodes without evidence
    const coreComponents = components.filter((c) =>
        ['backend', 'database', 'infrastructure'].includes(c.type),
    );
    const coreWithoutEvidence = coreComponents.filter((c) => !c.evidence || c.evidence.length === 0);
    if (coreWithoutEvidence.length > 0) {
        flags.add('core_node_without_evidence');
    }

    // Generic node check
    const total = components.length + dataDomains.length + integrations.length;
    if (total > 0) {
        const genericCount = components.filter((c) => GENERIC_NAMES.has(normalizeName(c.name))).length;
        if (genericCount > total * 0.3) flags.add('too_many_generic_nodes');
    }

    // Data domain without owning component
    if (dataDomains.length > 0 && components.length > 0 && relations.length > 0) {
        const ownedDomains = new Set(
            relations.filter((r) => r.type === 'owns').map((r) => r.toNodeId),
        );
        const unownedDomains = dataDomains.filter((d) => d.id && !ownedDomains.has(d.id));
        if (unownedDomains.length > 0) {
            flags.add('data_domain_without_owner_component');
        }
    }

    // Integration without connected component
    if (integrations.length > 0 && relations.length > 0) {
        const connectedIntegIds = new Set<string>();
        for (const r of relations) {
            connectedIntegIds.add(r.fromNodeId);
            connectedIntegIds.add(r.toNodeId);
        }
        const disconnected = integrations.filter((i) => i.id && !connectedIntegIds.has(i.id));
        if (disconnected.length > 0) {
            flags.add('integration_without_connected_component');
        }
    }

    return Array.from(flags).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 9: Deterministic coverage computation
// ─────────────────────────────────────────────────────────────────────────────

function computeCoverage(
    aiCoverage: number | undefined,
    components: BlueprintComponent[],
    dataDomains: BlueprintDataDomain[],
    integrations: BlueprintIntegration[],
    relations: BlueprintRelation[],
): number {
    // Heuristic coverage based on structural completeness
    let score = 0;
    let factors = 0;

    // Factor 1: Has components (0.3 weight)
    factors++;
    if (components.length >= 2) score += 0.3;
    else if (components.length === 1) score += 0.15;

    // Factor 2: Has data domains (0.2 weight)
    factors++;
    if (dataDomains.length >= 1) score += 0.2;

    // Factor 3: Has integrations (0.2 weight)
    factors++;
    if (integrations.length >= 1) score += 0.2;

    // Factor 4: Has relations (0.15 weight)
    factors++;
    if (relations.length >= 3) score += 0.15;
    else if (relations.length >= 1) score += 0.08;

    // Factor 5: Evidence coverage (0.15 weight)
    factors++;
    const allNodes = [...components, ...dataDomains, ...integrations];
    if (allNodes.length > 0) {
        const withEvidence = allNodes.filter((n) =>
            ('evidence' in n) && (n as any).evidence && (n as any).evidence.length > 0,
        ).length;
        score += 0.15 * (withEvidence / allNodes.length);
    }

    const heuristicCoverage = Math.min(1, score);

    // Use AI coverage if provided and reasonable, otherwise heuristic
    if (aiCoverage !== undefined && aiCoverage >= 0 && aiCoverage <= 1) {
        // Average AI + heuristic, weighted toward heuristic if they diverge a lot
        const divergence = Math.abs(aiCoverage - heuristicCoverage);
        if (divergence > 0.3) {
            // AI seems unreliable, lean toward heuristic
            return Math.round((heuristicCoverage * 0.7 + aiCoverage * 0.3) * 100) / 100;
        }
        return Math.round((heuristicCoverage * 0.5 + aiCoverage * 0.5) * 100) / 100;
    }

    return Math.round(heuristicCoverage * 100) / 100;
}
