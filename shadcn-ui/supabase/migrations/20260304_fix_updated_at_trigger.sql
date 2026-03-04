-- ==========================================================================
-- Migration: Fix requirements updated_at trigger
-- Date: 2026-03-04
-- Problem: The BEFORE UPDATE trigger on requirements fires on EVERY update,
--          including internal/system writes (embedding generation, estimation
--          assignment, AI title generation). This causes updated_at to change
--          even when the user has not actually edited the requirement.
-- Fix: Replace the blanket trigger with a smarter version that only bumps
--       updated_at when user-facing content columns change.
-- ==========================================================================

-- Drop the old blanket trigger
DROP TRIGGER IF EXISTS update_requirements_updated_at ON requirements;

-- Create a smarter trigger function that only fires on user-content changes
CREATE OR REPLACE FUNCTION update_requirements_updated_at_smart()
RETURNS TRIGGER AS $$
BEGIN
    -- Only bump updated_at when user-facing content columns change.
    -- System columns (embedding, embedding_updated_at, assigned_estimation_id,
    -- labels used for AI_TITLE_PENDING) should NOT bump updated_at.
    IF (
        OLD.title            IS DISTINCT FROM NEW.title
        OR OLD.description   IS DISTINCT FROM NEW.description
        OR OLD.priority      IS DISTINCT FROM NEW.priority
        OR OLD.state         IS DISTINCT FROM NEW.state
        OR OLD.business_owner IS DISTINCT FROM NEW.business_owner
        OR OLD.technology_id IS DISTINCT FROM NEW.technology_id
        OR OLD.req_id        IS DISTINCT FROM NEW.req_id
    ) THEN
        NEW.updated_at = NOW();
    ELSE
        -- Preserve existing updated_at for non-content writes
        NEW.updated_at = OLD.updated_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger using the smart function
CREATE TRIGGER update_requirements_updated_at
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_requirements_updated_at_smart();

-- Verify
COMMENT ON FUNCTION update_requirements_updated_at_smart()
    IS 'Only bumps requirements.updated_at when user-facing content columns change. System writes (embedding, assigned_estimation_id, labels) are excluded.';
