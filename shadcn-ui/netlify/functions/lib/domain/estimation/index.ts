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
