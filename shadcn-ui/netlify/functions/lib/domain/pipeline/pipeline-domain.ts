/**
 * Pipeline Domain Contract — Single source of truth
 *
 * Canonical types, enums, and Zod schemas for the entire estimation pipeline.
 * ALL pipeline consumers MUST import domain concepts from this module.
 *
 * @module pipeline-domain
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical pipeline layers.
 * Covers all layers from LAYER_TECH_PATTERNS. `ai_pipeline` is intentionally
 * excluded — it was in UNSUPPORTED_LAYERS and signals from it were silently dropped.
 */
export const PIPELINE_LAYERS = [
    'frontend',
    'logic',
    'data',
    'integration',
    'automation',
    'configuration',
] as const;
export type PipelineLayer = (typeof PIPELINE_LAYERS)[number];
export const PipelineLayerSchema = z.enum(PIPELINE_LAYERS);

/**
 * Canonical data/impact actions.
 * Union of ImpactAction ('read'|'modify'|'create'|'configure')
 * and DataOperation ('read'|'write'|'create'|'modify'|'delete').
 * Normalized: 'write' mapped to 'modify' at ingestion boundaries.
 */
export const PIPELINE_ACTIONS = [
    'read',
    'modify',
    'create',
    'configure',
    'delete',
] as const;
export type PipelineAction = (typeof PIPELINE_ACTIONS)[number];
export const PipelineActionSchema = z.enum(PIPELINE_ACTIONS);

/**
 * Canonical intervention types.
 * Matches the values used in LAYER_TECH_PATTERNS and estimation-blueprint.ts.
 */
export const INTERVENTION_TYPES = [
    'new_development',
    'modification',
    'configuration',
    'integration',
    'migration',
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export const InterventionTypeSchema = z.enum(INTERVENTION_TYPES);

/**
 * Canonical complexity levels. Always UPPERCASE.
 */
export const COMPLEXITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Complexity = (typeof COMPLEXITY_LEVELS)[number];
export const ComplexitySchema = z.enum(COMPLEXITY_LEVELS);

/**
 * Signal kind — describes HOW a signal was derived.
 * Each extractor/mapper produces signals of specific kinds.
 */
export const SIGNAL_KINDS = [
    'blueprint-component',
    'blueprint-integration',
    'blueprint-data',
    'blueprint-testing',
    'impact-map-layer',
    'impact-map-action',
    'understanding-perimeter',
    'understanding-complexity',
    'keyword-match',
    'keyword-fallback',
    'project-context',
    'multi-crosscutting',
    'agent-discovered',
    'project-activity-match',
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export const SignalKindSchema = z.enum(SIGNAL_KINDS);

/**
 * Provenance source — identifies WHICH extractor produced a signal.
 */
export const PROVENANCE_SOURCES = [
    'blueprint',
    'impact-map',
    'understanding',
    'keyword',
    'context',
    'manual',
    'project-activity',
] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];
export const ProvenanceSourceSchema = z.enum(PROVENANCE_SOURCES);

// ─────────────────────────────────────────────────────────────────────────────
// Layer Priority (coverage enforcement)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layers where coverage enforcement is applied during decision.
 * HIGH = DecisionEngine will force-include a candidate if layer is uncovered.
 * MEDIUM = warning only. LOW = ignored.
 */
export const LAYER_PRIORITY: Record<PipelineLayer, 'HIGH' | 'MEDIUM' | 'LOW'> = {
    frontend: 'HIGH',
    logic: 'HIGH',
    data: 'HIGH',
    integration: 'MEDIUM',
    automation: 'MEDIUM',
    configuration: 'LOW',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Source Weights (used by CandidateBuilder / CandidateSynthesizer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical scoring weights per provenance source.
 * Blueprint is highest (deterministic structural mapping).
 * Keyword is lowest (heuristic).
 */
export const SOURCE_WEIGHTS: Record<ProvenanceSource, number> = {
    'project-activity': 4.0,
    blueprint: 3.0,
    'impact-map': 2.0,
    understanding: 1.5,
    keyword: 1.0,
    context: 0.5,
    manual: 0.0,
} as const;
