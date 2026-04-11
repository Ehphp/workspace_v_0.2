-- ============================================================================
-- Migration: Promote requirement_analyses to Canonical Profile Hub
-- ============================================================================
--
-- Purpose: requirement_analyses becomes the runtime anchor for buildCanonicalProfile().
-- This migration adds:
--   1. analysis_id FK on estimation_blueprint (session grouping)
--   2. pinned_blueprint_id + pinned_blueprint_version on requirement_analyses
--   3. conflicts JSONB (5 conflict rules, see canonical-profile.service.ts)
--   4. stale fields (lazy-evaluated, can be persisted as materialized cache)
--   5. project context snapshots (frozen at analysis creation time)
--   6. canonical embedding fields (added now, populated async after search text stabilises)
--
-- Relation geometry (no cycles):
--   estimation_blueprint.based_on_understanding_id → requirement_understanding.id  (existing)
--   estimation_blueprint.based_on_impact_map_id    → impact_map.id                 (existing)
--   estimation_blueprint.analysis_id               → requirement_analyses.id        (NEW)
--   requirement_analyses.pinned_blueprint_id        → estimation_blueprint.id        (NEW — single anchor)
--
-- Non-breaking: all new columns are nullable; no existing columns changed.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. estimation_blueprint.analysis_id — session grouping
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE estimation_blueprint
    ADD COLUMN IF NOT EXISTS analysis_id UUID
        REFERENCES requirement_analyses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_est_blueprint_analysis
    ON estimation_blueprint(analysis_id)
    WHERE analysis_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. requirement_analyses — canonical profile anchor
-- ─────────────────────────────────────────────────────────────────────────────

-- Single FK anchor: pinning a blueprint UUID pins the entire artifact triad
-- because estimation_blueprint carries based_on_understanding_id + based_on_impact_map_id
ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS pinned_blueprint_id UUID
        REFERENCES estimation_blueprint(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pinned_blueprint_version INT;

CREATE INDEX IF NOT EXISTS idx_req_analyses_pinned_blueprint
    ON requirement_analyses(pinned_blueprint_id)
    WHERE pinned_blueprint_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Conflict system
-- ─────────────────────────────────────────────────────────────────────────────
-- Persisted as materialized cache. Regen happens when artifacts change.
-- ConflictEntry shape (enforced in application layer):
--   { type, severity, description, field,
--     sourceA, valueA, sourceB, valueB,
--     confidenceDelta, resolutionHint }

ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS conflicts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Stale system (persisted as materialized cache, lazy-evaluated)
-- ─────────────────────────────────────────────────────────────────────────────
-- stale_reasons codes (set by application):
--   UNDERSTANDING_UPDATED | IMPACT_MAP_UPDATED | BLUEPRINT_UPDATED
--   PROJECT_BLUEPRINT_UPDATED | PROJECT_CONTEXT_CHANGED

ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stale_reasons TEXT[] NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Project context snapshots (frozen values from the moment of analysis)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS project_context_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS project_technical_baseline_snapshot JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Canonical embedding (populated async; NULL until search text is stable)
-- ─────────────────────────────────────────────────────────────────────────────
-- canonical_embedding_version tracks the search text format version (starts at 1).
-- is_embedding_stale replaces the "set to NULL" strategy — preserves history.
-- Reset is_embedding_stale to true via application when is_stale becomes true.

ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS canonical_embedding vector(1536),
    ADD COLUMN IF NOT EXISTS canonical_embedding_version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_embedding_stale BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_req_analyses_canonical_embedding
    ON requirement_analyses
    USING ivfflat (canonical_embedding vector_cosine_ops)
    WHERE canonical_embedding IS NOT NULL AND is_embedding_stale = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Helper function: fetch canonical profile anchor in a single round-trip
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns the pinned blueprint row (with its upstream FK UUIDs) for a given
-- requirement, using the 'latest' selection strategy as default.

CREATE OR REPLACE FUNCTION get_canonical_profile_anchor(
    p_requirement_id UUID,
    p_strategy TEXT DEFAULT 'latest'  -- 'latest' | 'highest_confidence' | 'pinned'
)
RETURNS TABLE (
    analysis_id             UUID,
    blueprint_id            UUID,
    blueprint_version       INT,
    understanding_id        UUID,
    impact_map_id           UUID,
    blueprint_confidence    NUMERIC,
    is_stale                BOOLEAN,
    stale_reasons           TEXT[],
    conflicts               JSONB,
    pinned_blueprint_id     UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ra.id                           AS analysis_id,
        eb.id                           AS blueprint_id,
        eb.version                      AS blueprint_version,
        eb.based_on_understanding_id    AS understanding_id,
        eb.based_on_impact_map_id       AS impact_map_id,
        eb.confidence_score             AS blueprint_confidence,
        ra.is_stale,
        ra.stale_reasons,
        ra.conflicts,
        ra.pinned_blueprint_id
    FROM requirement_analyses ra
    LEFT JOIN estimation_blueprint eb ON (
        CASE p_strategy
            WHEN 'pinned' THEN
                eb.id = ra.pinned_blueprint_id
            WHEN 'highest_confidence' THEN
                eb.id = (
                    SELECT id FROM estimation_blueprint
                    WHERE requirement_id = p_requirement_id
                    ORDER BY confidence_score DESC NULLS LAST, version DESC
                    LIMIT 1
                )
            ELSE  -- 'latest'
                eb.id = (
                    SELECT id FROM estimation_blueprint
                    WHERE requirement_id = p_requirement_id
                    ORDER BY version DESC
                    LIMIT 1
                )
        END
    )
    WHERE ra.requirement_id = p_requirement_id
    ORDER BY ra.created_at DESC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_canonical_profile_anchor TO authenticated;
