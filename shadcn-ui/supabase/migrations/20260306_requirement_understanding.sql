-- ============================================
-- MILESTONE 1: REQUIREMENT UNDERSTANDING
-- 
-- Stores structured AI-generated understanding
-- artifacts for requirements. Each row captures
-- one generation run, enabling version history.
-- ============================================

CREATE TABLE IF NOT EXISTS requirement_understanding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to the requirement (nullable: understanding can be generated before saving)
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- The understanding artifact (matches RequirementUnderstanding interface)
    understanding JSONB NOT NULL,

    -- Input snapshot
    input_description TEXT NOT NULL,
    input_tech_category TEXT,

    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Version tracking (incremented per requirement_id)
    version INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_requirement_understanding_requirement
ON requirement_understanding(requirement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requirement_understanding_user
ON requirement_understanding(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE requirement_understanding ENABLE ROW LEVEL SECURITY;

-- SELECT: user can read understanding for requirements they own
-- (requirement → list → user chain, same as consultant_analyses)
CREATE POLICY "Users can view understanding for their requirements"
ON requirement_understanding FOR SELECT
USING (
    user_id = auth.uid()
    OR requirement_id IN (
        SELECT r.id FROM requirements r
        JOIN lists l ON r.list_id = l.id
        WHERE l.user_id = auth.uid()
    )
);

-- INSERT: user can only insert rows with their own user_id
CREATE POLICY "Users can insert their own understanding"
ON requirement_understanding FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE: user can update their own understanding rows
CREATE POLICY "Users can update their own understanding"
ON requirement_understanding FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: user can delete their own understanding rows
CREATE POLICY "Users can delete their own understanding"
ON requirement_understanding FOR DELETE
USING (user_id = auth.uid());
