/**
 * blueprint-rules.ts — Deterministic blueprint-level rules engine
 *
 * Translates a ProjectTechnicalBlueprint into concrete biases,
 * suggested drivers/risks, and traceability notes.
 *
 * Mirrors the pattern from project-context-rules.ts but operates
 * on the blueprint's architectural structure rather than project metadata.
 *
 * NO side effects. NO database calls. NO AI. Fully testable.
 */

import type {
    ProjectTechnicalBlueprint,
    BlueprintRelation,
    BlueprintComponent,
} from '../../domain/project/project-technical-blueprint.types';
import type {
    ActivityBiases,
    ProjectContextRuleSuggestion,
} from './project-context-rules';

// ─── Output type ────────────────────────────────────────────────

export interface BlueprintRuleResult {
    activityBiases: ActivityBiases;
    suggestedDrivers: ProjectContextRuleSuggestion[];
    suggestedRisks: ProjectContextRuleSuggestion[];
    notes: string[];
}

// ─── Main entry point ───────────────────────────────────────────

/**
 * Evaluate all blueprint-level rules and return a unified result.
 *
 * If blueprint is missing/null, returns a neutral (empty) result.
 */
export function evaluateProjectTechnicalBlueprintRules(
    blueprint?: ProjectTechnicalBlueprint | null,
): BlueprintRuleResult {
    const result: BlueprintRuleResult = {
        activityBiases: {},
        suggestedDrivers: [],
        suggestedRisks: [],
        notes: [],
    };

    if (!blueprint) return result;

    applyIntegrationRules(blueprint, result);
    applyDataDomainRules(blueprint, result);
    applyWorkflowExternalRules(blueprint, result);
    applyDatabasePresenceRules(blueprint, result);
    applyEvidenceWeightRules(blueprint, result);
    applyRelationComplexityRules(blueprint, result);
    applyCriticalityRules(blueprint, result);

    return result;
}

// ─── Integration rules ─────────────────────────────────────────

function applyIntegrationRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const bidirectionalCount = bp.integrations.filter(
        (i) => i.direction === 'bidirectional',
    ).length;

    if (bidirectionalCount >= 2) {
        r.activityBiases.boostGroups = [
            ...(r.activityBiases.boostGroups ?? []),
            'INTEGRATION', 'TESTING', 'END_TO_END',
        ];
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            'integration', 'api', 'interface', 'test', 'end-to-end', 'e2e',
        ];
        r.suggestedRisks.push({
            code: 'INTEGRATION_COMPLEXITY_RISK',
            reason: `${bidirectionalCount} bidirectional integrations detected — synchronization and error handling complexity increases.`,
            source: 'project_context_rule',
            rule: 'blueprint_bidirectional_integrations',
        });
        r.notes.push(
            `[blueprint_integrations] ${bidirectionalCount} bidirectional integrations — boosting integration/testing activities, added integration risk.`,
        );
    }

    if (bp.integrations.length >= 4) {
        r.suggestedDrivers.push({
            code: 'INTEGRATION_EFFORT',
            reason: `${bp.integrations.length} external integrations — significant interface management effort expected.`,
            source: 'project_context_rule',
            rule: 'blueprint_many_integrations',
        });
        r.notes.push(
            `[blueprint_integrations] ${bp.integrations.length} integrations total — suggested integration effort driver.`,
        );
    }
}

// ─── Data domain rules ──────────────────────────────────────────

function applyDataDomainRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const coreDataDomains = bp.dataDomains.filter(
        (d) => d.businessCriticality === 'high',
    ).length;
    const totalDataDomains = bp.dataDomains.length;

    if (coreDataDomains >= 2 || totalDataDomains >= 4) {
        r.activityBiases.boostGroups = [
            ...(r.activityBiases.boostGroups ?? []),
            'DATA', 'MIGRATION', 'MODELING',
        ];
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            'data', 'modeling', 'migration', 'reconciliation', 'schema', 'database',
        ];
        r.notes.push(
            `[blueprint_data_domains] ${totalDataDomains} data domains (${coreDataDomains} high-criticality) — boosting data modeling/migration activities.`,
        );
    }
}

// ─── Workflow + external systems + reporting ────────────────────

function applyWorkflowExternalRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const hasWorkflow = bp.components.some((c) => c.type === 'workflow');
    const hasExternalSystems = bp.integrations.length > 0;
    const hasReporting = bp.components.some((c) => c.type === 'reporting');

    if (hasWorkflow && hasExternalSystems && hasReporting) {
        r.suggestedRisks.push({
            code: 'COORDINATION_RISK',
            reason: 'Workflow + external systems + reporting detected — coordination complexity risk.',
            source: 'project_context_rule',
            rule: 'blueprint_workflow_external_reporting',
        });
        r.suggestedRisks.push({
            code: 'TIMELINE_RISK',
            reason: 'Complex orchestration with external dependencies may extend timeline.',
            source: 'project_context_rule',
            rule: 'blueprint_coordination_timeline',
        });
        r.notes.push(
            '[blueprint_orchestration] Workflow + external systems + reporting pattern detected — added coordination and timeline risks.',
        );
    }
}

// ─── Database presence check ────────────────────────────────────

function applyDatabasePresenceRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const hasDatabase = bp.components.some((c) => c.type === 'database');
    const hasDataDomains = bp.dataDomains.length > 0;

    if (!hasDatabase && hasDataDomains) {
        r.suggestedRisks.push({
            code: 'MISSING_DATABASE_RISK',
            reason: `Data domains present (${bp.dataDomains.length}) but no database component detected — storage layer may be missing or implicit.`,
            source: 'project_context_rule',
            rule: 'blueprint_no_database_with_data',
        });
        r.notes.push(
            '[blueprint_database] Data domains without database component — strong warning: storage layer unclear.',
        );
    }
}

// ─── Evidence quality weight ────────────────────────────────────

function applyEvidenceWeightRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const allNodes = [
        ...bp.components,
        ...bp.dataDomains,
        ...bp.integrations,
    ];
    const nodesWithoutEvidence = allNodes.filter(
        (n) => !n.evidence || n.evidence.length === 0,
    ).length;
    const ratio = allNodes.length > 0 ? nodesWithoutEvidence / allNodes.length : 0;

    if (ratio > 0.5) {
        r.notes.push(
            `[blueprint_evidence] ${Math.round(ratio * 100)}% of nodes lack evidence — blueprint weight in biases reduced. Results should be interpreted with caution.`,
        );
        // Don't add strong biases from blueprint if evidence is weak
        r.activityBiases.boostGroups = [];
        r.activityBiases.boostKeywords = [];
    }
}

// ─── Relation complexity ────────────────────────────────────────

function applyRelationComplexityRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const relations = bp.relations ?? [];
    if (relations.length === 0) return;

    // Check for orchestration patterns
    const orchestrationRelations = relations.filter((rel) => rel.type === 'orchestrates');
    if (orchestrationRelations.length >= 2) {
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            'orchestration', 'coordination', 'workflow', 'pipeline',
        ];
        r.notes.push(
            `[blueprint_relations] ${orchestrationRelations.length} orchestration relations — complex coordination expected.`,
        );
    }

    // Check for high dependency depth
    const dependsOnRelations = relations.filter((rel) => rel.type === 'depends_on');
    if (dependsOnRelations.length >= 3) {
        r.suggestedRisks.push({
            code: 'DEPENDENCY_CHAIN_RISK',
            reason: `${dependsOnRelations.length} dependency relations — change propagation risk across the chain.`,
            source: 'project_context_rule',
            rule: 'blueprint_dependency_depth',
        });
        r.notes.push(
            `[blueprint_relations] ${dependsOnRelations.length} depends_on relations — dependency chain risk added.`,
        );
    }
}

// ─── High criticality concentration ─────────────────────────────

function applyCriticalityRules(
    bp: ProjectTechnicalBlueprint,
    r: BlueprintRuleResult,
): void {
    const highCriticalityCount = [
        ...bp.components,
        ...bp.dataDomains,
        ...bp.integrations,
    ].filter((n) => n.businessCriticality === 'high').length;

    if (highCriticalityCount >= 3) {
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            'testing', 'validation', 'review', 'quality',
        ];
        r.suggestedDrivers.push({
            code: 'QUALITY_ASSURANCE_EFFORT',
            reason: `${highCriticalityCount} high-criticality nodes — elevated QA and validation effort expected.`,
            source: 'project_context_rule',
            rule: 'blueprint_high_criticality_concentration',
        });
        r.notes.push(
            `[blueprint_criticality] ${highCriticalityCount} high-criticality nodes — boosting testing/validation and adding QA driver.`,
        );
    }
}
