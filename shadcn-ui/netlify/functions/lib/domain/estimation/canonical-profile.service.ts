/**
 * canonical-profile.service.ts — Post-save diagnostics and traceability
 *
 * NOT on the hot path of estimation. Runs after the snapshot is saved,
 * as a non-fatal step to materialise the CanonicalProfile, pin artifacts,
 * and surface conflicts to the UI and ReflectionEngine.
 *
 * Hot-path confidence computation is in aggregate-confidence.ts.
 *
 * Consumers:
 *   - save-orchestrator.ts   : buildCanonicalProfile, pinAnalysisToBlueprint, linkBlueprintToAnalysis
 *   - reflection-engine.ts   : formatConflictsBlock (agent path only)
 *   - RequirementDetailUI    : staleness warnings, conflict display
 */

import { getDomainSupabase } from '../../infrastructure/db/supabase';
import { computeAggregateConfidence } from './aggregate-confidence';
import type {
    RequirementAnalysisRow,
    CanonicalProfile,
    ConflictEntry,
    ConflictType,
    ConflictResolutionHint,
    StaleReasonCode,
    StructuralType,
    ArtifactSelectionStrategy,
} from '../../../../../src/types/domain-model';

// ─────────────────────────────────────────────────────────────────────────────
// Internal artifact shape helpers (JSONB deserialization)
// ─────────────────────────────────────────────────────────────────────────────

interface ImpactItem {
    layer: string;
    action: string;
    components: string[];
    confidence: number;
}

interface BlueprintComponent {
    name: string;
    layer: string;
    interventionType: string;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface BlueprintIntegration {
    target: string;
    type: string;
    direction?: 'inbound' | 'outbound' | 'bidirectional';
    notes?: string;
}

interface BlueprintDataEntity {
    entity: string;
    operation: 'read' | 'write' | 'create' | 'modify' | 'delete';
}

interface BlueprintTestingScope {
    area: string;
    testType: string;
    criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

function getImpacts(impactMap: Record<string, unknown> | null): ImpactItem[] {
    if (!impactMap) return [];
    const raw = impactMap['impacts'];
    return Array.isArray(raw) ? (raw as ImpactItem[]) : [];
}

function getComponents(blueprint: Record<string, unknown>): BlueprintComponent[] {
    const raw = blueprint['components'];
    return Array.isArray(raw) ? (raw as BlueprintComponent[]) : [];
}

function getIntegrations(blueprint: Record<string, unknown>): BlueprintIntegration[] {
    const raw = blueprint['integrations'];
    return Array.isArray(raw) ? (raw as BlueprintIntegration[]) : [];
}

function getDataEntities(blueprint: Record<string, unknown>): BlueprintDataEntity[] {
    const raw = blueprint['dataEntities'];
    return Array.isArray(raw) ? (raw as BlueprintDataEntity[]) : [];
}

function getTestingScope(blueprint: Record<string, unknown>): BlueprintTestingScope[] {
    const raw = blueprint['testingScope'];
    return Array.isArray(raw) ? (raw as BlueprintTestingScope[]) : [];
}

function getStringArray(obj: Record<string, unknown> | null, key: string): string[] {
    if (!obj) return [];
    const raw = obj[key];
    return Array.isArray(raw) ? raw.map(String) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. detectConflicts — 5 rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect semantic conflicts between the three artifacts.
 * Conflicts are informational — they never block the pipeline.
 * They are surfaced to ReflectionEngine and RequirementDetailUI.
 */
export function detectConflicts(
    understanding: Record<string, unknown> | null,
    impactMap: Record<string, unknown> | null,
    blueprint: Record<string, unknown>,
): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];
    const impacts = getImpacts(impactMap);
    const components = getComponents(blueprint);
    const integrations = getIntegrations(blueprint);
    const dataEntities = getDataEntities(blueprint);
    const testingScope = getTestingScope(blueprint);

    // ── Rule 1: Complexity mismatch ─────────────────────────────────────────
    // understanding says LOW but multiple blueprint components are HIGH, or vice versa
    const uComplexity = (understanding?.['complexityAssessment'] as any)?.level as string | undefined;
    const highComponents = components.filter(c => c.complexity === 'HIGH');
    const lowComponents = components.filter(c => c.complexity === 'LOW');

