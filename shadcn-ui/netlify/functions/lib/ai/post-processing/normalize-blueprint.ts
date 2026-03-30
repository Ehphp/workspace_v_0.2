/**
 * Post-processing normalization for ProjectTechnicalBlueprint.
 *
 * Runs after AI generation to fix classification errors, deduplicate,
 * merge micro-components, and validate structural constraints.
 *
 * Ensures the blueprint is consistent with the 3-column visualization:
 *   LEFT: Data Domains  |  CENTER: Components  |  RIGHT: Integrations
 */

import type {
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintComponentType,
} from '../../domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface RawBlueprint {
    summary?: string | null;
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence: number;
}

export interface NormalizationResult {
    blueprint: RawBlueprint;
    warnings: string[];
}

/**
 * Normalize a raw AI-generated blueprint.
 * Fixes classification errors, deduplicates, merges, and validates.
 */
export function normalizeProjectTechnicalBlueprint(raw: RawBlueprint): NormalizationResult {
    const warnings: string[] = [];

    let components = [...raw.components];
    let dataDomains = [...raw.dataDomains];
    let integrations = [...raw.integrations];

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

    // ── Step 3: Deduplicate within categories ───────────────────────
    const compsBefore = components.length;
    components = deduplicateWithinArray(components, (c) => c.name);
    if (components.length < compsBefore) {
        warnings.push(`Removed ${compsBefore - components.length} duplicate component(s)`);
    }

    const ddBefore = dataDomains.length;
    dataDomains = deduplicateWithinArray(dataDomains, (d) => d.name);
    if (dataDomains.length < ddBefore) {
        warnings.push(`Removed ${ddBefore - dataDomains.length} duplicate data domain(s)`);
    }

    const integBefore = integrations.length;
    integrations = deduplicateWithinArray(integrations, (i) => i.systemName);
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

    // ── Step 5: Structural validation warnings ──────────────────────
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

    // Check for empty descriptions
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
        },
        warnings,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Reclassify misplaced components
// ─────────────────────────────────────────────────────────────────────────────

/** Component types that actually belong in integrations */
const INTEGRATION_COMPONENT_TYPES: Set<BlueprintComponentType> = new Set([
    'integration',
    'external_system',
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
    const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, '').trim();

    // Build name sets by priority: integrations > components > dataDomains
    const integNames = new Set(integrations.map((i) => normalize(i.systemName)));
    const compNames = new Set(components.map((c) => normalize(c.name)));

    // Remove dataDomains that duplicate a component or integration name
    const filteredDD = dataDomains.filter((dd) => {
        const n = normalize(dd.name);
        if (integNames.has(n) || compNames.has(n)) {
            removedCount++;
            return false;
        }
        return true;
    });

    // Remove components that duplicate an integration name
    const filteredComps = components.filter((c) => {
        const n = normalize(c.name);
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
// Step 3: Deduplicate within arrays
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateWithinArray<T>(items: T[], getName: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = getName(item).toLowerCase().replace(/[\s\-_]+/g, '').trim();
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
        const normalized = name.toLowerCase().replace(/[\s\-_]+/g, '');

        if (!name || GENERIC_NAMES.has(normalized)) {
            removed.push(name || '(empty)');
        } else {
            kept.push(item);
        }
    }

    return { kept, removed };
}
