-- Migration: Canonical Technology Model
-- Date: 2026-03-01
-- Description: Replace string-based tech_category matching with technology_id FK.
--   activities.technology_id becomes the canonical link to technologies.id.
--   Eliminates rename/mismatch bugs entirely.
--   tech_category is kept as a deprecated read-only alias (populated by trigger).

-- ============================================
-- STEP 1: Add technology_id FK to activities
-- ============================================
ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS technology_id UUID REFERENCES technologies(id) ON DELETE SET NULL;

COMMENT ON COLUMN activities.technology_id
    IS 'Canonical FK to technologies table. Replaces string-based tech_category matching.';

-- ============================================
-- STEP 2: Backfill technology_id from tech_category string
-- ============================================
-- For system technologies: code === tech_category
UPDATE activities a
SET technology_id = t.id
FROM technologies t
WHERE a.tech_category = t.code
  AND a.technology_id IS NULL;

-- Handle MULTI: create a "MULTI" technology row if missing
INSERT INTO technologies (code, name, description, color, sort_order)
VALUES ('MULTI', 'Multi-stack', 'Cross-cutting or full-stack activities', '#64748b', 99)
ON CONFLICT (code) DO NOTHING;

-- Backfill MULTI activities
UPDATE activities a
SET technology_id = t.id
FROM technologies t
WHERE a.tech_category = 'MULTI'
  AND t.code = 'MULTI'
  AND a.technology_id IS NULL;

-- Report orphans (activities whose tech_category didn't match any technology)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM activities
    WHERE technology_id IS NULL AND active = true;

    IF orphan_count > 0 THEN
        RAISE NOTICE 'WARNING: % active activities have NULL technology_id (tech_category did not match any technologies.code)',
            orphan_count;
    END IF;
END $$;

-- ============================================
-- STEP 3: Create index on activities.technology_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activities_technology_id ON activities(technology_id);

-- ============================================
-- STEP 4: Sync trigger — keep tech_category in sync on INSERT/UPDATE
-- When technology_id is set, auto-populate tech_category from technologies.code.
-- This preserves backward compatibility while tech_category is being phased out.
-- ============================================
CREATE OR REPLACE FUNCTION sync_activity_tech_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tech_code TEXT;
BEGIN
    -- If technology_id is being set/changed, sync tech_category
    IF NEW.technology_id IS NOT NULL THEN
        SELECT code INTO v_tech_code
        FROM technologies
        WHERE id = NEW.technology_id;

        IF v_tech_code IS NOT NULL THEN
            NEW.tech_category := v_tech_code;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_activity_tech_category ON activities;
CREATE TRIGGER trg_sync_activity_tech_category
    BEFORE INSERT OR UPDATE OF technology_id ON activities
    FOR EACH ROW
    EXECUTE FUNCTION sync_activity_tech_category();

-- ============================================
-- STEP 5: Replace enforce_estimation_activity_category trigger
-- to use FK join (technology_id) instead of string matching (tech_category).
-- ============================================
CREATE OR REPLACE FUNCTION enforce_estimation_activity_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_req_technology_id UUID;
    v_activity_technology_id UUID;
    v_multi_technology_id UUID;
BEGIN
    -- Resolve the technology via requirement → technology_id
    SELECT r.technology_id INTO v_req_technology_id
    FROM estimations e
    JOIN requirements r ON r.id = e.requirement_id
    WHERE e.id = NEW.estimation_id;

    -- If no technology is assigned to the requirement, allow any activity
    IF v_req_technology_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the technology_id of the activity being inserted
    SELECT a.technology_id INTO v_activity_technology_id
    FROM activities a
    WHERE a.id = NEW.activity_id;

    -- If activity has no technology_id, allow it (legacy/uncategorized)
    IF v_activity_technology_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Allow if activity belongs to the same technology
    IF v_activity_technology_id = v_req_technology_id THEN
        RETURN NEW;
    END IF;

    -- Allow MULTI activities (cross-cutting)
    SELECT id INTO v_multi_technology_id FROM technologies WHERE code = 'MULTI' LIMIT 1;
    IF v_activity_technology_id = v_multi_technology_id THEN
        RETURN NEW;
    END IF;

    -- Reject mismatched activity
    RAISE EXCEPTION 'Activity technology_id "%" does not match requirement technology_id "%"',
        v_activity_technology_id, v_req_technology_id;
END;
$$;

-- Ensure the trigger exists on estimation_activities
DROP TRIGGER IF EXISTS trg_enforce_estimation_activity_category ON estimation_activities;
CREATE TRIGGER trg_enforce_estimation_activity_category
    BEFORE INSERT ON estimation_activities
    FOR EACH ROW
    EXECUTE FUNCTION enforce_estimation_activity_category();

-- ============================================
-- STEP 6: Add deprecation comment to tech_category column
-- ============================================
COMMENT ON COLUMN activities.tech_category
    IS '@deprecated — Use technology_id FK instead. Kept in sync by trg_sync_activity_tech_category trigger. Will be removed in a future migration.';

-- ============================================
-- STEP 7: Remove legacy FK constraint on tech_category → technologies.code
-- (if it exists from supabase_technologies.sql)
-- ============================================
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_tech_category_fkey;

-- ============================================
-- STEP 8: Add a view for easy querying with technology info
-- ============================================
CREATE OR REPLACE VIEW activities_with_technology AS
SELECT
    a.*,
    t.code AS technology_code,
    t.name AS technology_name,
    t.color AS technology_color
FROM activities a
LEFT JOIN technologies t ON t.id = a.technology_id;

COMMENT ON VIEW activities_with_technology
    IS 'Convenience view joining activities with their canonical technology. Use for reads; write to activities table directly.';
