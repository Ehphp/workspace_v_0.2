/**
 * blueprint-quality-score.ts — Deterministic quality scoring for Project Technical Blueprints
 *
 * Separates three distinct concepts:
 *   - **confidence**: correctness of the AI extraction (set by AI, 0–1)
 *   - **coverage**: breadth of architectural coverage (set by normalizer heuristic, 0–1)
 *   - **qualityScore**: structural quality post-normalization (computed here, 0–1)
 *
 * Quality score starts at 1.0 and applies penalties for structural issues.
 * It can only be improved by fixing the underlying problems (e.g. adding evidence,
 * reviewing nodes, fixing empty columns).
 */

import type { ProjectTechnicalBlueprint } from './project-technical-blueprint.types';

// ─── Penalty weights ────────────────────────────────────────────

const PENALTIES = {
    /** An entire column (components / dataDomains / integrations) is empty */
    emptyColumn: 0.12,
    /** More than 30% of nodes flagged as generic */
    tooManyGenericNodes: 0.08,
    /** A core node (high businessCriticality) has zero evidence */
    coreNodeWithoutEvidence: 0.06,
    /** No relations at all */
    missingRelations: 0.10,
    /** More than 50% of nodes are un-reviewed (draft) */
    majorityUnreviewed: 0.05,
    /** A data domain has no owning component */
    dataDomainWithoutOwner: 0.04,
    /** An integration has no connected component */
    integrationWithoutComponent: 0.04,
    /** Very low coverage (< 0.3) */
    veryLowCoverage: 0.08,
    /** Very low confidence (< 0.3) */
    veryLowConfidence: 0.06,
} as const;

// ─── Output type ────────────────────────────────────────────────

export interface BlueprintQualityResult {
    /** Final score 0–1, rounded to 2 decimals */
    qualityScore: number;
    /** Individual penalties applied */
    penalties: { reason: string; amount: number }[];
    /** Human-readable verdict */
    verdict: 'excellent' | 'good' | 'fair' | 'poor';
}

// ─── Main function ──────────────────────────────────────────────

export function computeBlueprintQualityScore(
    blueprint: ProjectTechnicalBlueprint,
): BlueprintQualityResult {
    let score = 1.0;
    const penalties: { reason: string; amount: number }[] = [];

    function penalize(reason: string, amount: number) {
        penalties.push({ reason, amount });
        score -= amount;
    }

    const flags = new Set(blueprint.qualityFlags ?? []);

    // ── Empty columns ───────────────────────────────────────────
    if (blueprint.components.length === 0) {
        penalize('empty_column_components', PENALTIES.emptyColumn);
    }
    if (blueprint.dataDomains.length === 0) {
        penalize('empty_column_data_domains', PENALTIES.emptyColumn);
    }
    if (blueprint.integrations.length === 0) {
        penalize('empty_column_integrations', PENALTIES.emptyColumn);
    }

    // ── Generic nodes ───────────────────────────────────────────
    if (flags.has('too_many_generic_nodes')) {
        penalize('too_many_generic_nodes', PENALTIES.tooManyGenericNodes);
    }

    // ── Core nodes without evidence ─────────────────────────────
    const allNodes = [
        ...blueprint.components,
        ...blueprint.dataDomains,
        ...blueprint.integrations,
    ];
    const coreWithoutEvidence = allNodes.filter(
        (n) => n.businessCriticality === 'high' && (!n.evidence || n.evidence.length === 0),
    );
    if (coreWithoutEvidence.length > 0) {
        // Scale penalty: 1 node = 0.06, 2 = 0.09, 3+ capped at 0.12
        const scaledPenalty = Math.min(
            coreWithoutEvidence.length * PENALTIES.coreNodeWithoutEvidence,
            PENALTIES.coreNodeWithoutEvidence * 2,
        );
        penalize(`core_nodes_without_evidence (${coreWithoutEvidence.length})`, scaledPenalty);
    }

    // ── Missing relations ───────────────────────────────────────
    if (!blueprint.relations || blueprint.relations.length === 0) {
        penalize('missing_relations', PENALTIES.missingRelations);
    }

    // ── Review status ───────────────────────────────────────────
    if (allNodes.length > 0) {
        const unreviewedCount = allNodes.filter(
            (n) => !n.reviewStatus || n.reviewStatus === 'draft',
        ).length;
        if (unreviewedCount / allNodes.length > 0.5) {
            penalize('majority_nodes_unreviewed', PENALTIES.majorityUnreviewed);
        }
    }

    // ── Orphan data domains ─────────────────────────────────────
    if (flags.has('data_domain_without_owner_component')) {
        penalize('data_domain_without_owner_component', PENALTIES.dataDomainWithoutOwner);
    }

    // ── Disconnected integrations ───────────────────────────────
    if (flags.has('integration_without_connected_component')) {
        penalize('integration_without_connected_component', PENALTIES.integrationWithoutComponent);
    }

    // ── Very low signal from AI ─────────────────────────────────
    if (blueprint.coverage != null && blueprint.coverage < 0.3) {
        penalize('very_low_coverage', PENALTIES.veryLowCoverage);
    }
    if (blueprint.confidence != null && blueprint.confidence < 0.3) {
        penalize('very_low_confidence', PENALTIES.veryLowConfidence);
    }

    // Clamp to [0, 1]
    score = Math.max(0, Math.min(1, score));
    score = Math.round(score * 100) / 100;

    const verdict: BlueprintQualityResult['verdict'] =
        score >= 0.85 ? 'excellent' :
        score >= 0.65 ? 'good' :
        score >= 0.45 ? 'fair' :
        'poor';

    return { qualityScore: score, penalties, verdict };
}
