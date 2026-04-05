-- ============================================================================
-- Migration: Blueprint V2 Enrichment
-- Date: 2026-04-02
-- Purpose: Add relations, coverage, quality flags, review status,
--          change summary, and diff-from-previous columns to
--          project_technical_blueprints. All additive and nullable —
--          existing rows remain valid without any data backfill.
-- ============================================================================

-- ── New columns ─────────────────────────────────────────────────────────────

ALTER TABLE project_technical_blueprints
    ADD COLUMN IF NOT EXISTS relations          JSONB,
    ADD COLUMN IF NOT EXISTS coverage           NUMERIC,
    ADD COLUMN IF NOT EXISTS quality_flags      TEXT[],
    ADD COLUMN IF NOT EXISTS quality_score      NUMERIC,
    ADD COLUMN IF NOT EXISTS review_status      TEXT,
    ADD COLUMN IF NOT EXISTS change_summary     TEXT,
    ADD COLUMN IF NOT EXISTS diff_from_previous JSONB;

-- ── Validation constraints ──────────────────────────────────────────────────

ALTER TABLE project_technical_blueprints
    ADD CONSTRAINT chk_blueprint_coverage
        CHECK (coverage IS NULL OR (coverage >= 0 AND coverage <= 1));

ALTER TABLE project_technical_blueprints
    ADD CONSTRAINT chk_blueprint_quality_score
        CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1));

ALTER TABLE project_technical_blueprints
    ADD CONSTRAINT chk_blueprint_review_status
        CHECK (review_status IS NULL OR review_status IN ('draft', 'reviewed', 'approved'));
