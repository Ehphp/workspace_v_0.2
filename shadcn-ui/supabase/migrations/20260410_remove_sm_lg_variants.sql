-- ============================================
-- Migration: Remove _SM/_LG activity variants, add multiplier columns
-- 
-- Replaces the triple-row pattern (base + _SM + _LG) with:
--   - A single base activity row per concept
--   - sm_multiplier / lg_multiplier columns for complexity scaling
--   - complexity_variant tracking on estimation_activities
--   - complexity_tier on technologies
--
-- NOTE: technology_presets was renamed to "technologies" and
--       technology_preset_activities to "technology_activities"
--       by migration 20260228_simplify_presets_to_technologies.sql.
--       The default_activity_codes column was dropped in that migration.
-- ============================================

-- Step 1: Add multiplier columns to activities
ALTER TABLE activities 
  ADD COLUMN IF NOT EXISTS sm_multiplier DECIMAL(4,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS lg_multiplier DECIMAL(4,2) NOT NULL DEFAULT 2.00;

-- Step 2: Set outlier multipliers (non-default ratios)
UPDATE activities SET sm_multiplier = 0.40 WHERE code = 'PP_ANL_ALIGN';
UPDATE activities SET lg_multiplier = 1.50 WHERE code = 'PP_FLOW_SIMPLE';
UPDATE activities SET sm_multiplier = 0.75 WHERE code = 'PP_FLOW_COMPLEX';
UPDATE activities SET sm_multiplier = 0.533, lg_multiplier = 1.667 WHERE code = 'BE_API_SIMPLE';
UPDATE activities SET sm_multiplier = 0.667 WHERE code = 'BE_API_COMPLEX';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'BE_INT_TEST';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'FE_STATE_MGMT';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'FE_E2E_TEST';
UPDATE activities SET lg_multiplier = 3.00 WHERE code = 'CRS_DOC';

-- Step 3: Add complexity_variant to estimation_activities
ALTER TABLE estimation_activities
  ADD COLUMN IF NOT EXISTS complexity_variant VARCHAR(5) DEFAULT 'BASE';

-- Step 4: Add complexity_tier to technologies (was technology_presets)
ALTER TABLE technologies
  ADD COLUMN IF NOT EXISTS complexity_tier VARCHAR(10) DEFAULT 'STANDARD';

-- Step 5a: Delete _SM/_LG estimation_activities where the base activity already exists
-- (these would cause a unique constraint violation when re-pointing)
DELETE FROM estimation_activities ea
USING activities variant, activities base
WHERE ea.activity_id = variant.id
  AND (variant.code LIKE '%\_SM' ESCAPE '\' OR variant.code LIKE '%\_LG' ESCAPE '\')
  AND base.code = REGEXP_REPLACE(variant.code, '_(SM|LG)$', '')
  AND EXISTS (
    SELECT 1 FROM estimation_activities ea2
    WHERE ea2.estimation_id = ea.estimation_id
      AND ea2.activity_id = base.id
  );

-- Step 5b: Re-point remaining _SM/_LG estimation_activities to base activity
-- and record the complexity variant for historical tracking.
UPDATE estimation_activities ea
SET 
  complexity_variant = CASE 
    WHEN a.code LIKE '%\_SM' ESCAPE '\' THEN 'SM'
    WHEN a.code LIKE '%\_LG' ESCAPE '\' THEN 'LG'
    ELSE ea.complexity_variant
  END,
  activity_id = base.id
FROM activities a
JOIN activities base ON base.code = REGEXP_REPLACE(a.code, '_(SM|LG)$', '')
WHERE ea.activity_id = a.id
  AND (a.code LIKE '%\_SM' ESCAPE '\' OR a.code LIKE '%\_LG' ESCAPE '\');

-- Step 6: Remove technology_activities referencing _SM/_LG activities
DELETE FROM technology_activities 
WHERE activity_id IN (
  SELECT id FROM activities WHERE code LIKE '%\_SM' ESCAPE '\' OR code LIKE '%\_LG' ESCAPE '\'
);

-- Step 7: Re-point base_activity_id self-references from _SM/_LG to the base activity
UPDATE activities child
SET base_activity_id = base.id
FROM activities variant
JOIN activities base ON base.code = REGEXP_REPLACE(variant.code, '_(SM|LG)$', '')
WHERE child.base_activity_id = variant.id
  AND (variant.code LIKE '%\_SM' ESCAPE '\' OR variant.code LIKE '%\_LG' ESCAPE '\');

-- Step 7b: Nullify any remaining base_activity_id that still points to _SM/_LG
-- (in case no matching base row was found)
UPDATE activities
SET base_activity_id = NULL
WHERE base_activity_id IN (
  SELECT id FROM activities WHERE code LIKE '%\_SM' ESCAPE '\' OR code LIKE '%\_LG' ESCAPE '\'
);

-- Step 8: Delete _SM/_LG activity rows
DELETE FROM activities WHERE code LIKE '%\_SM' ESCAPE '\' OR code LIKE '%\_LG' ESCAPE '\';