    if (uComplexity === 'LOW' && highComponents.length >= 2) {
        const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
        const uConfidence = (understanding?.['confidence'] as number) ?? 0;
        conflicts.push({
            type: 'complexity_mismatch',
            severity: 'medium',
            description: `Understanding dichiara complessità LOW ma ${highComponents.length} componenti del blueprint sono HIGH (${highComponents.map(c => c.name).join(', ')}).`,
            field: 'inferredComplexity',
            sourceA: 'understanding',
            valueA: 'LOW',
            sourceB: 'blueprint',
            valueB: `${highComponents.length} componenti HIGH`,
            confidenceDelta: Math.abs(uConfidence - bpConfidence),
            resolutionHint: 'prefer_blueprint',
        });
    }

    if (uComplexity === 'HIGH' && components.length > 0 && components.every(c => c.complexity === 'LOW')) {
        const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
        const uConfidence = (understanding?.['confidence'] as number) ?? 0;
        conflicts.push({
            type: 'complexity_mismatch',
            severity: 'medium',
            description: `Understanding dichiara complessità HIGH ma tutti i componenti del blueprint sono LOW.`,
            field: 'inferredComplexity',
            sourceA: 'understanding',
            valueA: 'HIGH',
            sourceB: 'blueprint',
            valueB: 'tutti i componenti LOW',
            confidenceDelta: Math.abs(uConfidence - bpConfidence),
            resolutionHint: 'manual_review',
        });
    }

    // ── Rule 2: Layer coverage mismatch ─────────────────────────────────────
    // Blueprint has components on a layer not reflected in impact_map, with >= 2 components
    if (impacts.length > 0) {
        const impactLayers = new Set(impacts.map(i => i.layer));
        const bpLayerCounts = new Map<string, number>();
        for (const c of components) {
            bpLayerCounts.set(c.layer, (bpLayerCounts.get(c.layer) ?? 0) + 1);
        }

        for (const [layer, count] of bpLayerCounts.entries()) {
            if (count >= 2 && !impactLayers.has(layer)) {
                const imConfidence = (impactMap?.['overallConfidence'] as number) ?? 0;
                const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
                conflicts.push({
                    type: 'layer_coverage_mismatch',
                    severity: 'high',
                    description: `Blueprint ha ${count} componenti sul layer "${layer}" ma l'impact map non include questo layer tra quelli impattati.`,
                    field: 'impactedLayers',
                    sourceA: 'blueprint',
                    valueA: `${count} componenti su ${layer}`,
                    sourceB: 'impact_map',
                    valueB: `layer ${layer} assente`,
                    confidenceDelta: Math.abs(bpConfidence - imConfidence),
                    resolutionHint: 'prefer_blueprint',
                });
            }
        }
    }

    // ── Rule 3: Integration underdeclared ───────────────────────────────────
    // Bidirectional integrations in blueprint but no 'integration' layer in impact_map
    const hasBidirectional = integrations.some(i => i.direction === 'bidirectional');
    const hasIntegrationLayer = impacts.some(i => i.layer === 'integration');

    if (hasBidirectional && !hasIntegrationLayer && impacts.length > 0) {
        const imConfidence = (impactMap?.['overallConfidence'] as number) ?? 0;
        const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
        const bidiNames = integrations.filter(i => i.direction === 'bidirectional').map(i => i.target).join(', ');
        conflicts.push({
            type: 'integration_underdeclared',
            severity: 'high',
            description: `Blueprint include integrazioni bidirezionali (${bidiNames}) ma l'impact map non indica il layer "integration" come impattato.`,
            field: 'integrations',
            sourceA: 'blueprint',
            valueA: `integrazioni bidirezionali: ${bidiNames}`,
            sourceB: 'impact_map',
            valueB: 'layer integration assente',
            confidenceDelta: Math.abs(bpConfidence - imConfidence),
            resolutionHint: 'prefer_blueprint',
        });
    }

