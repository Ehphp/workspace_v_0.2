-- ============================================
-- Add senior_consultant_analysis column to estimations table
-- Migration for Senior Consultant feature
-- ============================================

-- Add JSONB column for storing senior consultant analysis
ALTER TABLE estimations 
ADD COLUMN IF NOT EXISTS senior_consultant_analysis JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN estimations.senior_consultant_analysis IS 
'Stores AI-generated senior consultant analysis including implementation_tips, discrepancies, and risk_analysis';

-- Create index for efficient querying of estimations with consultant analysis
CREATE INDEX IF NOT EXISTS idx_estimations_has_consultant_analysis 
ON estimations ((senior_consultant_analysis IS NOT NULL));

-- Create GIN index for JSONB querying (if needed for searching within the analysis)
CREATE INDEX IF NOT EXISTS idx_estimations_consultant_analysis_gin 
ON estimations USING GIN (senior_consultant_analysis) 
WHERE senior_consultant_analysis IS NOT NULL;
