-- Rename base_days to base_hours in activities table
ALTER TABLE activities RENAME COLUMN base_days TO base_hours;

-- Rename base_days to base_hours in estimations table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimations' AND column_name = 'base_days') THEN
        ALTER TABLE estimations RENAME COLUMN base_days TO base_hours;
    END IF;
END $$;
