-- ============================================
-- Add project_activity_id to estimation_activities
-- ============================================
-- Allows estimations to reference project-scoped activities
-- in addition to (or instead of) global catalog activities.
--
-- Constraint: at least one of activity_id or project_activity_id must be set.

-- Step 1: Add nullable column
ALTER TABLE estimation_activities
ADD COLUMN IF NOT EXISTS project_activity_id UUID REFERENCES project_activities(id) ON DELETE SET NULL;

-- Step 2: Add check constraint — at least one FK must be present
ALTER TABLE estimation_activities
DROP CONSTRAINT IF EXISTS chk_activity_or_project_activity;

ALTER TABLE estimation_activities
ADD CONSTRAINT chk_activity_or_project_activity
CHECK (activity_id IS NOT NULL OR project_activity_id IS NOT NULL);

-- Step 3: Make activity_id nullable (was NOT NULL before — now either can fill the role)
-- Note: only do this if it's currently NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'estimation_activities'
        AND column_name = 'activity_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE estimation_activities ALTER COLUMN activity_id DROP NOT NULL;
    END IF;
END $$;

-- Step 4: Index for project_activity_id lookups
CREATE INDEX IF NOT EXISTS idx_estimation_activities_project_activity_id
ON estimation_activities(project_activity_id)
WHERE project_activity_id IS NOT NULL;

-- Step 5: Comment
COMMENT ON COLUMN estimation_activities.project_activity_id IS
'Optional FK to project_activities. When set, this estimation activity references a project-scoped custom activity instead of (or in addition to) a global catalog activity.';
