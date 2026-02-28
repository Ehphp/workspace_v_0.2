-- ============================================
-- FIX: enforce_estimation_activity_category trigger
-- Date: 2026-02-28
-- Problem: The trigger still references the old table name "technology_presets"
--   and the old column "tech_preset_id" which were renamed by
--   20260228_simplify_presets_to_technologies.sql:
--     technology_presets → technologies
--     tech_preset_id    → technology_id
--   Additionally, the estimations table never had tech_preset_id;
--   the technology lives on the requirement, so the join must go through
--   estimations → requirements → technologies.
-- ============================================

CREATE OR REPLACE FUNCTION enforce_estimation_activity_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tech_category TEXT;
    v_activity_category TEXT;
BEGIN
    -- Resolve the tech_category via requirement → technology
    SELECT t.tech_category INTO v_tech_category
    FROM estimations e
    JOIN requirements r ON r.id = e.requirement_id
    LEFT JOIN technologies t ON t.id = r.technology_id
    WHERE e.id = NEW.estimation_id;

    -- If no technology is assigned, allow any activity (no constraint)
    IF v_tech_category IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the category of the activity being inserted
    SELECT a.tech_category INTO v_activity_category
    FROM activities a
    WHERE a.id = NEW.activity_id;

    -- If activity has no category, allow it
    IF v_activity_category IS NULL THEN
        RETURN NEW;
    END IF;

    -- Enforce: activity category must match the technology category
    IF v_activity_category <> v_tech_category THEN
        RAISE EXCEPTION 'Activity category "%" does not match technology category "%"',
            v_activity_category, v_tech_category;
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure the trigger exists on estimation_activities
DROP TRIGGER IF EXISTS trg_enforce_estimation_activity_category ON estimation_activities;
CREATE TRIGGER trg_enforce_estimation_activity_category
    BEFORE INSERT ON estimation_activities
    FOR EACH ROW
    EXECUTE FUNCTION enforce_estimation_activity_category();
