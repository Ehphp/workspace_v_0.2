/**
 * Domain Model — Estimation module barrel export
 */

export { createRequirementAnalysis, getLatestAnalysis } from './analysis.service';
export { createImpactMap, getLatestImpactMap } from './impact-map.service';
export { buildCandidates, createCandidateSet } from './candidate-set.service';
export { createEstimationDecision } from './decision.service';
export { computeEstimation, ENGINE_VERSION } from './estimation-engine';
export { createEstimationSnapshot, buildSnapshotData } from './snapshot.service';
export { orchestrateDomainSave, finalizeSnapshot } from './save-orchestrator';
export type { DomainSaveInput, DomainSaveResult } from './save-orchestrator';
export { evaluateProjectContextRules } from './project-context-rules';
export type {
    ProjectContextRuleResult,
    ProjectContextRuleSuggestion,
    ActivityBiases,
} from './project-context-rules';
export {
    applyActivityBiases,
    mergeDriverSuggestions,
    mergeRiskSuggestions,
} from './project-context-integration';
export type { MergedDriver, MergedRisk } from './project-context-integration';

// Canonical Profile
export {
    buildCanonicalProfile,
    pinAnalysisToBlueprint,
    linkBlueprintToAnalysis,
    detectConflicts,
    evaluateStaleReasons,
    inferStructuralType,
    computeAggregateConfidence,
    buildCanonicalSearchText,
    formatConflictsBlock,
} from './canonical-profile.service';
export type { BuildCanonicalProfileOptions } from './canonical-profile.service';
