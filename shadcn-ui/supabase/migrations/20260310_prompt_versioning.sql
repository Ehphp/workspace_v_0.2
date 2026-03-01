-- ============================================
-- Sprint 4 – S4-3: Prompt Versioning & A/B Testing
-- ============================================
-- Extends ai_prompts to support multiple variants per prompt_key,
-- A/B traffic splitting, usage tracking, and confidence scoring.
-- ============================================

-- 1) Drop unique constraint on prompt_key (allows multiple versions/variants)
ALTER TABLE ai_prompts DROP CONSTRAINT IF EXISTS ai_prompts_prompt_key_key;

-- 2) Add versioning and A/B testing columns
ALTER TABLE ai_prompts
  ADD COLUMN IF NOT EXISTS variant         TEXT    DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS traffic_pct     INT     DEFAULT 100 CHECK (traffic_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS usage_count     BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_confidence  DECIMAL(4,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promoted_at     TIMESTAMPTZ  DEFAULT NULL;

-- 3) New unique constraint: one active prompt per key+variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompts_key_variant_active
  ON ai_prompts (prompt_key, variant)
  WHERE is_active = TRUE;

-- 4) Function to increment usage count atomically
CREATE OR REPLACE FUNCTION increment_prompt_usage(p_prompt_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE ai_prompts SET usage_count = usage_count + 1 WHERE id = p_prompt_id;
$$;

GRANT EXECUTE ON FUNCTION increment_prompt_usage TO authenticated;

-- 5) Function to record confidence feedback (rolling average)
CREATE OR REPLACE FUNCTION record_prompt_confidence(
  p_prompt_id   UUID,
  p_confidence  DECIMAL(4,3)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ai_prompts SET
    avg_confidence = CASE
      WHEN avg_confidence IS NULL THEN p_confidence
      ELSE ROUND((avg_confidence * usage_count + p_confidence) / (usage_count + 1), 3)
    END,
    usage_count = usage_count + 1
  WHERE id = p_prompt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_prompt_confidence TO authenticated;

-- 6) View for A/B comparison dashboard
CREATE OR REPLACE VIEW prompt_ab_comparison AS
SELECT
  prompt_key,
  variant,
  version,
  is_active,
  traffic_pct,
  usage_count,
  avg_confidence,
  promoted_at,
  updated_at
FROM ai_prompts
WHERE is_active = TRUE
ORDER BY prompt_key, variant;

-- 7) RLS: Admin can write prompts
CREATE POLICY "ai_prompts_admin_write"
    ON ai_prompts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('admin', 'owner')
        )
    );

-- 8) Set variant = 'default' for existing rows that don't have it
UPDATE ai_prompts SET variant = 'default' WHERE variant IS NULL;
