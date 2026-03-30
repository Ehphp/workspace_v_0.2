-- ============================================================================
-- Migration: Rename lists → projects, list_id → project_id
-- Date: 2026-03-30
-- Purpose: Final DB rename to align table/column names with domain language.
--          After this migration the legacy names are gone; application code
--          must use `projects` and `project_id` everywhere.
-- ============================================================================
-- Strategy:
--   1. Rename the table
--   2. Rename the FK column on requirements
--   3. Rename all indexes that embed the old names
--   4. Drop + recreate every RLS policy that mentions `lists` or `list_id`
--   5. Recreate RPC / SECURITY DEFINER functions that reference old names
--   6. Rename triggers whose names embed "lists"
-- ============================================================================

BEGIN;

-- =============================================
-- STEP 1: Rename table
-- =============================================

ALTER TABLE lists RENAME TO projects;

-- =============================================
-- STEP 2: Rename FK column on requirements
-- =============================================

ALTER TABLE requirements RENAME COLUMN list_id TO project_id;

-- =============================================
-- STEP 3: Rename indexes
-- =============================================

ALTER INDEX IF EXISTS idx_lists_user_id       RENAME TO idx_projects_user_id;
ALTER INDEX IF EXISTS idx_lists_status        RENAME TO idx_projects_status;
ALTER INDEX IF EXISTS idx_requirements_list_id RENAME TO idx_requirements_project_id;

-- Multitenancy index (added in 20251204_multitenancy_schema)
ALTER INDEX IF EXISTS idx_lists_org_id        RENAME TO idx_projects_org_id;

-- =============================================
-- STEP 4: Rename the trigger on projects (was "lists")
-- =============================================

-- The trigger function update_updated_at() is generic; only rename the trigger object.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_lists_updated_at'
  ) THEN
    ALTER TRIGGER update_lists_updated_at ON projects RENAME TO update_projects_updated_at;
  END IF;
END;
$$;

-- =============================================
-- STEP 5: RLS policies on `projects` (was `lists`)
-- =============================================
-- Drop the old policy names, then create identical ones with updated names.

DROP POLICY IF EXISTS "Users can view lists in their orgs"       ON projects;
DROP POLICY IF EXISTS "Admins and Editors can create lists"       ON projects;
DROP POLICY IF EXISTS "Admins and Editors can update lists"       ON projects;
DROP POLICY IF EXISTS "Only Admins can delete lists"              ON projects;

-- Also drop any surviving MVP policies (originally on `lists`)
DROP POLICY IF EXISTS "Users can view their own lists"   ON projects;
DROP POLICY IF EXISTS "Users can insert their own lists" ON projects;
DROP POLICY IF EXISTS "Users can update their own lists" ON projects;
DROP POLICY IF EXISTS "Users can delete their own lists" ON projects;

CREATE POLICY "Users can view projects in their orgs" ON projects
    FOR SELECT USING (
        organization_id = ANY(get_user_org_ids())
    );

CREATE POLICY "Admins and Editors can create projects" ON projects
    FOR INSERT WITH CHECK (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Admins and Editors can update projects" ON projects
    FOR UPDATE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    )
    WITH CHECK (
        (
            status != 'LOCKED' OR
            EXISTS (
                SELECT 1 FROM organization_members
                WHERE org_id = organization_id
                AND user_id = auth.uid()
                AND role = 'admin'
            )
        )
    );

CREATE POLICY "Only Admins can delete projects" ON projects
    FOR DELETE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =============================================
-- STEP 6: RLS policies on `requirements`
-- =============================================

DROP POLICY IF EXISTS "Users can view requirements in their orgs"          ON requirements;
DROP POLICY IF EXISTS "Editors can insert requirements if not locked"      ON requirements;
DROP POLICY IF EXISTS "Editors can update requirements if not locked"      ON requirements;
DROP POLICY IF EXISTS "Editors can delete requirements if not locked"      ON requirements;

-- Also drop any surviving MVP policies
DROP POLICY IF EXISTS "Users can view requirements in their lists"   ON requirements;
DROP POLICY IF EXISTS "Users can insert requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can update requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can delete requirements in their lists" ON requirements;

