-- Migration: Standardize Requirement and List States
-- Created: 2025-12-05
-- Purpose: Simplify state management by removing unused states

-- 1. Remove constraint on requirements to allow migration
ALTER TABLE requirements 
  DROP CONSTRAINT IF EXISTS requirements_state_check;

-- 2. Migrate existing requirement states to new standard
UPDATE requirements 
SET state = 'PROPOSED' 
WHERE state = 'CREATED';

UPDATE requirements 
SET state = 'SCHEDULED' 
WHERE state = 'IN_PROGRESS';

-- Any other non-standard states default to PROPOSED
UPDATE requirements 
SET state = 'PROPOSED' 
WHERE state NOT IN ('PROPOSED', 'SELECTED', 'SCHEDULED', 'DONE');

-- 3. Apply new constraint for requirements (4 states only)
ALTER TABLE requirements 
  ADD CONSTRAINT requirements_state_check 
  CHECK (state IN ('PROPOSED', 'SELECTED', 'SCHEDULED', 'DONE'));

-- 4. Migrate List statuses (REVIEW and LOCKED → DRAFT)
UPDATE lists 
SET status = 'DRAFT' 
WHERE status IN ('REVIEW', 'LOCKED');

-- Any other non-standard statuses default to DRAFT
UPDATE lists 
SET status = 'DRAFT' 
WHERE status NOT IN ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- 5. Remove lock-related columns (no longer needed)
ALTER TABLE lists 
  DROP COLUMN IF EXISTS locked_at;

ALTER TABLE lists 
  DROP COLUMN IF EXISTS locked_by;

-- 6. Remove old constraint and apply new one for lists (3 states only)
ALTER TABLE lists 
  DROP CONSTRAINT IF EXISTS lists_status_check;

ALTER TABLE lists 
  ADD CONSTRAINT lists_status_check 
  CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'));

-- Commit message:
-- Standardized states - Requirements: 4 states (PROPOSED/SELECTED/SCHEDULED/DONE), Lists: 3 states (DRAFT/ACTIVE/ARCHIVED)
-- Removed deprecated lock mechanism and governance states