    // ── Rule 4: Data entity vs. read-only claim ─────────────────────────────
    // Blueprint creates/writes data entities, but impact_map data layer is read-only
    const writingEntities = dataEntities.filter(d =>
        ['create', 'write', 'modify', 'delete'].includes(d.operation),
    );
    const dataImpacts = impacts.filter(i => i.layer === 'data');
    const dataIsReadOnly = dataImpacts.length > 0 && dataImpacts.every(i => i.action === 'read');

    if (writingEntities.length > 0 && dataIsReadOnly) {
        const imConfidence = (impactMap?.['overallConfidence'] as number) ?? 0;
        const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
        conflicts.push({
            type: 'data_entity_vs_readonly',
            severity: 'medium',
            description: `Blueprint scrive/crea entità dati (${writingEntities.map(e => e.entity).join(', ')}) ma l'impact map dichiara il layer "data" come solo lettura.`,
            field: 'dataEntities',
            sourceA: 'blueprint',
            valueA: `${writingEntities.length} entità write/create`,
            sourceB: 'impact_map',
            valueB: 'data layer action=read',
            confidenceDelta: Math.abs(bpConfidence - imConfidence),
            resolutionHint: 'prefer_blueprint',
        });
    }

    // ── Rule 5: Testing criticality vs. declared complexity ─────────────────
    const hasCriticalTesting = testingScope.some(t => t.criticality === 'CRITICAL');
    if (hasCriticalTesting && uComplexity === 'LOW') {
        const bpConfidence = (blueprint['overallConfidence'] as number) ?? 0;
        const uConfidence = (understanding?.['confidence'] as number) ?? 0;
        conflicts.push({
            type: 'testing_criticality_vs_complexity',
            severity: 'low',
            description: `Blueprint richiede testing CRITICAL ma l'understanding dichiara complessità LOW. Potrebbe indicare un requisito sotto-dimensionato.`,
            field: 'testingScope',
            sourceA: 'blueprint',
            valueA: 'testing CRITICAL',
            sourceB: 'understanding',
            valueB: 'complexity LOW',
            confidenceDelta: Math.abs(bpConfidence - uConfidence),
            resolutionHint: 'manual_review',
        });
    }

