/**
 * kill-switches.ts — Centralized feature-flag / kill-switch registry
 *
 * All environment-variable-based runtime flags for the estimation pipeline
 * are read here, typed, and returned as a single snapshot.
 *
 * Why centralize?
 *   - Prevents scattered `process.env.*` reads throughout the codebase
 *   - Gives a single grep-point for "what flags exist"
 *   - Makes flags mockable in unit tests without env pollution
 *   - Produces an auditable snapshot logged with every trace
 *
 * Usage:
 *   const ks = readKillSwitches();
 *   if (ks.agenticEnabled) { ... }
 *
 * All flags default to ENABLED (fail-open) unless explicitly disabled.
 * Exception: `forceDetministic` defaults to false (disabled).
 */

export interface KillSwitches {
    // ── LLM pipeline ────────────────────────────────────────────────────────
    /** Allow the agent (LLM) pipeline.  Set AI_AGENTIC=false to force deterministic. */
    agenticEnabled: boolean;
    /** Allow agent self-reflection loop.  Set AI_REFLECTION=false to disable. */
    reflectionEnabled: boolean;
    /** Allow agent tool-use calls.  Set AI_TOOL_USE=false to disable. */
    toolUseEnabled: boolean;
    /** Max reflection iterations before the agent finalizes.  AI_MAX_REFLECTIONS (default 2). */
    maxReflectionIterations: number;
    /** Confidence threshold (0-100) below which reflection is triggered.  AI_REFLECTION_THRESHOLD (default 75). */
    reflectionConfidenceThreshold: number;

    // ── Model selection ──────────────────────────────────────────────────────
    /** LLM model name for estimation.  AI_ESTIMATION_MODEL (default 'gpt-4o'). */
    estimationModel: string;

    // ── Signal sources ───────────────────────────────────────────────────────
    /** Allow blueprint-activity-mapper signals.  Set SIGNAL_BLUEPRINT=false to disable. */
    blueprintSignalEnabled: boolean;
    /** Allow impact-map signals.  Set SIGNAL_IMPACT_MAP=false to disable. */
    impactMapSignalEnabled: boolean;
    /** Allow requirement-understanding signals.  Set SIGNAL_UNDERSTANDING=false to disable. */
    understandingSignalEnabled: boolean;
    /** Allow project-activity signals.  Set SIGNAL_PROJECT_ACTIVITY=false to disable. */
    projectActivitySignalEnabled: boolean;

    // ── Observability ────────────────────────────────────────────────────────
    /** Compute and return agent delta (runs DecisionEngine on every agentic success).
     *  Set OBS_AGENT_DELTA=false to skip the comparison (reduces latency by ~5ms). */
    agentDeltaEnabled: boolean;

    // ── Candidate-set guardrails ────────────────────────────────────────────
    /**
     * Allow pipeline continuation when activity catalog is empty.
     * Set ALLOW_EMPTY_CANDIDATE_SET=false to restore hard-fail behavior.
     */
    allowEmptyCandidateSet: boolean;
}

/**
 * Read all kill-switches from environment variables.
 * Call once per request (not at module init) so env changes are picked up.
 */
export function readKillSwitches(): KillSwitches {
    return {
        agenticEnabled: env('AI_AGENTIC') !== 'false',
        reflectionEnabled: env('AI_REFLECTION') !== 'false',
        toolUseEnabled: env('AI_TOOL_USE') !== 'false',
        maxReflectionIterations: num('AI_MAX_REFLECTIONS', 2),
        reflectionConfidenceThreshold: num('AI_REFLECTION_THRESHOLD', 75),

        estimationModel: env('AI_ESTIMATION_MODEL') || 'gpt-4o',

        blueprintSignalEnabled: env('SIGNAL_BLUEPRINT') !== 'false',
        impactMapSignalEnabled: env('SIGNAL_IMPACT_MAP') !== 'false',
        understandingSignalEnabled: env('SIGNAL_UNDERSTANDING') !== 'false',
        projectActivitySignalEnabled: env('SIGNAL_PROJECT_ACTIVITY') !== 'false',

        agentDeltaEnabled: env('OBS_AGENT_DELTA') !== 'false',

        // Default ON to let the agent create project-scoped activities
        // when global catalog is empty.
        allowEmptyCandidateSet: env('ALLOW_EMPTY_CANDIDATE_SET') !== 'false',
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function env(key: string): string | undefined {
    return process.env[key];
}

function num(key: string, defaultValue: number): number {
    const val = process.env[key];
    if (val === undefined || val === '') return defaultValue;
    const n = Number(val);
    return Number.isFinite(n) ? n : defaultValue;
}