CREATE POLICY "Users can view requirements in their orgs" ON requirements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = requirements.project_id
            AND projects.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert requirements if not locked" ON requirements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members om ON om.org_id = projects.organization_id
            WHERE projects.id = requirements.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND projects.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can update requirements if not locked" ON requirements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members om ON om.org_id = projects.organization_id
            WHERE projects.id = requirements.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND projects.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can delete requirements if not locked" ON requirements
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members om ON om.org_id = projects.organization_id
            WHERE projects.id = requirements.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND projects.status != 'LOCKED'
        )
    );

-- =============================================
-- STEP 7: RLS policies on `estimations`
-- =============================================

DROP POLICY IF EXISTS "Users can view estimations in their orgs"       ON estimations;
DROP POLICY IF EXISTS "Editors can insert estimations if not locked"   ON estimations;

CREATE POLICY "Users can view estimations in their orgs" ON estimations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            WHERE r.id = estimations.requirement_id
            AND p.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert estimations if not locked" ON estimations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE r.id = estimations.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND p.status != 'LOCKED'
        )
    );

-- =============================================
-- STEP 8: RLS policies on `requirement_driver_values`
-- =============================================

DROP POLICY IF EXISTS "Users can view requirement driver values in their orgs"       ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can insert requirement driver values if not locked"   ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can update requirement driver values if not locked"   ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can delete requirement driver values if not locked"   ON requirement_driver_values;

CREATE POLICY "Users can view requirement driver values in their orgs" ON requirement_driver_values
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND p.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert requirement driver values if not locked" ON requirement_driver_values
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND p.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can update requirement driver values if not locked" ON requirement_driver_values
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND p.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can delete requirement driver values if not locked" ON requirement_driver_values
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND p.status != 'LOCKED'
        )
    );

-- =============================================
-- STEP 9: RLS policies on estimation junction tables
--         (estimation_activities, estimation_drivers, estimation_risks)
-- =============================================

DROP POLICY IF EXISTS "Users can view estimation_activities"    ON estimation_activities;
DROP POLICY IF EXISTS "Users can view estimation_drivers"       ON estimation_drivers;
DROP POLICY IF EXISTS "Users can view estimation_risks"         ON estimation_risks;
DROP POLICY IF EXISTS "Editors can insert estimation_activities" ON estimation_activities;
DROP POLICY IF EXISTS "Editors can insert estimation_drivers"    ON estimation_drivers;
DROP POLICY IF EXISTS "Editors can insert estimation_risks"      ON estimation_risks;

CREATE POLICY "Users can view estimation_activities" ON estimation_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            WHERE e.id = estimation_activities.estimation_id
            AND p.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Users can view estimation_drivers" ON estimation_drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            WHERE e.id = estimation_drivers.estimation_id
            AND p.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Users can view estimation_risks" ON estimation_risks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            WHERE e.id = estimation_risks.estimation_id
            AND p.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert estimation_activities" ON estimation_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE e.id = estimation_activities.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can insert estimation_drivers" ON estimation_drivers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE e.id = estimation_drivers.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can insert estimation_risks" ON estimation_risks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN projects p ON p.id = r.project_id
            JOIN organization_members om ON om.org_id = p.organization_id
            WHERE e.id = estimation_risks.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );

-- =============================================
-- STEP 10: RLS policies on `consultant_analyses`
-- =============================================

DROP POLICY IF EXISTS consultant_analyses_select ON consultant_analyses;
DROP POLICY IF EXISTS consultant_analyses_insert ON consultant_analyses;

CREATE POLICY consultant_analyses_select ON consultant_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            WHERE r.id = consultant_analyses.requirement_id
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY consultant_analyses_insert ON consultant_analyses
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM requirements r
            JOIN projects p ON p.id = r.project_id
            WHERE r.id = consultant_analyses.requirement_id
            AND p.user_id = auth.uid()
        )
    );

-- =============================================
-- STEP 11: RLS policies on `requirement_understanding`
-- =============================================

DROP POLICY IF EXISTS "Users can view understanding for their requirements" ON requirement_understanding;

