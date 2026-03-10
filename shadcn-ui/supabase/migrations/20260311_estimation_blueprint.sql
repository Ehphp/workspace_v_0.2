-- Migration: Create estimation_blueprint table
-- This table persists the structured Estimation Blueprint artifact,
-- which captures the technical anatomy of a requirement before activity selection.
--
-- Follows the same pattern as requirement_understanding and impact_map tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS estimation_blueprint (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id  UUID REFERENCES requirements(id) ON DELETE CASCADE,
    blueprint       JSONB NOT NULL,
    input_description TEXT NOT NULL,
    input_tech_category TEXT,
    -- Relational links to upstream artifacts
    based_on_understanding_id UUID REFERENCES requirement_understanding(id) ON DELETE SET NULL,
    based_on_impact_map_id    UUID REFERENCES impact_map(id) ON DELETE SET NULL,
    confidence_score NUMERIC(3,2),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_estimation_blueprint_requirement
    ON estimation_blueprint(requirement_id);

CREATE INDEX IF NOT EXISTS idx_estimation_blueprint_user
    ON estimation_blueprint(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_estimation_blueprint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimation_blueprint_updated_at
    BEFORE UPDATE ON estimation_blueprint
    FOR EACH ROW
    EXECUTE FUNCTION update_estimation_blueprint_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies (same pattern as requirement_understanding / impact_map)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE estimation_blueprint ENABLE ROW LEVEL SECURITY;

-- Users can view their own blueprints
CREATE POLICY estimation_blueprint_select_own ON estimation_blueprint
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own blueprints
CREATE POLICY estimation_blueprint_insert_own ON estimation_blueprint
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own blueprints
CREATE POLICY estimation_blueprint_update_own ON estimation_blueprint
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own blueprints
CREATE POLICY estimation_blueprint_delete_own ON estimation_blueprint
    FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add blueprint_id FK to estimations table (Phase 10 — auditability)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE estimations
    ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES estimation_blueprint(id) ON DELETE SET NULL;
