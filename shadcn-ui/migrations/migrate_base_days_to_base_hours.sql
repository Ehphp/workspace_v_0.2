-- Migration: Convert base_days to base_hours
-- Date: 2025-12-07
-- Description: Rename column from base_days to base_hours and convert all values from days to hours (multiply by 8)

-- Step 1: Add new column base_hours
ALTER TABLE activities ADD COLUMN IF NOT EXISTS base_hours DECIMAL(5,2);

-- Step 2: Copy and convert data from base_days to base_hours (days * 8 = hours)
UPDATE activities SET base_hours = base_days * 8 WHERE base_hours IS NULL;

-- Step 3: Make base_hours NOT NULL (after data is migrated)
ALTER TABLE activities ALTER COLUMN base_hours SET NOT NULL;

-- Step 4: Drop old column base_days
ALTER TABLE activities DROP COLUMN IF EXISTS base_days;

-- Verification query (run this to check the migration)
-- SELECT code, name, base_hours FROM activities ORDER BY code LIMIT 10;
