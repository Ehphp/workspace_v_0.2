-- ============================================
-- MILESTONE 2: IMPACT MAP
--
-- Stores structured AI-generated impact map
-- artifacts for requirements. Each row captures
-- one generation run, enabling version history.
-- ============================================

CREATE TABLE IF NOT EXISTS impact_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to the requirement (nullable: impact map can be generated before saving)
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- The impact map artifact (matches ImpactMap interface)
    impact_map JSONB NOT NULL,

    -- Input snapshot
    input_description TEXT NOT NULL,
    input_tech_category TEXT,

    -- Whether requirement understanding was available at generation time
    has_requirement_understanding BOOLEAN NOT NULL DEFAULT FALSE,

    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Version tracking (incremented per requirement_id)
    version INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_impact_map_requirement
ON impact_map(requirement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impact_map_user
ON impact_map(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE impact_map ENABLE ROW LEVEL SECURITY;

-- SELECT: user can read impact maps for requirements they own
CREATE POLICY "Users can view impact maps for their requirements"
ON impact_map FOR SELECT
USING (
    user_id = auth.uid()
    OR requirement_id IN (
        SELECT r.id FROM requirements r
        JOIN lists l ON r.list_id = l.id
        WHERE l.user_id = auth.uid()
    )
);

-- INSERT: user can only insert rows with their own user_id
CREATE POLICY "Users can insert their own impact maps"
ON impact_map FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE: user can update their own impact map rows
CREATE POLICY "Users can update their own impact maps"
ON impact_map FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: user can delete their own impact map rows
CREATE POLICY "Users can delete their own impact maps"
ON impact_map FOR DELETE
USING (user_id = auth.uid());
