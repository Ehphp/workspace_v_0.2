-- Migration: Add FK from impact_maps (domain) to impact_map (artifact)
--
-- Purpose: impact_map is the canonical artifact table.
-- impact_maps (domain) currently duplicates the JSONB payload in its
-- `impact_data` column. This migration adds a FK so domain readers
-- can JOIN to the artifact table instead of reading inline JSONB.
--
-- Strategy:
--   1. Add nullable FK column (name: artifact_impact_map_id to avoid
--      collision with the table name)
--   2. Backfill from existing data (match via requirement_analyses chain
--      + closest created_at)
--   3. Make `impact_data` JSONB column nullable
--   4. Add index on the FK

-- Step 1: Add the FK column
ALTER TABLE impact_maps
    ADD COLUMN IF NOT EXISTS artifact_impact_map_id UUID
    REFERENCES impact_map(id) ON DELETE SET NULL;

-- Step 2: Backfill — for each impact_maps row, find the closest
-- impact_map artifact row via the requirement chain:
--   impact_maps.analysis_id → requirement_analyses.requirement_id
--   = impact_map.requirement_id
UPDATE impact_maps im
SET artifact_impact_map_id = (
    SELECT art.id
    FROM impact_map art
    JOIN requirement_analyses ra ON ra.id = im.analysis_id
    WHERE art.requirement_id = ra.requirement_id
    ORDER BY ABS(EXTRACT(EPOCH FROM (art.created_at - im.created_at)))
    LIMIT 1
)
WHERE im.artifact_impact_map_id IS NULL;

-- Step 3: Make impact_data JSONB nullable (FK is now the canonical reference)
ALTER TABLE impact_maps
    ALTER COLUMN impact_data DROP NOT NULL;

-- Step 4: Index for efficient JOINs
CREATE INDEX IF NOT EXISTS idx_impact_maps_artifact_fk
    ON impact_maps(artifact_impact_map_id)
    WHERE artifact_impact_map_id IS NOT NULL;
