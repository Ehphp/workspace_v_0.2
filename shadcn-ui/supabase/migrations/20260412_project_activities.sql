-- ============================================================================
-- Migration: Project Activities (custom, project-specific)
-- Date: 2026-04-12
-- Purpose: Stores AI-generated custom activities specific to a project.
--          These are domain-specific deliverables calibrated on the standard
--          activity catalog's scale but with names, descriptions, and effort
--          tailored to the project's documentation and blueprint.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id          UUID NOT NULL
                            REFERENCES projects(id) ON DELETE CASCADE,

    -- Activity identity
    code                VARCHAR(80)  NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    "group"             VARCHAR(50)  NOT NULL,

    -- Effort calibration
    base_hours          DECIMAL(5,2) NOT NULL,
    sm_multiplier       DECIMAL(4,2) NOT NULL DEFAULT 0.50,
    lg_multiplier       DECIMAL(4,2) NOT NULL DEFAULT 2.00,

    -- Intervention dimension
    intervention_type   VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    effort_modifier     DECIMAL(4,2) NOT NULL DEFAULT 1.00,

    -- Traceability
    source_activity_code VARCHAR(50),
    blueprint_node_name  VARCHAR(200),
    blueprint_node_type  VARCHAR(30),
    ai_rationale         TEXT,
    confidence           DECIMAL(3,2),

    -- Management
    is_enabled          BOOLEAN NOT NULL DEFAULT true,
    position            INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uq_project_activity_code UNIQUE (project_id, code),
    CONSTRAINT chk_pa_group CHECK (
        "group" IN ('ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE')
    ),
    CONSTRAINT chk_pa_intervention_type CHECK (
        intervention_type IN ('NEW', 'MODIFY', 'CONFIGURE', 'MIGRATE')
    ),
    CONSTRAINT chk_pa_base_hours CHECK (
        base_hours > 0 AND base_hours <= 40
    ),
    CONSTRAINT chk_pa_effort_modifier CHECK (
        effort_modifier > 0 AND effort_modifier <= 2.00
    ),
    CONSTRAINT chk_pa_blueprint_node_type CHECK (
        blueprint_node_type IS NULL
        OR blueprint_node_type IN ('component', 'dataDomain', 'integration')
    ),
    CONSTRAINT chk_pa_confidence CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id
    ON project_activities(project_id);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_position
    ON project_activities(project_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_project_activities_updated_at ON project_activities;
CREATE TRIGGER update_project_activities_updated_at
    BEFORE UPDATE ON project_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies (project-scoped via organization membership)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

-- SELECT: users can view activities for projects in their organizations
DROP POLICY IF EXISTS "Users can view project activities in their orgs" ON project_activities;
CREATE POLICY "Users can view project activities in their orgs"
    ON project_activities FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id = ANY(get_user_org_ids())
        )
    );

-- INSERT: admins/editors can create activities for projects in their orgs
DROP POLICY IF EXISTS "Admins and Editors can create project activities" ON project_activities;
CREATE POLICY "Admins and Editors can create project activities"
    ON project_activities FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id = ANY(get_user_org_ids())
            AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.org_id = p.organization_id
                AND om.user_id = auth.uid()
                AND om.role IN ('admin', 'editor')
            )
        )
    );

-- UPDATE: admins/editors can update activities for projects in their orgs
DROP POLICY IF EXISTS "Admins and Editors can update project activities" ON project_activities;
CREATE POLICY "Admins and Editors can update project activities"
    ON project_activities FOR UPDATE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id = ANY(get_user_org_ids())
            AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.org_id = p.organization_id
                AND om.user_id = auth.uid()
                AND om.role IN ('admin', 'editor')
            )
        )
    );

-- DELETE: admins can delete activities for projects in their orgs
DROP POLICY IF EXISTS "Admins can delete project activities" ON project_activities;
CREATE POLICY "Admins can delete project activities"
    ON project_activities FOR DELETE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id = ANY(get_user_org_ids())
            AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.org_id = p.organization_id
                AND om.user_id = auth.uid()
                AND om.role = 'admin'
            )
        )
    );
