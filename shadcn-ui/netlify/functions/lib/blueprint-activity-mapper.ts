/**
 * Blueprint → Activity Mapper
 *
 * Deterministic mapping layer that derives candidate activities from an
 * Estimation Blueprint's structural components.  This replaces keyword-based
 * `selectTopActivities` as the PRIMARY candidate generation strategy when a
 * confirmed Blueprint is available.
 *
 * Flow:
 *   Blueprint.components  → layer/intervention/complexity → activity patterns
 *   Blueprint.integrations → integration activities
 *   Blueprint.dataEntities → data/field activities
 *   Blueprint.testingScope → testing activities
 *   Gap analysis           → selectTopActivities fills remaining slots
 *
 * Each mapped activity carries provenance metadata so downstream consumers
 * (wizard UI, agent, consultant) know WHY it was selected.
 */

import type { Activity } from './activities';
import type { SignalKind, PipelineLayer } from './domain/pipeline/pipeline-domain';
import type { NormalizedSignal, SignalSet } from './domain/pipeline/signal-types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why an activity was included in the candidate set.
 * @deprecated Use SignalKind from pipeline-domain.ts
 */
export type ActivityProvenance = SignalKind;

/** An activity with provenance and scoring metadata */
export interface MappedActivity {
    activity: Activity;
    /** Why this activity was selected */
    provenance: ActivityProvenance;
    /** Human-readable source (e.g. component name, integration target) */
    sourceLabel: string;
    /** Mapping confidence 0-1 */
    confidence: number;
}

/** Non-blocking quality warning emitted during mapping */
export interface CoverageWarning {
    /** Warning severity — none are blocking */
    level: 'info' | 'warn';
    /** Machine-readable warning code */
    code: 'LOW_COVERAGE' | 'HIGH_FALLBACK_RATIO' | 'UNMAPPED_COMPONENTS' | 'UNSUPPORTED_LAYER' | 'EMPTY_BLUEPRINT';
    /** Human-readable message */
    message: string;
}

/** Blueprint mapping result with coverage diagnostics */
export interface BlueprintMappingResult {
    /** Activities derived from the blueprint (primary) */
    blueprintActivities: MappedActivity[];
    /** Activities added by keyword fallback (gap-filling) */
    fallbackActivities: MappedActivity[];
    /** All activities merged (blueprint-first, then fallback) */
    allActivities: MappedActivity[];
    /** Coverage report */
    coverage: CoverageReport;
    /** Non-blocking quality warnings */
    warnings: CoverageWarning[];
}

