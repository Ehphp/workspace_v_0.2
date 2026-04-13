-- Migration: Add workflows column to project_technical_blueprints
-- Workflows are stored as JSONB inside the blueprint row (same pattern as components/dataDomains/integrations)

ALTER TABLE project_technical_blueprints
    ADD COLUMN IF NOT EXISTS workflows JSONB DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN project_technical_blueprints.workflows IS 'Array of BlueprintWorkflow objects — operational workflows extracted from documentation';
