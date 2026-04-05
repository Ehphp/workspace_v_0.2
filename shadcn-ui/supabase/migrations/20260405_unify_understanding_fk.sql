-- Migration: Add FK from requirement_analyses to requirement_understanding
--
-- Purpose: requirement_understanding is the canonical artifact table.
-- requirement_analyses currently duplicates the JSONB payload in its
-- `understanding` column. This migration adds a FK so domain readers
-- can JOIN to the artifact table instead of reading inline JSONB.
--
-- Strategy:
--   1. Add nullable FK column
--   2. Backfill from existing data (match by requirement_id + closest created_at)
--   3. Make `understanding` JSONB column nullable (FK is the canonical reference)
--   4. Add index on the FK

-- Step 1: Add the FK column
ALTER TABLE requirement_analyses
    ADD COLUMN IF NOT EXISTS requirement_understanding_id UUID
    REFERENCES requirement_understanding(id) ON DELETE SET NULL;

-- Step 2: Backfill — for each requirement_analyses row, find the closest
-- requirement_understanding row by requirement_id and created_at
UPDATE requirement_analyses ra
SET requirement_understanding_id = (
    SELECT ru.id
    FROM requirement_understanding ru
    WHERE ru.requirement_id = ra.requirement_id
    ORDER BY ABS(EXTRACT(EPOCH FROM (ru.created_at - ra.created_at)))
    LIMIT 1
)
WHERE ra.requirement_understanding_id IS NULL
  AND ra.requirement_id IS NOT NULL;

-- Step 3: Make understanding JSONB nullable (FK is now the canonical reference)
ALTER TABLE requirement_analyses
    ALTER COLUMN understanding DROP NOT NULL;

-- Step 4: Index for efficient JOINs
CREATE INDEX IF NOT EXISTS idx_req_analyses_understanding_fk
    ON requirement_analyses(requirement_understanding_id)
    WHERE requirement_understanding_id IS NOT NULL;
