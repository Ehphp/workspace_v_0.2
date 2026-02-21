-- Migration: Add override columns to technology_preset_activities
-- This allows each technology to have independent activity values without duplicating activities

-- Add override columns (nullable - NULL means use base activity value)
ALTER TABLE technology_preset_activities
ADD COLUMN IF NOT EXISTS name_override TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description_override TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS base_hours_override NUMERIC DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN technology_preset_activities.name_override IS 'Custom name for this activity in this technology. NULL = use base activity name';
COMMENT ON COLUMN technology_preset_activities.description_override IS 'Custom description for this activity in this technology. NULL = use base activity description';
COMMENT ON COLUMN technology_preset_activities.base_hours_override IS 'Custom base hours for this activity in this technology. NULL = use base activity hours';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tech_preset_activities_overrides 
ON technology_preset_activities(tech_preset_id) 
WHERE name_override IS NOT NULL OR base_hours_override IS NOT NULL;
