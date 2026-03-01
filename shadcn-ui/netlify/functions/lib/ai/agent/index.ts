/**
 * Agent Module — Phase 3: Agentic Evolution
 * 
 * Public API for the agentic estimation pipeline.
 */

// Main orchestrator
export { runAgentPipeline } from './agent-orchestrator';

// Types
export type {
    AgentInput,
    AgentOutput,
    AgentFlags,
    AgentMetadata,
    AgentState,
    AgentActivity,
    AgentContext,
    DraftEstimation,
    SelectedActivityResult,
    SuggestedDriver,
    EngineValidationResult,
    ReflectionResult,
    ReflectionIssue,
    ToolCallRecord,
    StateTransition,
    ToolDefinition,
} from './agent-types';

export { DEFAULT_AGENT_FLAGS } from './agent-types';

// Tools (for testing/extension)
export { AGENT_TOOL_DEFINITIONS, executeTool } from './agent-tools';

// Reflection (for standalone consultant analysis)
export { reflectOnDraft, buildRefinementPrompt } from './reflection-engine';
