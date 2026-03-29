-- ============================================================================
-- Migration: Project Context Enrichment
-- Date: 2026-03-29
-- Purpose: Add structured context fields to lists (project) table to improve
--          AI estimation quality through richer project metadata.
-- ============================================================================

-- All fields are nullable for backward compatibility.
-- Existing projects continue to work unchanged.

ALTER TABLE lists ADD COLUMN IF NOT EXISTS project_type VARCHAR(30);
-- Valid values: NEW_DEVELOPMENT, MAINTENANCE, MIGRATION, INTEGRATION, REFACTORING

ALTER TABLE lists ADD COLUMN IF NOT EXISTS domain VARCHAR(50);
-- Valid values: HR, FINANCE, ECOMMERCE, HEALTHCARE, LOGISTICS, MANUFACTURING, EDUCATION, GOVERNMENT, TELECOM, CUSTOM

ALTER TABLE lists ADD COLUMN IF NOT EXISTS scope VARCHAR(20);
-- Valid values: SMALL, MEDIUM, LARGE, ENTERPRISE

ALTER TABLE lists ADD COLUMN IF NOT EXISTS team_size INTEGER;
-- Number of team members (1-100)

ALTER TABLE lists ADD COLUMN IF NOT EXISTS deadline_pressure VARCHAR(20);
-- Valid values: RELAXED, NORMAL, TIGHT, CRITICAL

ALTER TABLE lists ADD COLUMN IF NOT EXISTS methodology VARCHAR(20);
-- Valid values: AGILE, WATERFALL, HYBRID

-- Add CHECK constraints for enum-like fields
ALTER TABLE lists ADD CONSTRAINT chk_project_type
    CHECK (project_type IS NULL OR project_type IN ('NEW_DEVELOPMENT', 'MAINTENANCE', 'MIGRATION', 'INTEGRATION', 'REFACTORING'));

ALTER TABLE lists ADD CONSTRAINT chk_scope
    CHECK (scope IS NULL OR scope IN ('SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'));

ALTER TABLE lists ADD CONSTRAINT chk_deadline_pressure
    CHECK (deadline_pressure IS NULL OR deadline_pressure IN ('RELAXED', 'NORMAL', 'TIGHT', 'CRITICAL'));

ALTER TABLE lists ADD CONSTRAINT chk_methodology
    CHECK (methodology IS NULL OR methodology IN ('AGILE', 'WATERFALL', 'HYBRID'));

ALTER TABLE lists ADD CONSTRAINT chk_team_size
    CHECK (team_size IS NULL OR (team_size >= 1 AND team_size <= 100));
