/**
 * Post-processing normalization for ProjectTechnicalBlueprint.
 *
 * Runs after AI generation to fix classification errors, deduplicate,
 * merge micro-components, validate structural constraints, stabilize
 * node IDs, validate relations, consolidate evidence, and produce
 * deterministic quality flags.
 *
 * Ensures the blueprint is consistent with the 4-column visualization:
 *   LEFT: Data Domains | CENTER-LEFT: Components | CENTER-RIGHT: Workflows | RIGHT: Integrations
 */

import type {
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintWorkflow,
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
    workflows?: BlueprintWorkflow[];
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
    let workflows = [...(raw.workflows ?? [])];
    let relations = [...(raw.relations ?? [])];

    // ── Step 1: Reclassify misplaced components ─────────────────────
    // 1a: component type='integration'/'external_system' → integrations
    const { kept, movedToIntegrations } = reclassifyComponents(components);
    components = kept;
    if (movedToIntegrations.length > 0) {
        integrations.push(...movedToIntegrations);
        warnings.push(
            `Reclassified ${movedToIntegrations.length} component(s) to integrations: ${movedToIntegrations.map((i) => i.systemName).join(', ')}`,
        );
    }

    // 1b: component type='workflow' → workflows (new in v3)
    const { keptComponents, movedToWorkflows } = reclassifyWorkflowComponents(components);
    components = keptComponents;
    if (movedToWorkflows.length > 0) {
        workflows.push(...movedToWorkflows);
        warnings.push(
            `Reclassified ${movedToWorkflows.length} component(s) to workflows: ${movedToWorkflows.map((w) => w.name).join(', ')}`,
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

    // ── Step 2.5: Cross-boundary reclassification ───────────────────
    const boundaryResult = enforceBoundaries(components, dataDomains);
    if (boundaryResult.reclassifiedCount > 0) {
        components = boundaryResult.components;
        dataDomains = boundaryResult.dataDomains;
        warnings.push(
            `Boundary enforcement: reclassified ${boundaryResult.reclassifiedCount} node(s): ${boundaryResult.details.join('; ')}`,
        );
    }

    // ── Step 3: Semantic deduplication within categories (enhanced) ──
    const compDedup = semanticDeduplicateWithAliases(components, (c) => c.name);
    components = compDedup.result;
    if (compDedup.mergedCount > 0) {
        warnings.push(`Removed ${compDedup.mergedCount} duplicate component(s)`);
    }

    const ddDedup = semanticDeduplicateWithAliases(dataDomains, (d) => d.name);
    dataDomains = ddDedup.result;
    if (ddDedup.mergedCount > 0) {
        warnings.push(`Removed ${ddDedup.mergedCount} duplicate data domain(s)`);
    }

    const integDedup = semanticDeduplicateWithAliases(integrations, (i) => i.systemName);
    integrations = integDedup.result;
    if (integDedup.mergedCount > 0) {
        warnings.push(`Removed ${integDedup.mergedCount} duplicate integration(s)`);
    }

    const wfDedup = semanticDeduplicateWithAliases(workflows, (w) => w.name);
    workflows = wfDedup.result;
    if (wfDedup.mergedCount > 0) {
        warnings.push(`Removed ${wfDedup.mergedCount} duplicate workflow(s)`);
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

    const filteredWfs = removeUselessNodes(workflows, (w) => w.name);
    if (filteredWfs.removed.length > 0) {
        workflows = filteredWfs.kept;
        warnings.push(`Removed generic workflow(s): ${filteredWfs.removed.join(', ')}`);
    }

    // ── Step 5: Stabilize node IDs + populate canonicalName ─────────
    components = components.map((c) => ({
        ...c,
        id: c.id || generateNodeId('cmp_', c.name),
        canonicalName: c.canonicalName || resolveCanonicalName(c.name),
    }));
    dataDomains = dataDomains.map((d) => ({
        ...d,
        id: d.id || generateNodeId('dom_', d.name),
        canonicalName: d.canonicalName || resolveCanonicalName(d.name),
    }));
    integrations = integrations.map((i) => ({
        ...i,
        id: i.id || generateNodeId('int_', i.systemName),
        canonicalName: i.canonicalName || resolveCanonicalName(i.systemName),
    }));
    workflows = workflows.map((w) => ({
        ...w,
        id: w.id || generateNodeId('wf_', w.name),
        canonicalName: w.canonicalName || resolveCanonicalName(w.name),
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
    for (const w of workflows) {
        validNodeIds.add(w.id!);
        nameToIdMap.set(normalizeName(w.name), w.id!);
    }

    // ── Step 5b: Validate workflow references ───────────────────────
    workflows = workflows.map((w) => ({
        ...w,
        involvedComponents: (w.involvedComponents ?? []).filter((ref) => {
            const resolved = validNodeIds.has(ref) || nameToIdMap.has(normalizeName(ref));
            return resolved;
        }),
        involvedDataDomains: (w.involvedDataDomains ?? []).filter((ref) => {
            const resolved = validNodeIds.has(ref) || nameToIdMap.has(normalizeName(ref));
            return resolved;
        }),
    }));

    // ── Step 6: Validate & clean relations ──────────────────────────
    // 6a: Generate implicit workflow→component orchestrates relations
    for (const w of workflows) {
        for (const compRef of w.involvedComponents) {
            const compId = validNodeIds.has(compRef) ? compRef : nameToIdMap.get(normalizeName(compRef));
            if (compId && w.id) {
                relations.push({
                    id: '',
                    fromNodeId: w.id,
                    toNodeId: compId,
                    type: 'orchestrates',
                    confidence: 0.7,
                });
            }
        }
    }

    const relResult = validateRelations(relations, validNodeIds, nameToIdMap);
    relations = relResult.relations;
    if (relResult.removedCount > 0) {
        warnings.push(`Removed ${relResult.removedCount} invalid relation(s)`);
    }

    // ── Step 7: Consolidate evidence ────────────────────────────────
    components = components.map((c) => ({ ...c, evidence: consolidateEvidence(c.evidence) }));
    dataDomains = dataDomains.map((d) => ({ ...d, evidence: consolidateEvidence(d.evidence) }));
    integrations = integrations.map((i) => ({ ...i, evidence: consolidateEvidence(i.evidence) }));
    workflows = workflows.map((w) => ({ ...w, evidence: consolidateEvidence(w.evidence) }));
    relations = relations.map((r) => ({ ...r, evidence: consolidateEvidence(r.evidence) }));

    // ── Step 8: Deterministic quality flags ─────────────────────────
    const qualityFlags = computeQualityFlags(
        components, dataDomains, integrations, workflows, relations,
        raw.qualityFlags ?? [],
        boundaryResult.reclassifiedCount > 0,
    );

    // ── Step 9: Deterministic coverage ──────────────────────────────
    const coverage = computeCoverage(raw.coverage, components, dataDomains, integrations, workflows, relations);

    // ── Step 10: Structural validation warnings ─────────────────────
    if (components.length === 0) {
        warnings.push('WARN: No components found — graph will have empty components column');
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
    if (workflows.length === 0) {
        warnings.push('INFO: No workflows found — workflows column will be empty');
    }

    // Check workflows referencing non-existent components/domains
    for (const w of workflows) {
        for (const ref of [...w.involvedComponents, ...w.involvedDataDomains]) {
            if (!validNodeIds.has(ref) && !nameToIdMap.has(normalizeName(ref))) {
                warnings.push(`WARN: Workflow "${w.name}" references unknown node "${ref}"`);
            }
        }
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
            workflows,
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
// Step 1b: Reclassify workflow-type components to workflows
// ─────────────────────────────────────────────────────────────────────────────

function reclassifyWorkflowComponents(components: BlueprintComponent[]): {
    keptComponents: BlueprintComponent[];
    movedToWorkflows: BlueprintWorkflow[];
} {
    const keptComponents: BlueprintComponent[] = [];
    const movedToWorkflows: BlueprintWorkflow[] = [];

    for (const comp of components) {
        if ((comp.type as string) === 'workflow') {
            movedToWorkflows.push({
                name: comp.name,
                description: comp.description ?? '',
                trigger: 'unknown',
                steps: [],
                involvedComponents: [],
                involvedDataDomains: [],
                confidence: comp.confidence,
                businessCriticality: comp.businessCriticality,
                changeLikelihood: comp.changeLikelihood,
                estimationImpact: comp.estimationImpact,
                reviewStatus: comp.reviewStatus,
                evidence: comp.evidence,
            });
        } else {
            keptComponents.push(comp);
        }
    }

    return { keptComponents, movedToWorkflows };
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
// Step 2.5: Cross-boundary reclassification
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that indicate a node is data-like (should be dataDomain, not component) */
const DATA_LIKE_PATTERNS = /\b(anagraf|catalogo|registro|registr[iy]|archivio|entit[àa]|tabella|record|master\s*data|data\s*domain|elenco|listino|rubrica|scheda|repository\s*dati|fattur[ae]|ordin[ei]|contratt[oi]|inventario)\b/i;

/** Patterns that indicate a node is logic-like (should be component, not dataDomain) */
const LOGIC_LIKE_PATTERNS = /\b(engine|processor|handler|manager|controller|gateway|service|scheduler|orchestrat|dispatcher|pipeline|worker|daemon|listener|middleware|validator|parser|router|adapter)\b/i;

/** Component types considered data-storage that may indicate a misplaced dataDomain */
const DATA_STORAGE_TYPES: Set<string> = new Set(['database', 'dataverse_table', 'other']);

function enforceBoundaries(
    components: BlueprintComponent[],
    dataDomains: BlueprintDataDomain[],
): {
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    reclassifiedCount: number;
    details: string[];
} {
    const keptComponents: BlueprintComponent[] = [];
    const keptDataDomains = [...dataDomains];
    const movedToDomains: BlueprintDataDomain[] = [];
    const movedToComponents: BlueprintComponent[] = [];
    const details: string[] = [];

    // Components whose name matches DATA_LIKE_PATTERNS and type is data-storage → dataDomains
    for (const comp of components) {
        const nameAndDesc = `${comp.name} ${comp.description ?? ''}`;
        if (DATA_STORAGE_TYPES.has(comp.type) && DATA_LIKE_PATTERNS.test(nameAndDesc)) {
            movedToDomains.push({
                name: comp.name,
                description: comp.description,
                confidence: comp.confidence,
                businessCriticality: comp.businessCriticality,
                changeLikelihood: comp.changeLikelihood,
                estimationImpact: comp.estimationImpact,
                reviewStatus: comp.reviewStatus,
                evidence: comp.evidence,
            });
            details.push(`${comp.name}: component→dataDomain`);
        } else {
            keptComponents.push(comp);
        }
    }

    // DataDomains whose name matches LOGIC_LIKE_PATTERNS → components
    const finalDataDomains: BlueprintDataDomain[] = [];
    for (const dd of keptDataDomains) {
        const nameAndDesc = `${dd.name} ${dd.description ?? ''}`;
        if (LOGIC_LIKE_PATTERNS.test(nameAndDesc)) {
            movedToComponents.push({
                name: dd.name,
                type: 'other',
                description: dd.description,
                confidence: dd.confidence,
                businessCriticality: dd.businessCriticality,
                changeLikelihood: dd.changeLikelihood,
                estimationImpact: dd.estimationImpact,
                reviewStatus: dd.reviewStatus,
                evidence: dd.evidence,
            });
            details.push(`${dd.name}: dataDomain→component`);
        } else {
            finalDataDomains.push(dd);
        }
    }

    return {
        components: [...keptComponents, ...movedToComponents],
        dataDomains: [...finalDataDomains, ...movedToDomains],
        reclassifiedCount: movedToDomains.length + movedToComponents.length,
        details,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Semantic deduplication within arrays (enhanced with aliases)
// ─────────────────────────────────────────────────────────────────────────────

/** Common aliases for well-known systems */
const KNOWN_ALIASES: Map<string, string> = new Map([
    ['office365', 'microsoft365'],
    ['o365', 'microsoft365'],
    ['ms365', 'microsoft365'],
    ['mssql', 'sqlserver'],
    ['mssqlserver', 'sqlserver'],
    ['postgres', 'postgresql'],
    ['mongo', 'mongodb'],
    ['ad', 'activedirectory'],
    ['gcp', 'googlecloudplatform'],
    ['aws', 'amazonwebservices'],
    ['react', 'reactjs'],
    ['angular', 'angularjs'],
    ['vue', 'vuejs'],
    ['node', 'nodejs'],
    ['dotnet', 'net'],
    ['csharp', 'net'],
]);

function resolveCanonicalName(name: string): string {
    let key = normalizeName(name);
    return KNOWN_ALIASES.get(key) ?? key;
}

/**
 * Enhanced semantic deduplication that populates aliases[] and deduplicationNotes
 * on the surviving item when duplicates are merged.
 */
function semanticDeduplicateWithAliases<T extends { aliases?: string[]; deduplicationNotes?: string }>(
    items: T[],
    getName: (item: T) => string,
): { result: T[]; mergedCount: number } {
    const seen = new Map<string, number>(); // canonicalKey → index in result
    const result: T[] = [];
    let mergedCount = 0;

    for (const item of items) {
        const rawName = getName(item);
        let key = normalizeName(rawName);
        key = KNOWN_ALIASES.get(key) ?? key;

        const existingIdx = seen.get(key);
        if (existingIdx !== undefined) {
            // Merge: absorb this item's name into the survivor's aliases
            const survivor = result[existingIdx];
            const aliases = [...(survivor.aliases ?? [])];
            if (!aliases.includes(rawName)) aliases.push(rawName);
            const note = survivor.deduplicationNotes
                ? `${survivor.deduplicationNotes}; merged '${rawName}'`
                : `merged from '${getName(result[existingIdx])}' + '${rawName}'`;
            result[existingIdx] = { ...survivor, aliases, deduplicationNotes: note };
            mergedCount++;
        } else {
            seen.set(key, result.length);
            result.push(item);
        }
    }

    return { result, mergedCount };
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
    workflows: BlueprintWorkflow[],
    relations: BlueprintRelation[],
    aiFlags: string[],
    boundaryViolationDetected: boolean,
): string[] {
    const flags = new Set<string>(aiFlags);

    if (components.length === 0) flags.add('empty_column_components');
    if (dataDomains.length === 0) flags.add('empty_column_data_domains');
    if (integrations.length === 0) flags.add('empty_column_integrations');
    if (workflows.length === 0) flags.add('empty_column_workflows');
    if (boundaryViolationDetected) flags.add('boundary_violation_detected');

    if (relations.length === 0) flags.add('missing_relations');

    // Count nodes without evidence
    const allNodes = [
        ...components.map((c) => c.evidence),
        ...dataDomains.map((d) => d.evidence),
        ...integrations.map((i) => i.evidence),
        ...workflows.map((w) => w.evidence),
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
    workflows: BlueprintWorkflow[],
    relations: BlueprintRelation[],
): number {
    // Heuristic coverage based on structural completeness
    let score = 0;

    // Factor 1: Has components (0.25 weight)
    if (components.length >= 2) score += 0.25;
    else if (components.length === 1) score += 0.12;

    // Factor 2: Has data domains (0.20 weight)
    if (dataDomains.length >= 1) score += 0.20;

    // Factor 3: Has integrations (0.15 weight)
    if (integrations.length >= 1) score += 0.15;

    // Factor 4: Has workflows (0.10 weight)
    if (workflows.length >= 1) score += 0.10;

    // Factor 5: Has relations (0.15 weight)
    if (relations.length >= 3) score += 0.15;
    else if (relations.length >= 1) score += 0.08;

    // Factor 6: Evidence coverage (0.15 weight)
    const allNodes = [...components, ...dataDomains, ...integrations, ...workflows];
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
