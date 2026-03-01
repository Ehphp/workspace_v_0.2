-- ============================================
-- CONSULTANT ANALYSIS HISTORY
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
CREATE INDEX idx_consultant_analyses_requirement 
ON consultant_analyses(requirement_id, created_at DESC);

CREATE INDEX idx_consultant_analyses_estimation 
ON consultant_analyses(estimation_id);

CREATE INDEX idx_consultant_analyses_user 
ON consultant_analyses(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE consultant_analyses ENABLE ROW LEVEL SECURITY;

-- Users can see analyses for requirements they have access to (via lists they own)
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

-- Comment for documentation
COMMENT ON TABLE consultant_analyses IS 
'Stores each Senior Consultant AI analysis run with full context snapshots. 
Each row captures the analysis result plus the exact state of the requirement 
and estimation at the time, enabling full traceability.';

COMMENT ON COLUMN consultant_analyses.requirement_snapshot IS 
'JSON snapshot of requirement state: {title, description, priority, state, technology_id, technology_name}';

COMMENT ON COLUMN consultant_analyses.estimation_snapshot IS 
'JSON snapshot of estimation: {total_days, base_hours, driver_multiplier, risk_score, contingency_percent, scenario_name, activities: [...], drivers: [...]}';