CREATE POLICY "Users can view understanding for their requirements"
ON requirement_understanding FOR SELECT
USING (
    user_id = auth.uid()
    OR requirement_id IN (
        SELECT r.id FROM requirements r
        JOIN projects p ON r.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

-- =============================================
-- STEP 12: RLS policies on `impact_map`
-- =============================================

DROP POLICY IF EXISTS "Users can view impact maps for their requirements" ON impact_map;

CREATE POLICY "Users can view impact maps for their requirements"
ON impact_map FOR SELECT
USING (
    user_id = auth.uid()
    OR requirement_id IN (
        SELECT r.id FROM requirements r
        JOIN projects p ON r.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

-- =============================================
-- STEP 13: Recreate RPC — get_latest_estimations
-- =============================================

DROP FUNCTION IF EXISTS get_latest_estimations(UUID);

CREATE OR REPLACE FUNCTION get_latest_estimations(project_id_param UUID)
RETURNS TABLE (
    requirement_id UUID,
    req_id VARCHAR,
    title VARCHAR,
    latest_estimation_id UUID,
    latest_scenario_name VARCHAR,
    latest_total_days DECIMAL,
    latest_created_at TIMESTAMP WITH TIME ZONE,
    estimation_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as requirement_id,
        r.req_id,
        r.title,
        e.id as latest_estimation_id,
        e.scenario_name as latest_scenario_name,
        e.total_days as latest_total_days,
        e.created_at as latest_created_at,
        COUNT(*) OVER (PARTITION BY r.id) as estimation_count
    FROM requirements r
    LEFT JOIN LATERAL (
        SELECT id, scenario_name, total_days, created_at
        FROM estimations
        WHERE requirement_id = r.id
        ORDER BY created_at DESC
        LIMIT 1
    ) e ON true
    WHERE r.project_id = project_id_param
    ORDER BY r.req_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_latest_estimations IS
'Returns the latest estimation for each requirement in a project, with estimation count';

-- =============================================
-- STEP 14: Recreate RPC — search_similar_requirements
-- =============================================

CREATE OR REPLACE FUNCTION search_similar_requirements(
    query_embedding vector(1536),
    user_id_filter uuid DEFAULT NULL,
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    req_id varchar(100),
    title varchar(500),
    description text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.req_id,
        r.title,
        r.description,
        1 - (r.embedding <=> query_embedding) AS similarity
    FROM requirements r
    JOIN projects p ON r.project_id = p.id
    WHERE
        r.embedding IS NOT NULL
        AND 1 - (r.embedding <=> query_embedding) > match_threshold
        AND (user_id_filter IS NULL OR p.user_id = user_id_filter)
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =============================================
-- STEP 15: Recreate RPC — update_estimation_actuals
-- =============================================

CREATE OR REPLACE FUNCTION update_estimation_actuals(
  p_estimation_id    UUID,
  p_user_id          UUID,
  p_actual_hours     DECIMAL(8,2),
  p_actual_start_date DATE          DEFAULT NULL,
  p_actual_end_date   DATE          DEFAULT NULL,
  p_actual_notes      TEXT          DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM estimations e
    JOIN requirements r ON r.id = e.requirement_id
    JOIN projects p ON p.id = r.project_id
    JOIN organization_members om ON om.org_id = p.organization_id
    WHERE e.id = p_estimation_id
      AND om.user_id = p_user_id
      AND om.role IN ('admin', 'editor', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized or estimation not found';
  END IF;

  UPDATE estimations SET
    actual_hours       = p_actual_hours,
    actual_start_date  = p_actual_start_date,
    actual_end_date    = p_actual_end_date,
    actual_notes       = p_actual_notes,
    actual_recorded_at = NOW(),
    actual_recorded_by = p_user_id
  WHERE id = p_estimation_id;
END;
$$;

-- =============================================
-- STEP 16: Update COMMENTS
-- =============================================

COMMENT ON TABLE projects IS 'Project entity (renamed from lists in 20260330)';
COMMENT ON COLUMN requirements.project_id IS 'FK to projects.id (renamed from list_id in 20260330)';
COMMENT ON INDEX idx_requirements_project_id IS 'Primary lookup for project requirements (renamed from idx_requirements_list_id)';

COMMIT;
