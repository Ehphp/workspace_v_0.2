-- ============================================
-- FIX: Allow MULTI (cross-cutting) activities in estimation trigger
-- Date: 2026-03-04
-- Problem: enforce_estimation_activity_category() does a strict
--   tech_category != check but MULTI activities are cross-cutting
--   and should be allowed for any technology.
--   The canonical model migration (20260301) was supposed to add
--   this exemption but may not have been applied yet.
--   This migration is safe to run regardless — it uses CREATE OR REPLACE.
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

    -- If no technology is assigned, allow any activity
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

    -- Allow MULTI activities (cross-cutting / full-stack)
    IF v_activity_category = 'MULTI' THEN
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
