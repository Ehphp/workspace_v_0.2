-- Migration: Simplify technology_presets → technologies
-- Date: 2026-02-28
-- Description: Collapse 9 presets (3 per tech × 3 complexity) into 3 technologies.
--   Remove template fields (default_activity_codes, default_driver_values, default_risks).
--   The AI now chooses activities freely from the tech_category catalog.
--   The pivot table technology_preset_activities is renamed to technology_activities.

-- ============================================
-- STEP 1: Rename table technology_presets → technologies
-- ============================================
ALTER TABLE technology_presets RENAME TO technologies;

-- ============================================
-- STEP 2: Drop template columns (no longer needed — AI decides)
-- ============================================
ALTER TABLE technologies DROP COLUMN IF EXISTS default_activity_codes;
ALTER TABLE technologies DROP COLUMN IF EXISTS default_driver_values;
ALTER TABLE technologies DROP COLUMN IF EXISTS default_risks;

-- ============================================
-- STEP 3: Consolidate preset rows into one per tech_category
-- Keep the "Standard" preset for each tech_category, delete Light/Complex variants.
-- First update FKs on lists/requirements that point to deleted presets.
-- ============================================

-- 3a. Identify the "keeper" row per tech_category (prefer Standard/Basic preset)
-- POWER_PLATFORM → keep TECH_PP_BASIC
-- BACKEND → keep TECH_BACKEND_API
-- FRONTEND → keep TECH_FRONTEND_REACT

-- 3b. Re-point lists and requirements FKs from deleted presets to keeper
UPDATE lists SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_PP_BASIC' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'POWER_PLATFORM' AND code != 'TECH_PP_BASIC'
);

UPDATE requirements SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_PP_BASIC' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'POWER_PLATFORM' AND code != 'TECH_PP_BASIC'
);

UPDATE lists SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_BACKEND_API' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'BACKEND' AND code != 'TECH_BACKEND_API'
);

UPDATE requirements SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_BACKEND_API' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'BACKEND' AND code != 'TECH_BACKEND_API'
);

UPDATE lists SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_FRONTEND_REACT' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'FRONTEND' AND code != 'TECH_FRONTEND_REACT'
);

UPDATE requirements SET tech_preset_id = (
    SELECT id FROM technologies WHERE code = 'TECH_FRONTEND_REACT' LIMIT 1
) WHERE tech_preset_id IN (
    SELECT id FROM technologies WHERE tech_category = 'FRONTEND' AND code != 'TECH_FRONTEND_REACT'
);

-- 3c. Migrate pivot rows from deleted presets to keeper (avoid duplicates)
INSERT INTO technology_preset_activities (tech_preset_id, activity_id, position, name_override, description_override, base_hours_override)
SELECT 
    keeper.id,
    tpa.activity_id,
    tpa.position,
    tpa.name_override,
    tpa.description_override,
    tpa.base_hours_override
FROM technology_preset_activities tpa
JOIN technologies del ON del.id = tpa.tech_preset_id
JOIN technologies keeper ON keeper.tech_category = del.tech_category 
    AND keeper.code IN ('TECH_PP_BASIC', 'TECH_BACKEND_API', 'TECH_FRONTEND_REACT')
WHERE del.code NOT IN ('TECH_PP_BASIC', 'TECH_BACKEND_API', 'TECH_FRONTEND_REACT')
ON CONFLICT (tech_preset_id, activity_id) DO NOTHING;

-- 3d. Delete the variant presets (pivot rows cascade)
DELETE FROM technologies 
WHERE code IN (
    'TECH_PP_LIGHT', 'TECH_PP_HR',
    'TECH_BACKEND_SIMPLE', 'TECH_BACKEND_COMPLEX',
    'TECH_FRONTEND_SIMPLE', 'TECH_FRONTEND_COMPLEX'
) AND is_custom = false;

