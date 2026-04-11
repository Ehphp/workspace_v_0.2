/**
 * pipeline-config.ts — Confidence-driven pipeline behavior configuration
 *
 * Converts an aggregate confidence score into concrete pipeline flags
 * that control interview skipping, reflection gating, and candidate
 * expansion behavior.
 *
 * @module pipeline-config
 */

export interface PipelineConfig {
    /** Confidence high enough to skip the interview step */
    skipInterview: boolean;
    /** Confidence high enough to skip agent reflection */
    skipReflection: boolean;
    /** Confidence low enough to warrant aggressive candidate expansion */
    aggressiveExpansion: boolean;
    /** The aggregate confidence that produced this config */
    confidence: number;
}

/**
 * Derive pipeline behavior from aggregate confidence.
 *
 * Thresholds:
 * - skipInterview:       confidence > 0.75
 * - skipReflection:      confidence > 0.85
 * - aggressiveExpansion: confidence < 0.50
 */
export function computePipelineConfig(confidence: number): PipelineConfig {
    return {
        skipInterview: confidence > 0.75,
        skipReflection: confidence > 0.85,
        aggressiveExpansion: confidence < 0.50,
        confidence,
    };
}
