-- Migration: Consolidate technologies into technology_presets
-- Date: 2025-12-05
-- Description: Adds color, icon, and sort_order to technology_presets and removes technologies table

-- Step 1: Add new columns to technology_presets
ALTER TABLE technology_presets 
ADD COLUMN IF NOT EXISTS color VARCHAR(20),
ADD COLUMN IF NOT EXISTS icon VARCHAR(50),
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Migrate color data from technologies to technology_presets (by matching tech_category)
-- This assumes tech_category contains the technology code
-- Only execute if technologies table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'technologies') THEN
        UPDATE technology_presets tp
        SET color = t.color,
            icon = t.icon,
            sort_order = t.sort_order
        FROM technologies t
        WHERE tp.tech_category = t.code;
    END IF;
END $$;

-- Step 3: Drop the technologies table
DROP TABLE IF EXISTS technologies CASCADE;

-- Step 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_technology_presets_sort_order ON technology_presets(sort_order);

COMMENT ON COLUMN technology_presets.color IS 'Visual color for the technology (hex format)';
COMMENT ON COLUMN technology_presets.icon IS 'Icon identifier for the technology';
COMMENT ON COLUMN technology_presets.sort_order IS 'Display order in lists';
COMMENT ON COLUMN technology_presets.is_custom IS 'Whether this is a custom preset created by a user';
COMMENT ON COLUMN technology_presets.created_by IS 'User ID who created this custom preset';

-- Step 5: Add RLS policies for technology_presets
-- Enable RLS if not already enabled
ALTER TABLE technology_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view technology presets" ON technology_presets;
DROP POLICY IF EXISTS "Users can insert custom presets" ON technology_presets;
DROP POLICY IF EXISTS "Users can update their own custom presets" ON technology_presets;
DROP POLICY IF EXISTS "Users can delete their own custom presets" ON technology_presets;

-- READ: All authenticated users can view all presets (both system and custom)
CREATE POLICY "Anyone can view technology presets" ON technology_presets
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- INSERT: Authenticated users can create custom presets
CREATE POLICY "Users can insert custom presets" ON technology_presets
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        is_custom = TRUE AND
        created_by = auth.uid()
    );

-- UPDATE: Users can only update their own custom presets
CREATE POLICY "Users can update their own custom presets" ON technology_presets
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL AND
        is_custom = TRUE AND
        created_by = auth.uid()
    )
    WITH CHECK (
        is_custom = TRUE AND
        created_by = auth.uid()
    );

-- DELETE: Users can only delete their own custom presets
CREATE POLICY "Users can delete their own custom presets" ON technology_presets
    FOR DELETE 
    USING (
        auth.uid() IS NOT NULL AND
        is_custom = TRUE AND
        created_by = auth.uid()
    );

-- Step 6: Add RLS policies for technology_preset_activities
ALTER TABLE technology_preset_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view preset activities" ON technology_preset_activities;
DROP POLICY IF EXISTS "Users can manage activities for custom presets" ON technology_preset_activities;

-- READ: All authenticated users can view preset activities
CREATE POLICY "Anyone can view preset activities" ON technology_preset_activities
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: Users can manage activities for their own custom presets
CREATE POLICY "Users can manage activities for custom presets" ON technology_preset_activities
    FOR ALL 
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM technology_presets
            WHERE technology_presets.id = technology_preset_activities.tech_preset_id
            AND technology_presets.is_custom = TRUE
            AND technology_presets.created_by = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM technology_presets
            WHERE technology_presets.id = technology_preset_activities.tech_preset_id
            AND technology_presets.is_custom = TRUE
            AND technology_presets.created_by = auth.uid()
        )
    );