-- 3e. Rename the keeper presets to clean technology names
UPDATE technologies SET 
    code = 'POWER_PLATFORM',
    name = 'Power Platform',
    description = 'Microsoft Power Platform: Power Apps, Power Automate, Dataverse.'
WHERE code = 'TECH_PP_BASIC';

UPDATE technologies SET 
    code = 'BACKEND',
    name = 'Backend',
    description = 'Backend API development: REST/GraphQL endpoints, database, business logic.'
WHERE code = 'TECH_BACKEND_API';

UPDATE technologies SET 
    code = 'FRONTEND',
    name = 'Frontend',
    description = 'Frontend development: React/Angular/Vue components, SPA, responsive UI.'
WHERE code = 'TECH_FRONTEND_REACT';

-- ============================================
-- STEP 4: Rename FK columns from tech_preset_id → technology_id
-- ============================================
ALTER TABLE lists RENAME COLUMN tech_preset_id TO technology_id;
ALTER TABLE requirements RENAME COLUMN tech_preset_id TO technology_id;

-- ============================================
-- STEP 5: Rename pivot table
-- ============================================
ALTER TABLE technology_preset_activities RENAME TO technology_activities;
ALTER TABLE technology_activities RENAME COLUMN tech_preset_id TO technology_id;

-- ============================================
-- STEP 6: Update indexes (drop old, create new)
-- ============================================
DROP INDEX IF EXISTS idx_tech_presets_system_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_technologies_system_code 
    ON technologies(code) WHERE created_by IS NULL;

DROP INDEX IF EXISTS idx_technology_presets_sort_order;
CREATE INDEX IF NOT EXISTS idx_technologies_sort_order ON technologies(sort_order);

DROP INDEX IF EXISTS idx_tech_preset_activities_overrides;
CREATE INDEX IF NOT EXISTS idx_technology_activities_overrides 
    ON technology_activities(technology_id) 
    WHERE name_override IS NOT NULL OR base_hours_override IS NOT NULL;

-- ============================================
-- STEP 7: Update RLS policies
-- ============================================
-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view technology presets" ON technologies;
DROP POLICY IF EXISTS "Users can insert custom presets" ON technologies;
DROP POLICY IF EXISTS "Users can update their own custom presets" ON technologies;
DROP POLICY IF EXISTS "Users can delete their own custom presets" ON technologies;

-- Create new policies
CREATE POLICY "Anyone can view technologies" ON technologies
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert custom technologies" ON technologies
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    );

CREATE POLICY "Users can update their own custom technologies" ON technologies
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    ) WITH CHECK (is_custom = TRUE AND created_by = auth.uid());

CREATE POLICY "Users can delete their own custom technologies" ON technologies
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    );

-- Pivot table policies
DROP POLICY IF EXISTS "Anyone can view preset activities" ON technology_activities;
DROP POLICY IF EXISTS "Users can manage activities for custom presets" ON technology_activities;

CREATE POLICY "Anyone can view technology activities" ON technology_activities
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage activities for custom technologies" ON technology_activities
    FOR ALL USING (
        auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM technologies
            WHERE technologies.id = technology_activities.technology_id
            AND technologies.is_custom = TRUE
            AND technologies.created_by = auth.uid()
        )
    ) WITH CHECK (
        auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM technologies
            WHERE technologies.id = technology_activities.technology_id
            AND technologies.is_custom = TRUE
            AND technologies.created_by = auth.uid()
        )
    );

-- ============================================
-- STEP 8: Add comments
-- ============================================
COMMENT ON TABLE technologies IS 'Technology definitions: Power Platform, Backend, Frontend, etc.';
COMMENT ON TABLE technology_activities IS 'Per-technology activity catalog with optional overrides (hours, name, description)';
COMMENT ON COLUMN technologies.tech_category IS 'Legacy alias — matches technologies.code for system technologies, may differ for custom';
COMMENT ON COLUMN lists.technology_id IS 'Default technology for requirements in this list';
COMMENT ON COLUMN requirements.technology_id IS 'Technology used for estimating this requirement';