    return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. evaluateStaleReasons — 5 rules, lazy
// ─────────────────────────────────────────────────────────────────────────────

interface StaleEvalInput {
    analysisCreatedAt: Date;
    /** Latest version of each artifact type for this requirement (from a single MAX query) */
    latestBlueprintVersion: number | null;
    latestUnderstandingVersion: number | null;
    latestImpactMapVersion: number | null;
    /** Pinned versions from when the analysis was created */
    pinnedBlueprintVersion: number | null;
    /** Project technical blueprint version at pin time (from snapshot) */
    snapshotPtbVersion?: number | null;
    /** Current project technical blueprint version (from live DB) */
    currentPtbVersion?: number | null;
    /** Project context at pin time */
    projectContextSnapshot?: Record<string, unknown> | null;
    /** Current project context */
    currentProjectContext?: Record<string, unknown> | null;
}

const PROJECT_CONTEXT_STALENESS_FIELDS = ['scope', 'deadlinePressure', 'projectType'] as const;

export function evaluateStaleReasons(input: StaleEvalInput): StaleReasonCode[] {
    const reasons: StaleReasonCode[] = [];

    // Rule 1: A newer blueprint version exists
    if (
        input.pinnedBlueprintVersion !== null &&
        input.latestBlueprintVersion !== null &&
        input.latestBlueprintVersion > input.pinnedBlueprintVersion
    ) {
        reasons.push('BLUEPRINT_UPDATED');
    }

    // Rule 2: A newer understanding exists (version-based check)
    // We use the pinned blueprint's based_on_understanding_id as anchor.
    // If a newer understanding version appeared after the analysis, flag it.
    if (
        input.latestUnderstandingVersion !== null &&
        input.pinnedBlueprintVersion !== null &&
        input.latestUnderstandingVersion > input.pinnedBlueprintVersion
    ) {
        reasons.push('UNDERSTANDING_UPDATED');
    }

    // Rule 3: A newer impact map version exists
    if (
        input.latestImpactMapVersion !== null &&
        input.pinnedBlueprintVersion !== null &&
        input.latestImpactMapVersion > input.pinnedBlueprintVersion
    ) {
        reasons.push('IMPACT_MAP_UPDATED');
    }

    // Rule 4: Project technical blueprint updated after analysis
    if (
        input.snapshotPtbVersion !== null &&
        input.snapshotPtbVersion !== undefined &&
        input.currentPtbVersion !== null &&
        input.currentPtbVersion !== undefined &&
        input.currentPtbVersion > input.snapshotPtbVersion
    ) {
        reasons.push('PROJECT_BLUEPRINT_UPDATED');
    }

    // Rule 5: Key project context fields changed
    if (input.projectContextSnapshot && input.currentProjectContext) {
        const changed = PROJECT_CONTEXT_STALENESS_FIELDS.some(
            field =>
                input.projectContextSnapshot![field] !== input.currentProjectContext![field],
        );
        if (changed) {
            reasons.push('PROJECT_CONTEXT_CHANGED');
        }
    }

    return reasons;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. inferStructuralType — deterministic classification
// ─────────────────────────────────────────────────────────────────────────────

export function inferStructuralType(
    blueprint: Record<string, unknown>,
    impactMap: Record<string, unknown> | null,
    understanding: Record<string, unknown> | null,
): StructuralType {
    const integrations = getIntegrations(blueprint);
    const dataEntities = getDataEntities(blueprint);
    const impacts = getImpacts(impactMap);
    const actors: unknown[] = Array.isArray(understanding?.['actors']) ? understanding!['actors'] as unknown[] : [];
    const hasStateTransition = !!(understanding?.['stateTransition'] &&
        (understanding['stateTransition'] as any)?.initialState &&
        (understanding['stateTransition'] as any)?.finalState);

    // INTEGRATION: 2+ integrations or impact_map has integration layer
    if (integrations.length >= 2 || impacts.some(i => i.layer === 'integration')) {
        return 'INTEGRATION';
    }

    // WORKFLOW: multiple actors + state transition
    if (actors.length >= 2 && hasStateTransition) {
        return 'WORKFLOW';
    }

    // REPORT: all data entities are read-only, no write operations
    const writeEntities = dataEntities.filter(d =>
        ['create', 'write', 'modify', 'delete'].includes(d.operation),
    );
    if (dataEntities.length > 0 && writeEntities.length === 0 && integrations.length === 0) {
        return 'REPORT';
    }

    // CRUD: data entities with write operations and no integrations
    if (writeEntities.length > 0 && integrations.length === 0) {
        return 'CRUD';
    }

    return 'MIXED';
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. buildCanonicalSearchText — format v1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the canonical search text used to generate the semantic embedding.
 * Keys are uppercase fixed labels for stable embedding representation.
 * Format version: 1 (increment canonical_embedding_version when changing).
 */
export function buildCanonicalSearchText(profile: CanonicalProfile): string {
    const bp = profile.blueprint;
    const im = profile.impactMap;
    const u = profile.understanding;

    const actors: unknown[] = Array.isArray(u?.['actors']) ? u!['actors'] as unknown[] : [];
    const functionalPerimeter: string[] = Array.isArray(u?.['functionalPerimeter'])
        ? (u!['functionalPerimeter'] as string[]).slice(0, 6)
        : [];
    const assumptions: string[] = [
        ...getStringArray(u, 'assumptions'),
        ...getStringArray(bp, 'assumptions'),
    ].slice(0, 4);

    const impacts = getImpacts(im);
    const components = getComponents(bp);
    const integrations = getIntegrations(bp);
    const dataEntities = getDataEntities(bp);
    const testingScope = getTestingScope(bp);

    const uniqueLayers = [...new Set(impacts.map(i => i.layer))].sort().join(' ');
    const uniqueActions = [...new Set(impacts.map(i => i.action))].sort().join(' ');

    const compStr = components.map(c => `${c.layer}:${c.complexity}`).join('; ');
    const intgStr = integrations.map(i => `${i.target}:${i.direction ?? 'unknown'}`).join(', ');
    const dataStr = dataEntities.map(d => `${d.entity}:${d.operation}`).join(', ');

    const criticalTests = testingScope
        .filter(t => t.criticality === 'HIGH' || t.criticality === 'CRITICAL')
        .map(t => `${t.area}:${t.testType}`)
        .join(', ');

    const dataWriteCount = dataEntities.filter(d =>
        ['write', 'create', 'modify', 'delete'].includes(d.operation),
    ).length;

    const actorStr = actors
        .map(a => {
            const actor = a as { role?: string; type?: string };
            return `${actor.role ?? ''}(${actor.type ?? ''})`;
        })
        .join(', ');

    const conflictStr = profile.conflicts
        .map(c => `${c.type}:${c.severity}`)
        .join(', ');

    const lines = [
        `OBJ: ${String(u?.['businessObjective'] ?? '')}`,
        `OUT: ${String(u?.['expectedOutput'] ?? '')}`,
        `PER: ${functionalPerimeter.join(' | ')}`,
        `ACT: ${actorStr}`,
        `CPX: ${profile.inferredComplexity}`,
        `TYPE: ${profile.structuralType}`,
        `LAYERS: ${uniqueLayers}`,
        `ACTIONS: ${uniqueActions}`,
        `COMP: ${compStr}`,
        `COMP_COUNT: ${components.length}`,
        `INTG: ${intgStr}`,
        `INTG_COUNT: ${integrations.length}`,
        `DATA: ${dataStr}`,
        `DATA_WRITE_COUNT: ${dataWriteCount}`,
        `TEST: ${criticalTests}`,
        `ASSUM: ${assumptions.join(' | ')}`,
        `CONFLICTS: ${conflictStr}`,
    ];

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. buildCanonicalProfile — main entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildCanonicalProfileOptions {
    /** How to select the blueprint anchor. Default: 'latest'. */
    strategy?: ArtifactSelectionStrategy;
    /** Include canonicalSearchText in the output. Default: false (on-demand). */
    includeSearchText?: boolean;
    /** Current project context for stale evaluation (optional). */
    currentProjectContext?: Record<string, unknown> | null;
    /** Current project technical blueprint version for stale evaluation (optional). */
    currentPtbVersion?: number | null;
}

/**
 * Materialize the CanonicalProfile for a requirement.
 *
 * Returns null if no estimation_blueprint exists for the requirement —
 * callers degrade gracefully to using raw artifacts as today.
 */
export async function buildCanonicalProfile(
    requirementId: string,
    options: BuildCanonicalProfileOptions = {},
): Promise<CanonicalProfile | null> {
    const { strategy = 'latest', includeSearchText = false } = options;
    const sb = getDomainSupabase();

    // ── Step 1: Load requirement_analyses hub ──────────────────────────────
    const { data: analysisRow, error: analysisError } = await sb
        .from('requirement_analyses')
        .select('*')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (analysisError) {
        console.warn('[canonical-profile] Failed to load analysis:', analysisError.message);
        return null;
    }

    const analysis = analysisRow as RequirementAnalysisRow | null;

    // ── Step 2: Select blueprint anchor ───────────────────────────────────
    let blueprintQuery = sb
        .from('estimation_blueprint')
        .select('*')
        .eq('requirement_id', requirementId);

    if (strategy === 'pinned' && analysis?.pinned_blueprint_id) {
        blueprintQuery = sb
            .from('estimation_blueprint')
            .select('*')
            .eq('id', analysis.pinned_blueprint_id);
    } else if (strategy === 'highest_confidence') {
        blueprintQuery = blueprintQuery
            .order('confidence_score', { ascending: false, nullsFirst: false })
            .order('version', { ascending: false });
    } else {
        // 'latest' or 'pinned' without a pinned_blueprint_id (fallback)
        blueprintQuery = blueprintQuery.order('version', { ascending: false });
    }

    const { data: blueprintRow, error: blueprintError } = await blueprintQuery.limit(1).maybeSingle();

    if (blueprintError || !blueprintRow) {
        // No blueprint — graceful degrade
        return null;
    }

    const blueprint = blueprintRow as Record<string, unknown>;
    const bpId = blueprint['id'] as string;
    const bpVersion = blueprint['version'] as number;

    // ── Step 3: Traverse upstream artifacts from blueprint ─────────────────
    const understandingId = blueprint['based_on_understanding_id'] as string | null;
    const impactMapArtifactId = blueprint['based_on_impact_map_id'] as string | null;

    const [understandingResult, impactMapResult] = await Promise.all([
        understandingId
            ? sb.from('requirement_understanding').select('*').eq('id', understandingId).maybeSingle()
            : sb.from('requirement_understanding').select('*').eq('requirement_id', requirementId)
                .order('version', { ascending: false }).limit(1).maybeSingle(),
        impactMapArtifactId
            ? sb.from('impact_map').select('*').eq('id', impactMapArtifactId).maybeSingle()
            : sb.from('impact_map').select('*').eq('requirement_id', requirementId)
                .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Extract JSONB payloads — table-specific field names
    const understandingPayload = understandingResult.data
        ? (understandingResult.data as Record<string, unknown>)['understanding'] as Record<string, unknown>
        : null;
    const impactMapPayload = impactMapResult.data
        ? (impactMapResult.data as Record<string, unknown>)['impact_map'] as Record<string, unknown>
        : null;
    const blueprintPayload = blueprint['blueprint'] as Record<string, unknown>;

    // ── Step 4: Compute derived fields ─────────────────────────────────────
    const conflicts = detectConflicts(understandingPayload, impactMapPayload, blueprintPayload);
    const structuralType = inferStructuralType(blueprintPayload, impactMapPayload, understandingPayload);

    // Complexity: understanding is canonical; fallback to blueprint component mode
    const uComplexity = (understandingPayload?.['complexityAssessment'] as any)?.level as
        | 'LOW'
        | 'MEDIUM'
        | 'HIGH'
        | undefined;
    const inferredComplexity: 'LOW' | 'MEDIUM' | 'HIGH' = uComplexity ?? inferComplexityFromBlueprint(blueprintPayload);

    // ── Step 5: Stale evaluation ──────────────────────────────────────────
    const [latestBpVersionResult, latestRuVersionResult, latestImVersionResult] = await Promise.all([
        sb.from('estimation_blueprint').select('version').eq('requirement_id', requirementId)
            .order('version', { ascending: false }).limit(1).maybeSingle(),
        sb.from('requirement_understanding').select('version').eq('requirement_id', requirementId)
            .order('version', { ascending: false }).limit(1).maybeSingle(),
        sb.from('impact_map').select('version').eq('requirement_id', requirementId)
            .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const snapshotPtb = analysis?.project_technical_baseline_snapshot as Record<string, unknown> | null;
    const snapshotPtbVersion = (snapshotPtb?.['version'] as number) ?? null;

    const staleReasons = evaluateStaleReasons({
        analysisCreatedAt: analysis ? new Date(analysis.created_at) : new Date(),
        latestBlueprintVersion: (latestBpVersionResult.data?.['version'] as number) ?? null,
        latestUnderstandingVersion: (latestRuVersionResult.data?.['version'] as number) ?? null,
        latestImpactMapVersion: (latestImVersionResult.data?.['version'] as number) ?? null,
        pinnedBlueprintVersion: bpVersion,
        snapshotPtbVersion,
        currentPtbVersion: options.currentPtbVersion ?? null,
        projectContextSnapshot: analysis?.project_context_snapshot ?? null,
        currentProjectContext: options.currentProjectContext ?? null,
    });

    const isStale = staleReasons.length > 0;
    const stalenessStrict = process.env.STALENESS_STRICT === 'true';
    const requiresRegeneration = isStale;

    if (isStale) {
        console.log(`[canonical-profile] Staleness detected: reasons=[${staleReasons.join(', ')}], strict=${stalenessStrict}, requiresRegeneration=${requiresRegeneration}`);
        if (stalenessStrict) {
            throw new Error(`Stale artifacts must be regenerated before estimation. Reasons: ${staleReasons.join(', ')}`);
        }
    }

    const aggregateConfidence = computeAggregateConfidence(
        understandingPayload,
        impactMapPayload,
        blueprintPayload,
        isStale,
    );

    // ── Step 6: Assemble profile ──────────────────────────────────────────
    const profile: CanonicalProfile = {
        requirementId,
        analysisId: analysis?.id ?? null,
        pinnedBlueprintId: bpId,
        pinnedBlueprintVersion: bpVersion,
        understanding: understandingPayload,
        impactMap: impactMapPayload,
        blueprint: blueprintPayload,
        inferredComplexity,
        aggregateConfidence,
        structuralType,
        conflicts,
        isStale,
        staleReasons,
        requiresRegeneration,
        projectContextSnapshot: (analysis?.project_context_snapshot as Record<string, unknown>) ?? null,
        projectTechnicalBaselineSnapshot: (analysis?.project_technical_baseline_snapshot as Record<string, unknown>) ?? null,
    };

    if (includeSearchText) {
        profile.canonicalSearchText = buildCanonicalSearchText(profile);
    }

    return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inferComplexityFromBlueprint(blueprint: Record<string, unknown>): 'LOW' | 'MEDIUM' | 'HIGH' {
    const components = getComponents(blueprint);
    if (components.length === 0) return 'MEDIUM';
    const highCount = components.filter(c => c.complexity === 'HIGH').length;
    const lowCount = components.filter(c => c.complexity === 'LOW').length;
    if (highCount > components.length / 2) return 'HIGH';
    if (lowCount > components.length / 2) return 'LOW';
    return 'MEDIUM';
}

// ─────────────────────────────────────────────────────────────────────────────
// pinAnalysisToBlueprint — called by save-orchestrator after wizard completion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pin the canonical hub (requirement_analyses) to the given blueprint.
 * Also persists conflicts, stale state, and context snapshots.
 * Called once at the end of the wizard, before estimation persistence.
 */
export async function pinAnalysisToBlueprint(
    analysisId: string,
    profile: CanonicalProfile,
): Promise<void> {
    const sb = getDomainSupabase();
    const { error } = await sb
        .from('requirement_analyses')
        .update({
            pinned_blueprint_id: profile.pinnedBlueprintId,
            pinned_blueprint_version: profile.pinnedBlueprintVersion,
            conflicts: profile.conflicts,
            is_stale: profile.isStale,
            stale_reasons: profile.staleReasons,
            project_context_snapshot: profile.projectContextSnapshot ?? null,
            project_technical_baseline_snapshot: profile.projectTechnicalBaselineSnapshot ?? null,
            // Embedding: marked stale until async job generates it
            is_embedding_stale: true,
        })
        .eq('id', analysisId);

    if (error) {
        // Non-fatal: log and continue — the estimation save must not be blocked
        console.warn('[canonical-profile] Failed to pin analysis to blueprint:', error.message);
    }
}

/**
 * Also link the blueprint back to its analysis session.
 * Called alongside pinAnalysisToBlueprint.
 */
export async function linkBlueprintToAnalysis(
    blueprintId: string,
    analysisId: string,
): Promise<void> {
    const sb = getDomainSupabase();
    const { error } = await sb
        .from('estimation_blueprint')
        .update({ analysis_id: analysisId })
        .eq('id', blueprintId)
        .is('analysis_id', null);  // only set if not already linked (idempotent)

    if (error) {
        console.warn('[canonical-profile] Failed to link blueprint to analysis:', error.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// formatConflictsBlock — for ReflectionEngine prompt injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format ConflictEntry[] into a prompt block for ReflectionEngine.
 * Only medium + high severity conflicts are included (low = noise for LLM).
 * Returns empty string if no relevant conflicts.
 */
export function formatConflictsBlock(conflicts: ConflictEntry[]): string {
    const relevant = conflicts.filter(c => c.severity === 'medium' || c.severity === 'high');
    if (relevant.length === 0) return '';

    const lines = relevant.map(c => {
        const hint = c.resolutionHint === 'prefer_blueprint'
            ? 'Il blueprint è la fonte più affidabile.'
            : c.resolutionHint === 'prefer_impact_map'
                ? "L'impact map è la fonte più affidabile."
                : 'Richiede revisione manuale.';
        return `  - [${c.severity.toUpperCase()}] ${c.type}: ${c.description} → ${hint}`;
    });

    return `\nCONFLITTI GIÀ RILEVATI TRA ARTEFATTI:\n${lines.join('\n')}\n` +
        `(Questi conflitti sono stati rilevati prima della generazione. Considerali nella review.)\n`;
}
