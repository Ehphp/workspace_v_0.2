-- ============================================================================
-- Migration: Project Technical Blueprints
-- Date: 2026-04-01
-- Purpose: Stores structured AI-generated technical blueprints at the project
--          level. Each row captures one generation/version, enabling version
--          history and a persistent architectural baseline for the project.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_technical_blueprints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id      UUID NOT NULL
                        REFERENCES projects(id) ON DELETE CASCADE,

    version         INTEGER NOT NULL DEFAULT 1,

    -- Original source documentation text
    source_text     TEXT,

    -- AI-generated summary
    summary         TEXT,

    -- Structured architecture data (JSONB arrays)
    components          JSONB NOT NULL DEFAULT '[]',
    data_domains        JSONB NOT NULL DEFAULT '[]',
    integrations        JSONB NOT NULL DEFAULT '[]',

    -- Analysis metadata (JSONB arrays)
    architectural_notes JSONB NOT NULL DEFAULT '[]',
    assumptions         JSONB NOT NULL DEFAULT '[]',
    missing_information JSONB NOT NULL DEFAULT '[]',

    -- Overall confidence score (0-1)
    confidence      NUMERIC,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_project_technical_blueprints_project_id
    ON project_technical_blueprints(project_id);

CREATE INDEX idx_project_technical_blueprints_project_version
    ON project_technical_blueprints(project_id, version DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger (reuses existing update_updated_at_column if available)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER update_project_technical_blueprints_updated_at
    BEFORE UPDATE ON project_technical_blueprints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies (project-scoped via organization membership)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_technical_blueprints ENABLE ROW LEVEL SECURITY;

-- SELECT: users can view blueprints for projects in their organizations
CREATE POLICY "Users can view project blueprints in their orgs"
    ON project_technical_blueprints FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id = ANY(get_user_org_ids())
        )
    );

-- INSERT: admins/editors can create blueprints for projects in their orgs
CREATE POLICY "Admins and Editors can create project blueprints"
    ON project_technical_blueprints FOR INSERT
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

-- UPDATE: admins/editors can update blueprints for projects in their orgs
CREATE POLICY "Admins and Editors can update project blueprints"
    ON project_technical_blueprints FOR UPDATE
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

-- DELETE: admins can delete blueprints for projects in their orgs
CREATE POLICY "Admins can delete project blueprints"
    ON project_technical_blueprints FOR DELETE
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