export interface CoverageReport {
    /** Groups covered by blueprint mapping */
    coveredGroups: string[];
    /** Groups NOT covered — filled by fallback */
    missingGroups: string[];
    /** Blueprint components that found no matching activity */
    unmappedComponents: string[];
    /** Percentage of blueprint components successfully mapped (0-100) */
    componentCoveragePercent: number;
    /** Total unique activities */
    totalActivities: number;
    /** From blueprint vs. fallback */
    fromBlueprint: number;
    fromFallback: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer → Activity Group mapping
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_TO_GROUPS: Record<string, string[]> = {
    frontend: ['ANALYSIS', 'DEV', 'TEST'],
    logic: ['ANALYSIS', 'DEV', 'TEST'],
    data: ['DEV'],
    integration: ['DEV', 'TEST'],
    automation: ['DEV', 'TEST'],
    configuration: ['DEV'],
};

/**
 * Layers that are recognized but have NO activity mappings in any tech category.
 * Components on these layers will produce an UNSUPPORTED_LAYER warning and
 * land in unmappedComponents. They are NOT silently ignored.
 */
export const UNSUPPORTED_LAYERS = new Set(['ai_pipeline', 'ml_model', 'iot', 'embedded']);

// ─────────────────────────────────────────────────────────────────────────────
// Layer + TechCategory → Activity code pattern mapping
//
// Each entry maps a (layer, techCategory) pair to a list of code prefixes
// that should be considered when a component on that layer is present.
// ─────────────────────────────────────────────────────────────────────────────

export interface PatternEntry {
    /** Activity code prefix (matched with startsWith) */
    prefix: string;
    /** Which intervention types this pattern covers */
    interventions: string[];
    /** Which groups this pattern covers */
    groups: string[];
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  CATALOG-VALIDATED PATTERN MAP                                             │
// │                                                                           │
// │  Every prefix below has been verified against the real activity catalog    │
// │  (supabase_seed.sql + supabase_granular_activities.sql).                   │
// │                                                                           │
// │  Verified prefixes (exist as base + _SM + _LG variants):                  │
// │    PP: PP_ANL_ALIGN, PP_DV_FIELD, PP_DV_FORM, PP_FLOW_SIMPLE,            │
// │        PP_FLOW_COMPLEX, PP_BUSINESS_RULE, PP_E2E_TEST, PP_UAT_RUN,       │
// │        PP_DEPLOY                                                          │
// │    BE: BE_ANL_ALIGN, BE_API_SIMPLE, BE_API_COMPLEX, BE_DB_MIGRATION,     │
// │        BE_UNIT_TEST, BE_INT_TEST, BE_LOGGING, BE_DEPLOY                   │
// │    FE: FE_ANL_UX, FE_UI_COMPONENT, FE_FORM, FE_STATE_MGMT,              │
// │        FE_API_INTEGRATION, FE_UNIT_TEST, FE_E2E_TEST, FE_DEPLOY          │
// │    MULTI: CRS_KICKOFF, CRS_DOC                                            │
// │                                                                           │
// │  ⚠️  DO NOT add prefixes here without verifying they exist in the seed.    │
// └─────────────────────────────────────────────────────────────────────────────┘
export const LAYER_TECH_PATTERNS: Record<string, Record<string, PatternEntry[]>> = {
    // POWER PLATFORM
    POWER_PLATFORM: {
        frontend: [
            { prefix: 'PP_DV_FORM', interventions: ['new_development', 'modification', 'configuration'], groups: ['DEV'] },
            { prefix: 'PP_DV_FIELD', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'PP_ANL_ALIGN', interventions: ['new_development', 'modification', 'configuration', 'integration', 'migration'], groups: ['ANALYSIS'] },
        ],
        logic: [
            { prefix: 'PP_BUSINESS_RULE', interventions: ['new_development', 'modification', 'configuration'], groups: ['DEV'] },
            // LOW/MEDIUM complexity → simple flow; HIGH → complex flow
            { prefix: 'PP_FLOW_SIMPLE', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'PP_FLOW_COMPLEX', interventions: ['new_development', 'modification'], groups: ['DEV'] },
        ],
        data: [
            { prefix: 'PP_DV_FIELD', interventions: ['new_development', 'modification', 'migration'], groups: ['DEV'] },
        ],
        integration: [
            { prefix: 'PP_FLOW_COMPLEX', interventions: ['integration', 'new_development'], groups: ['DEV'] },
        ],
        automation: [
            // LOW/MEDIUM → simple; HIGH → complex
            { prefix: 'PP_FLOW_SIMPLE', interventions: ['new_development', 'modification', 'configuration'], groups: ['DEV'] },
            { prefix: 'PP_FLOW_COMPLEX', interventions: ['new_development', 'modification'], groups: ['DEV'] },
        ],
        configuration: [
            { prefix: 'PP_DV_FORM', interventions: ['configuration'], groups: ['DEV'] },
            { prefix: 'PP_BUSINESS_RULE', interventions: ['configuration'], groups: ['DEV'] },
        ],
    },
    // BACKEND
    BACKEND: {
        frontend: [], // backend tech shouldn't have frontend layer activities
        logic: [
            // LOW/MEDIUM → simple API; HIGH → complex API
            { prefix: 'BE_API_SIMPLE', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'BE_API_COMPLEX', interventions: ['new_development', 'modification', 'integration'], groups: ['DEV'] },
            { prefix: 'BE_ANL_ALIGN', interventions: ['new_development', 'modification', 'integration', 'migration'], groups: ['ANALYSIS'] },
        ],
        data: [
            { prefix: 'BE_DB_MIGRATION', interventions: ['new_development', 'modification', 'migration'], groups: ['DEV'] },
        ],
        integration: [
            { prefix: 'BE_API_COMPLEX', interventions: ['integration', 'new_development'], groups: ['DEV'] },
            { prefix: 'BE_INT_TEST', interventions: ['integration', 'new_development'], groups: ['TEST'] },
        ],
        automation: [
            { prefix: 'BE_API_SIMPLE', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'BE_API_COMPLEX', interventions: ['new_development', 'modification'], groups: ['DEV'] },
        ],
        configuration: [
            { prefix: 'BE_LOGGING', interventions: ['configuration'], groups: ['OPS'] },
        ],
    },
    // FRONTEND
    FRONTEND: {
        frontend: [
            { prefix: 'FE_UI_COMPONENT', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'FE_FORM', interventions: ['new_development', 'modification'], groups: ['DEV'] },
            { prefix: 'FE_ANL_UX', interventions: ['new_development', 'modification', 'configuration'], groups: ['ANALYSIS'] },
        ],
        logic: [
            { prefix: 'FE_STATE_MGMT', interventions: ['new_development', 'modification'], groups: ['DEV'] },
        ],
        data: [
            { prefix: 'FE_API_INTEGRATION', interventions: ['new_development', 'modification', 'integration'], groups: ['DEV'] },
        ],
        integration: [
            { prefix: 'FE_API_INTEGRATION', interventions: ['integration', 'new_development'], groups: ['DEV'] },
        ],
        automation: [],
        configuration: [],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Complexity → variant suffix
// ─────────────────────────────────────────────────────────────────────────────

function getVariantSuffix(complexity: string | undefined): string {
    switch (complexity?.toUpperCase()) {
        case 'LOW': return '_SM';
        case 'HIGH': return '_LG';
        default: return ''; // MEDIUM or undefined → base variant
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Mapping Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the best matching activity for a code prefix + complexity.
 * Tries variant first, then base, then any match with that prefix.
 */
export function findBestMatch(
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
    prefix: string,
    complexity: string | undefined,
): Activity | null {
    const suffix = getVariantSuffix(complexity);

    // 1. Try exact variant: e.g. PP_DV_FORM_SM
    if (suffix) {
        const exact = catalog.get(prefix + suffix);
        if (exact) return exact;
    }

    // 2. Try base variant: e.g. PP_DV_FORM
    const base = catalog.get(prefix);
    if (base) return base;

    // 3. Try any activity starting with prefix
    const prefixMatches = catalogByPrefix.get(prefix);
    if (prefixMatches && prefixMatches.length > 0) {
        // If we wanted _SM, pick smallest base_hours; if _LG, pick largest
        if (suffix === '_SM') {
            return prefixMatches.reduce((min, a) => a.base_hours < min.base_hours ? a : min, prefixMatches[0]);
        }
        if (suffix === '_LG') {
            return prefixMatches.reduce((max, a) => a.base_hours > max.base_hours ? a : max, prefixMatches[0]);
        }
        // MEDIUM — pick middle or first
        return prefixMatches[Math.floor(prefixMatches.length / 2)];
    }

    return null;
}

/**
 * Map a single blueprint component to candidate activities.
 */
function mapComponent(
    component: { name: string; layer: string; interventionType: string; complexity?: string; notes?: string },
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
    warnings: CoverageWarning[],
): MappedActivity[] {
    const results: MappedActivity[] = [];
    const seen = new Set<string>();

    // Check for unsupported layers
    if (UNSUPPORTED_LAYERS.has(component.layer)) {
        warnings.push({
            level: 'warn',
            code: 'UNSUPPORTED_LAYER',
            message: `Layer "${component.layer}" on component "${component.name}" has no catalog mappings. Activity will be derived from fallback only.`,
        });
        return results;
    }

    const techPatterns = LAYER_TECH_PATTERNS[techCategory];
    if (!techPatterns) return results;

    const layerPatterns = techPatterns[component.layer];
    if (!layerPatterns || layerPatterns.length === 0) return results;

    for (const pattern of layerPatterns) {
        // Check if this pattern applies to the component's intervention type
        if (!pattern.interventions.includes(component.interventionType)) continue;

        // Complexity-based prefix selection: when two prefixes exist for the
        // same layer (e.g. PP_FLOW_SIMPLE + PP_FLOW_COMPLEX, or BE_API_SIMPLE
        // + BE_API_COMPLEX), skip the "wrong" one based on complexity so we
        // don't double-map.
        const isSimplePrefix = pattern.prefix.endsWith('_SIMPLE');
        const isComplexPrefix = pattern.prefix.endsWith('_COMPLEX');
        if (isSimplePrefix && component.complexity?.toUpperCase() === 'HIGH') continue;
        if (isComplexPrefix && (component.complexity?.toUpperCase() === 'LOW' || component.complexity?.toUpperCase() === 'MEDIUM')) continue;

        const match = findBestMatch(catalog, catalogByPrefix, pattern.prefix, component.complexity);
        if (match && !seen.has(match.code)) {
            seen.add(match.code);
            results.push({
                activity: match,
                provenance: 'blueprint-component',
                sourceLabel: `${component.name} [${component.layer}/${component.interventionType}]`,
                confidence: component.complexity ? 0.85 : 0.70,
            });
        }
    }

    return results;
}

/**
 * Map blueprint integrations to activities.
 */
function mapIntegrations(
    integrations: Array<{ target: string; type?: string; direction?: string; notes?: string }>,
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
): MappedActivity[] {
    const results: MappedActivity[] = [];
    const seen = new Set<string>();

    // Complexity heuristic: multiple integrations or bidirectional → prefer larger variants
    const isComplex = integrations.length > 2 ||
        integrations.some(i => i.direction === 'bidirectional');
    const complexity = isComplex ? 'HIGH' : integrations.length === 1 ? 'LOW' : undefined;

    // Integration patterns per tech — complexity-routed for SIMPLE/COMPLEX pairs
    const integrationPrefixes: Record<string, string[]> = {
        POWER_PLATFORM: complexity === 'HIGH' ? ['PP_FLOW_COMPLEX'] : ['PP_FLOW_SIMPLE'],
        BACKEND: complexity === 'HIGH' ? ['BE_API_COMPLEX'] : ['BE_API_SIMPLE'],
        FRONTEND: ['FE_API_INTEGRATION'],
    };

    const prefixes = integrationPrefixes[techCategory] || [];

    for (const prefix of prefixes) {
        const match = findBestMatch(catalog, catalogByPrefix, prefix, complexity);
        if (match && !seen.has(match.code)) {
            seen.add(match.code);
            const targets = integrations.map(i => i.target).join(', ');
            results.push({
                activity: match,
                provenance: 'blueprint-integration',
                sourceLabel: `Integrations: ${targets}`,
                confidence: 0.80,
            });
        }
    }

    // Add integration testing if > 1 integration
    if (integrations.length > 1) {
        const testPrefixes: Record<string, string> = {
            BACKEND: 'BE_INT_TEST',
            FRONTEND: 'FE_E2E_TEST',
            POWER_PLATFORM: 'PP_E2E_TEST',
        };
        const testPrefix = testPrefixes[techCategory];
        if (testPrefix) {
            const testMatch = findBestMatch(catalog, catalogByPrefix, testPrefix, complexity);
            if (testMatch && !seen.has(testMatch.code)) {
                seen.add(testMatch.code);
                results.push({
                    activity: testMatch,
                    provenance: 'blueprint-integration',
                    sourceLabel: `Integration testing (${integrations.length} integrations)`,
                    confidence: 0.75,
                });
            }
        }
    }

    return results;
}

/**
 * Map blueprint data entities to activities.
 */
function mapDataEntities(
    entities: Array<{ entity: string; operation: string; notes?: string }>,
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
): MappedActivity[] {
    const results: MappedActivity[] = [];
    const seen = new Set<string>();

    const dataPrefixes: Record<string, string[]> = {
        POWER_PLATFORM: ['PP_DV_FIELD'],
        BACKEND: ['BE_DB_MIGRATION'],
        FRONTEND: ['FE_API_INTEGRATION'],
    };

    const prefixes = dataPrefixes[techCategory] || [];
    const complexity = entities.length > 3 ? 'HIGH' : entities.length === 1 ? 'LOW' : undefined;

    for (const prefix of prefixes) {
        const match = findBestMatch(catalog, catalogByPrefix, prefix, complexity);
        if (match && !seen.has(match.code)) {
            seen.add(match.code);
            const entityNames = entities.map(e => e.entity).join(', ');
            results.push({
                activity: match,
                provenance: 'blueprint-data',
                sourceLabel: `Data entities: ${entityNames}`,
                confidence: 0.80,
            });
        }
    }

    return results;
}

/**
 * Map blueprint testing scope to activities.
 */
function mapTestingScope(
    testingScope: Array<{ area: string; testType: string; criticality?: string }>,
    techCategory: string,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
): MappedActivity[] {
    const results: MappedActivity[] = [];
    const seen = new Set<string>();

    const testTypePrefixes: Record<string, Record<string, string[]>> = {
        POWER_PLATFORM: {
            e2e: ['PP_E2E_TEST'],
            uat: ['PP_UAT_RUN'],
            integration: ['PP_E2E_TEST'],
            unit: ['PP_E2E_TEST'],
        },
        BACKEND: {
            unit: ['BE_UNIT_TEST'],
            integration: ['BE_INT_TEST'],
            e2e: ['BE_INT_TEST'],
            uat: ['BE_INT_TEST'],
        },
        FRONTEND: {
            unit: ['FE_UNIT_TEST'],
            e2e: ['FE_E2E_TEST'],
            integration: ['FE_E2E_TEST'],
            uat: ['FE_E2E_TEST'],
        },
    };

    const techTests = testTypePrefixes[techCategory];
    if (!techTests) return results;

    for (const scope of testingScope) {
        const testTypeKey = scope.testType.toLowerCase().replace(/[^a-z]/g, '');
        const prefixes = techTests[testTypeKey] || techTests['e2e'] || [];
        const complexity = scope.criticality === 'CRITICAL' || scope.criticality === 'HIGH' ? 'HIGH' :
            scope.criticality === 'LOW' ? 'LOW' : undefined;

        for (const prefix of prefixes) {
            const match = findBestMatch(catalog, catalogByPrefix, prefix, complexity);
            if (match && !seen.has(match.code)) {
                seen.add(match.code);
                results.push({
                    activity: match,
                    provenance: 'blueprint-testing',
                    sourceLabel: `${scope.testType}: ${scope.area}`,
                    confidence: scope.criticality === 'CRITICAL' ? 0.90 : 0.75,
                });
            }
        }
    }

    return results;
}

/**
 * Add cross-cutting MULTI activities (deploy, kickoff, docs) based on
 * blueprint size and coverage gaps.
 */
function addCrossCuttingActivities(
    blueprint: Record<string, unknown>,
    catalog: Map<string, Activity>,
    catalogByPrefix: Map<string, Activity[]>,
    existingCodes: Set<string>,
    techCategory: string,
): MappedActivity[] {
    const results: MappedActivity[] = [];
    const components = Array.isArray(blueprint.components) ? blueprint.components : [];
    const isLarge = components.length > 4;

    // Always add deploy for the tech category
    const deployPrefixes: Record<string, string> = {
        POWER_PLATFORM: 'PP_DEPLOY',
        BACKEND: 'BE_DEPLOY',
        FRONTEND: 'FE_DEPLOY',
    };
    const deployPrefix = deployPrefixes[techCategory];
    if (deployPrefix) {
        const complexity = isLarge ? 'HIGH' : 'LOW';
        const deploy = findBestMatch(catalog, catalogByPrefix, deployPrefix, complexity);
        if (deploy && !existingCodes.has(deploy.code)) {
            results.push({
                activity: deploy,
                provenance: 'multi-crosscutting',
                sourceLabel: 'Deploy (derived from blueprint scope)',
                confidence: 0.85,
            });
        }
    }

    // Add governance for larger blueprints
    if (isLarge) {
        for (const prefix of ['CRS_KICKOFF', 'CRS_DOC']) {
            const match = findBestMatch(catalog, catalogByPrefix, prefix, undefined);
            if (match && !existingCodes.has(match.code)) {
                results.push({
                    activity: match,
                    provenance: 'multi-crosscutting',
                    sourceLabel: `Governance (blueprint has ${components.length} components)`,
                    confidence: 0.70,
                });
            }
        }
    }

    // Add logging/monitoring if backend or PP with integrations
    const integrations = Array.isArray(blueprint.integrations) ? blueprint.integrations : [];
    if (integrations.length > 0 && (techCategory === 'BACKEND' || techCategory === 'POWER_PLATFORM')) {
        const logPrefix = techCategory === 'BACKEND' ? 'BE_LOGGING' : undefined;
        if (logPrefix) {
            const match = findBestMatch(catalog, catalogByPrefix, logPrefix, integrations.length > 2 ? 'HIGH' : 'LOW');
            if (match && !existingCodes.has(match.code)) {
                results.push({
                    activity: match,
                    provenance: 'multi-crosscutting',
                    sourceLabel: `Monitoring (${integrations.length} integrations)`,
                    confidence: 0.70,
                });
            }
        }
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Index builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildCatalogIndexes(activities: Activity[]): {
    byCode: Map<string, Activity>;
    byPrefix: Map<string, Activity[]>;
} {
    const byCode = new Map<string, Activity>();
    const byPrefix = new Map<string, Activity[]>();

    for (const a of activities) {
        byCode.set(a.code, a);

        // Index by all possible prefixes (e.g. PP_DV_FORM → [PP_DV_FORM, PP_DV_FORM_SM, PP_DV_FORM_LG])
        // Strip _SM/_LG suffix to get base prefix
        const baseCode = a.code.replace(/_(SM|LG)$/, '');
        const arr = byPrefix.get(baseCode) || [];
        arr.push(a);
        byPrefix.set(baseCode, arr);
    }

    return { byCode, byPrefix };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a confirmed Estimation Blueprint to candidate activities.
 *
 * This is the PRIMARY candidate generation strategy.  It deterministically
 * derives activities from the blueprint's structural components, integrations,
 * data entities, and testing scope.
 *
 * @param blueprint  The confirmed estimation blueprint
 * @param catalog    Full activity catalog (already filtered by tech)
 * @param techCategory  Technology category (POWER_PLATFORM, BACKEND, FRONTEND)
 * @param fallbackFn Optional fallback to fill coverage gaps (defaults to none)
 */
export function mapBlueprintToActivities(
    blueprint: Record<string, unknown>,
    catalog: Activity[],
    techCategory: string,
    fallbackFn?: (activities: Activity[], excludeCodes: Set<string>) => Activity[],
): BlueprintMappingResult {
    const { byCode, byPrefix } = buildCatalogIndexes(catalog);
    const seen = new Set<string>();
    const blueprintActivities: MappedActivity[] = [];
    const warnings: CoverageWarning[] = [];

    // 1. Map components (primary structural mapping)
    const components = Array.isArray(blueprint.components) ? blueprint.components : [];
    const unmappedComponents: string[] = [];

    for (const comp of components) {
        if (!comp || typeof comp !== 'object') continue;
        const mapped = mapComponent(comp, techCategory, byCode, byPrefix, warnings);
        if (mapped.length === 0) {
            unmappedComponents.push(comp.name || '(unnamed)');
        }
        for (const m of mapped) {
            if (!seen.has(m.activity.code)) {
                seen.add(m.activity.code);
                blueprintActivities.push(m);
            }
        }
    }

    // 2. Map integrations
    const integrations = Array.isArray(blueprint.integrations) ? blueprint.integrations : [];
    if (integrations.length > 0) {
        for (const m of mapIntegrations(integrations, techCategory, byCode, byPrefix)) {
            if (!seen.has(m.activity.code)) {
                seen.add(m.activity.code);
                blueprintActivities.push(m);
            }
        }
    }

    // 3. Map data entities
    const dataEntities = Array.isArray(blueprint.dataEntities) ? blueprint.dataEntities : [];
    if (dataEntities.length > 0) {
        for (const m of mapDataEntities(dataEntities, techCategory, byCode, byPrefix)) {
            if (!seen.has(m.activity.code)) {
                seen.add(m.activity.code);
                blueprintActivities.push(m);
            }
        }
    }

    // 4. Map testing scope
    const testingScope = Array.isArray(blueprint.testingScope) ? blueprint.testingScope : [];
    if (testingScope.length > 0) {
        for (const m of mapTestingScope(testingScope, techCategory, byCode, byPrefix)) {
            if (!seen.has(m.activity.code)) {
                seen.add(m.activity.code);
                blueprintActivities.push(m);
            }
        }
    }

    // 5. Add cross-cutting activities
    for (const m of addCrossCuttingActivities(blueprint, byCode, byPrefix, seen, techCategory)) {
        seen.add(m.activity.code);
        blueprintActivities.push(m);
    }

    // 6. Coverage analysis
    const coveredGroups = new Set(blueprintActivities.map(m => m.activity.group));
    const allGroups = ['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'];
    const missingGroups = allGroups.filter(g => !coveredGroups.has(g));

    // 7. Fallback for coverage gaps
    const fallbackActivities: MappedActivity[] = [];
    if (fallbackFn && missingGroups.length > 0) {
        const gapFillers = fallbackFn(catalog, seen);
        for (const a of gapFillers) {
            if (!seen.has(a.code)) {
                seen.add(a.code);
                fallbackActivities.push({
                    activity: a,
                    provenance: 'keyword-fallback',
                    sourceLabel: `Gap-fill for missing groups: ${missingGroups.join(', ')}`,
                    confidence: 0.50,
                });
            }
        }
    }

    const componentCoveragePercent = components.length > 0
        ? Math.round(((components.length - unmappedComponents.length) / components.length) * 100)
        : 100;

    // ── Phase 4: Non-blocking coverage quality checks ──────────────────
    if (componentCoveragePercent < 50 && components.length > 0) {
        warnings.push({
            level: 'warn',
            code: 'LOW_COVERAGE',
            message: `Blueprint component coverage is ${componentCoveragePercent}% (${unmappedComponents.length}/${components.length} components unmapped). Estimation relies heavily on fallback.`,
        });
    }

    const totalMapped = blueprintActivities.length + fallbackActivities.length;
    if (totalMapped > 0 && fallbackActivities.length / totalMapped > 0.5) {
        warnings.push({
            level: 'warn',
            code: 'HIGH_FALLBACK_RATIO',
            message: `${fallbackActivities.length}/${totalMapped} activities (${Math.round(fallbackActivities.length / totalMapped * 100)}%) come from keyword fallback rather than blueprint mapping.`,
        });
    }

    if (unmappedComponents.length > 0) {
        warnings.push({
            level: 'info',
            code: 'UNMAPPED_COMPONENTS',
            message: `${unmappedComponents.length} component(s) could not be mapped: ${unmappedComponents.join(', ')}`,
        });
    }

    if (components.length === 0) {
        warnings.push({
            level: 'info',
            code: 'EMPTY_BLUEPRINT',
            message: 'Blueprint has no components. Only cross-cutting activities will be generated.',
        });
    }

    const coverage: CoverageReport = {
        coveredGroups: [...coveredGroups],
        missingGroups,
        unmappedComponents,
        componentCoveragePercent,
        totalActivities: blueprintActivities.length + fallbackActivities.length,
        fromBlueprint: blueprintActivities.length,
        fromFallback: fallbackActivities.length,
    };

    const allActivities = [...blueprintActivities, ...fallbackActivities];

    console.log(`[blueprint-mapper] Mapped ${blueprintActivities.length} from blueprint, ${fallbackActivities.length} from fallback. Coverage: ${componentCoveragePercent}%, groups: [${[...coveredGroups].join(',')}], missing: [${missingGroups.join(',')}]`);
    if (warnings.length > 0) {
        console.log(`[blueprint-mapper] Quality warnings (${warnings.length}):`);
        for (const w of warnings) {
            console.log(`  [${w.level.toUpperCase()}] ${w.code}: ${w.message}`);
        }
    }

    return {
        blueprintActivities,
        fallbackActivities,
        allActivities,
        coverage,
        warnings,
    };
}

/**
 * Check if a blueprint object has enough structure to be used for mapping.
 * Returns false for empty or trivially incomplete blueprints.
 */
export function isBlueprintMappable(blueprint: Record<string, unknown> | undefined): boolean {
    if (!blueprint || typeof blueprint !== 'object') return false;
    const components = Array.isArray(blueprint.components) ? blueprint.components : [];
    // Need at least 1 component with layer and interventionType
    return components.some(
        (c: any) => c && typeof c === 'object' && c.layer && c.interventionType
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Adapter — converts BlueprintMappingResult → NormalizedSignal[]
// ─────────────────────────────────────────────────────────────────────────────

/** Provenance string → canonical SignalKind mapping */
const PROVENANCE_TO_KIND: Record<string, SignalKind> = {
    'blueprint-component': 'blueprint-component',
    'blueprint-integration': 'blueprint-integration',
    'blueprint-data': 'blueprint-data',
    'blueprint-testing': 'blueprint-testing',
    'keyword-fallback': 'keyword-fallback',
    'multi-crosscutting': 'multi-crosscutting',
    'agent-discovered': 'agent-discovered',
};

/**
 * Convert a BlueprintMappingResult into canonical NormalizedSignal[].
 *
 * Each MappedActivity becomes a NormalizedSignal with:
 *   - score = confidence (0–1)
 *   - kind = mapped from provenance
 *   - source = 'blueprint'
 *   - layer = inferred from activity code prefix via LAYER_TECH_PATTERNS
 */
export function blueprintToNormalizedSignals(
    result: BlueprintMappingResult,
): SignalSet {
    const signals: NormalizedSignal[] = [];
    const unmapped: string[] = [];

    for (const mapped of result.allActivities) {
        const kind = PROVENANCE_TO_KIND[mapped.provenance] ?? 'blueprint-component';
        const layer = inferLayerFromCode(mapped.activity.code);

        signals.push({
            activityCode: mapped.activity.code,
            score: Math.min(1.0, Math.max(0, mapped.confidence)),
            kind,
            source: 'blueprint',
            confidence: mapped.confidence,
            contributions: {
                blueprint: mapped.confidence,
            },
            provenance: [
                `blueprint:${mapped.provenance}`,
                `source-label:${mapped.sourceLabel}`,
                `resolved:${mapped.activity.code}`,
            ],
            layer,
        });
    }

    for (const comp of result.coverage.unmappedComponents) {
        unmapped.push(comp);
    }

    return {
        signals,
        source: 'blueprint',
        diagnostics: {
            processed: result.coverage.fromBlueprint + result.coverage.fromFallback,
            produced: signals.length,
            unmapped,
        },
    };
}

/**
 * Infer PipelineLayer from an activity code prefix.
 * Uses known prefix conventions (PP_DV_FORM → frontend, BE_API → logic, etc.)
 */
function inferLayerFromCode(code: string): PipelineLayer | undefined {
    const upper = code.toUpperCase();
    if (upper.includes('_FORM') || upper.includes('_UI_') || upper.includes('_ANL_UX') || upper.includes('_DV_FORM')) return 'frontend';
    if (upper.includes('_API_') || upper.includes('_BUSINESS_RULE') || upper.includes('_STATE_')) return 'logic';
    if (upper.includes('_DB_') || upper.includes('_DV_FIELD') || upper.includes('_MIGRATION')) return 'data';
    if (upper.includes('_INT_') || upper.includes('_API_INTEGRATION')) return 'integration';
    if (upper.includes('_FLOW_') || upper.includes('_CRON') || upper.includes('_BATCH')) return 'automation';
    if (upper.includes('_LOGGING') || upper.includes('_CONFIG') || upper.includes('_DEPLOY')) return 'configuration';
    return undefined;
}
