-- ============================================
-- PHASE 3: AGENTIC EVOLUTION — DATABASE SCHEMA
-- 
-- Creates tables to support the agentic pipeline:
-- 1. consultant_analyses: Analysis history for traceability
-- 2. agent_execution_log: Full execution trace of agentic runs
-- ============================================

-- ============================================
-- 1. CONSULTANT ANALYSIS HISTORY
-- Stores each Senior Consultant analysis run
-- with a snapshot of the requirement/estimation
-- state at the time of the analysis.
-- ============================================

-- Create the consultant_analyses table
CREATE TABLE IF NOT EXISTS consultant_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- The analysis result (same structure as SeniorConsultantAnalysis)
    analysis JSONB NOT NULL,
    
    -- Snapshot of the requirement state at analysis time
    requirement_snapshot JSONB NOT NULL,
    -- Contains: { title, description, priority, state, technology_id, technology_name }
    
    -- Snapshot of the estimation state at analysis time
    estimation_snapshot JSONB NOT NULL,
    -- Contains: { total_days, base_hours, driver_multiplier, risk_score,
    --             contingency_percent, scenario_name,
    --             activities: [{code, name, base_hours, group}],
    --             drivers: [{code, name, selected_value, multiplier}] }
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_consultant_analyses_requirement 
ON consultant_analyses(requirement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultant_analyses_estimation 
ON consultant_analyses(estimation_id);

CREATE INDEX IF NOT EXISTS idx_consultant_analyses_user 
ON consultant_analyses(user_id);

-- ============================================
-- 2. AGENT EXECUTION LOG
-- Stores each agentic pipeline execution
-- with full trace: state transitions, tool calls,
-- reflection results, and engine validation.
-- ============================================

CREATE TABLE IF NOT EXISTS agent_execution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Unique execution ID (matches AgentMetadata.executionId)
    execution_id TEXT NOT NULL UNIQUE,
    
    -- References (nullable — agent can run without saved requirement)
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- Input snapshot (sanitized description + tech category)
    input_description TEXT NOT NULL,
    input_tech_category TEXT,
    
    -- Output summary
    success BOOLEAN NOT NULL DEFAULT false,
    generated_title TEXT,
    activity_count INTEGER,
    total_base_days NUMERIC(8,2),
    confidence_score NUMERIC(4,2),
    
    -- Agent execution details
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    iterations INTEGER NOT NULL DEFAULT 1,
    tool_call_count INTEGER NOT NULL DEFAULT 0,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    
    -- Full execution trace (JSONB for flexibility)
    -- Contains: { transitions, toolCalls, flags }
    execution_trace JSONB NOT NULL DEFAULT '{}',
    
    -- Reflection result (if performed)
    -- Contains: { assessment, confidence, issues, correctionPrompt, refinementTriggered }
    reflection_result JSONB,
    
    -- Engine validation result (deterministic check)
    -- Contains: { baseDays, driverMultiplier, subtotal, riskScore, contingencyPercent, totalDays }
    engine_validation JSONB,
    
    -- Error (if failed)
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_requirement
ON agent_execution_log(requirement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_user
ON agent_execution_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_success
ON agent_execution_log(success, created_at DESC);

-- Partial index for failed executions (debugging)
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_failures
ON agent_execution_log(created_at DESC) WHERE success = false;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE consultant_analyses ENABLE ROW LEVEL SECURITY;

-- Users can see analyses for requirements they have access to (via lists they own)
DROP POLICY IF EXISTS consultant_analyses_select ON consultant_analyses;
CREATE POLICY consultant_analyses_select ON consultant_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = consultant_analyses.requirement_id
            AND l.user_id = auth.uid()
        )
    );

-- Users can insert analyses for their own requirements
DROP POLICY IF EXISTS consultant_analyses_insert ON consultant_analyses;
CREATE POLICY consultant_analyses_insert ON consultant_analyses
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = consultant_analyses.requirement_id
            AND l.user_id = auth.uid()
        )
    );

ALTER TABLE agent_execution_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent executions
DROP POLICY IF EXISTS agent_execution_log_select ON agent_execution_log;
CREATE POLICY agent_execution_log_select ON agent_execution_log
    FOR SELECT USING (
        user_id = auth.uid()
        OR user_id IS NULL  -- Anonymous Quick Estimate sessions
    );

-- Users can insert their own agent executions
DROP POLICY IF EXISTS agent_execution_log_insert ON agent_execution_log;
CREATE POLICY agent_execution_log_insert ON agent_execution_log
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR user_id IS NULL
    );

-- ============================================
-- COMMENTS
-- ============================================

-- Comment for documentation
COMMENT ON TABLE consultant_analyses IS 
'Stores each Senior Consultant AI analysis run with full context snapshots. 
Each row captures the analysis result plus the exact state of the requirement 
and estimation at the time, enabling full traceability.';

COMMENT ON COLUMN consultant_analyses.requirement_snapshot IS 
'JSON snapshot of requirement state: {title, description, priority, state, technology_id, technology_name}';

COMMENT ON COLUMN consultant_analyses.estimation_snapshot IS 
'JSON snapshot of estimation: {total_days, base_hours, driver_multiplier, risk_score, contingency_percent, scenario_name, activities: [...], drivers: [...]}';

COMMENT ON TABLE agent_execution_log IS
'Full execution trace of each agentic estimation pipeline run (Phase 3).
Captures state transitions, tool calls, reflection results, and engine validation
for traceability and performance analysis.';

COMMENT ON COLUMN agent_execution_log.execution_trace IS
'JSONB trace: {transitions: [{from, to, reason, timestamp, durationMs}], toolCalls: [{toolName, arguments, result, durationMs}], flags: {...}}';

COMMENT ON COLUMN agent_execution_log.reflection_result IS
'Reflection engine output: {assessment: approved|needs_review|concerns, confidence: 0-100, issues: [...], correctionPrompt, refinementTriggered}';

COMMENT ON COLUMN agent_execution_log.engine_validation IS
'Deterministic engine validation: {baseDays, driverMultiplier, subtotal, riskScore, contingencyPercent, contingencyDays, totalDays}. Formula: Total = (Base/8) × Drivers × (1+Contingency)';
