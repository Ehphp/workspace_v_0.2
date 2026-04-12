/**
 * Agent Types — Phase 3: Agentic Evolution
 * 
 * Shared types for the agentic estimation system.
 * The agent orchestrator manages a state machine that produces
 * an estimation through iterative refinement with tool use
 * and self-reflection.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Agent State Machine
// ─────────────────────────────────────────────────────────────────────────────

export type AgentState =
    | 'INIT'       // Gather initial context
    | 'DRAFT'      // Generate initial estimation via LLM with tools
    | 'REFLECT'    // Run consultant analysis on draft
    | 'REFINE'     // Re-generate with corrections from reflection
    | 'VALIDATE'   // Pass through EstimationEngine deterministic check
    | 'COMPLETE'   // Final result ready
    | 'FAILED';    // Unrecoverable error

/**
 * Transition log entry for traceability
 */
export interface StateTransition {
    from: AgentState;
    to: AgentState;
    reason: string;
    timestamp: string;
    durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Context (accumulates through the pipeline)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentContext {
    /** Unique execution ID */
    executionId: string;
    /** Current state */
    state: AgentState;
    /** Iteration count (for reflection loop cap) */
    iteration: number;
    /** Max allowed reflection iterations */
    maxIterations: number;
    /** State transition log */
    transitions: StateTransition[];
    /** Tool call log for traceability */
    toolCalls: ToolCallRecord[];
    /** Timing */
    startedAt: number;
    /** Feature flags */
    flags: AgentFlags;
}

export interface AgentFlags {
    /** Enable reflection loop (default: true) */
    reflectionEnabled: boolean;
    /** Enable tool use / function calling (default: true) */
    toolUseEnabled: boolean;
    /** Minimum confidence to skip reflection (default: 75) */
    reflectionConfidenceThreshold: number;
    /** Max reflection iterations (default: 2) */
    maxReflectionIterations: number;
    /** Reflection assessment threshold — only 'approved' skips refinement */
    autoApproveOnly: boolean;
}

export const DEFAULT_AGENT_FLAGS: AgentFlags = {
    reflectionEnabled: true,
    toolUseEnabled: true,
    reflectionConfidenceThreshold: 75,
    maxReflectionIterations: 2,
    autoApproveOnly: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions (for OpenAI function calling)
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
}

export interface ToolCallRecord {
    toolName: string;
    arguments: Record<string, any>;
    result: any;
    durationMs: number;
    timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Input / Output
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentInput {
    /** Sanitized requirement description */
    description: string;
    /** Interview answers (if available) */
    answers?: Record<string, any>;
    /** Available activities catalog */
    activities: AgentActivity[];
    /** Valid activity codes (for schema constraint) */
    validActivityCodes: string[];
    /** Technology category */
    techCategory: string;
    /** Project context */
    projectContext?: {
        name: string;
        description: string;
        owner?: string;
        projectType?: string;
        domain?: string;
        scope?: string;
        teamSize?: number;
        deadlinePressure?: string;
        methodology?: string;
    };
    /** Technology name (for consultant analysis) */
    technologyName?: string;
    /** User ID (for RAG personalization) */
    userId?: string;
    /** Override default agent flags */
    flags?: Partial<AgentFlags>;
    /**
     * Pre-formatted Project Technical Blueprint block.
     * Injected into the user prompt so the agent knows the project's
     * architecture (components, integrations, data domains).
     */
    projectTechnicalBlueprintBlock?: string;
    /**
     * Pre-formatted block listing project-scoped activities (PRJ_* codes).
     * Injected into the user prompt so the agent PRIORITISES these
     * project-specific activities over generic catalog entries.
     */
    projectScopedActivitiesBlock?: string;
    /** Project ID for scoped vector search of project_activities */
    projectId?: string;
    /**
     * Pre-detected conflicts from the canonical profile (v1).
     * Injected into the ReflectionEngine prompt so the Senior Consultant
     * does not re-discover known artifact inconsistencies from scratch.
     * Shape: ConflictEntry[] from canonical-profile.service.ts
     */
    canonicalConflicts?: import('../../../../src/types/domain-model').ConflictEntry[];
}

export interface AgentActivity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
    /** Canonical FK to technologies.id */
    technology_id?: string | null;
}

export interface AgentOutput {
    success: boolean;
    /** Generated title for the requirement */
    generatedTitle: string;
    /** Selected activities with reasoning */
    activities: SelectedActivityResult[];
    /** Total base days (before drivers/contingency) */
    totalBaseDays: number;
    /** Overall reasoning */
    reasoning: string;
    /** Confidence score 0-1 */
    confidenceScore: number;
    /** Suggested driver values */
    suggestedDrivers: SuggestedDriver[];
    /** Suggested risk codes */
    suggestedRisks: string[];
    /** Deterministic engine validation result */
    engineValidation?: EngineValidationResult;
    /** Agent execution metadata */
    agentMetadata: AgentMetadata;
    /** Error message (if success=false) */
    error?: string;
    /** Activity codes discovered via search_catalog during tool-use (B1 expansion) */
    expandedActivityCodes?: string[];
}

export interface SelectedActivityResult {
    code: string;
    name: string;
    baseHours: number;
    reason: string;
    fromAnswer: string | null;
    fromQuestionId: string | null;
    /** Deterministic provenance — attached via backend post-processing, never LLM-generated */
    provenance?: import('../../blueprint-activity-mapper').ActivityProvenance;
}

export interface SuggestedDriver {
    code: string;
    suggestedValue: string;
    reason: string;
    fromQuestionId: string | null;
}

export interface EngineValidationResult {
    baseDays: number;
    driverMultiplier: number;
    subtotal: number;
    riskScore: number;
    contingencyPercent: number;
    contingencyDays: number;
    totalDays: number;
}

export interface AgentMetadata {
    executionId: string;
    totalDurationMs: number;
    iterations: number;
    toolCallCount: number;
    toolCalls: ToolCallRecord[];
    transitions: StateTransition[];
    reflectionResult?: ReflectionResult;
    model: string;
    flags: AgentFlags;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reflection Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReflectionResult {
    /** Overall assessment from consultant */
    assessment: 'approved' | 'needs_review' | 'concerns';
    /** Confidence 0-100 */
    confidence: number;
    /** Issues found */
    issues: ReflectionIssue[];
    /** Correction instructions for the refine step */
    correctionPrompt: string;
    /** Whether refinement was triggered */
    refinementTriggered: boolean;
}

export interface ReflectionIssue {
    type: 'missing_activity' | 'unnecessary_activity' | 'wrong_hours' | 'missing_coverage' | 'over_engineering';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestedAction: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft Estimation (intermediate result before reflection)
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftEstimation {
    generatedTitle: string;
    activities: SelectedActivityResult[];
    totalBaseDays: number;
    reasoning: string;
    confidenceScore: number;
    suggestedDrivers: SuggestedDriver[];
    suggestedRisks: string[];
}
