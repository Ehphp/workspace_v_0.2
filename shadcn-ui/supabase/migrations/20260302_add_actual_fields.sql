-- ============================================
-- Sprint 2 – S2-1a: Actual / Consuntivo fields on estimations
-- ============================================
-- Adds columns to track real hours, dates, and notes after a
-- requirement has been completed, enabling accuracy analytics.
-- ============================================

-- 1) New columns
ALTER TABLE estimations
  ADD COLUMN IF NOT EXISTS actual_hours        DECIMAL(8,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_start_date   DATE          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_end_date     DATE          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_notes        TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_recorded_at  TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_recorded_by  UUID          REFERENCES auth.users(id) DEFAULT NULL;

-- 2) Partial index – only rows that have actuals (speeds up accuracy queries)
CREATE INDEX IF NOT EXISTS idx_estimations_with_actuals
  ON estimations (requirement_id)
  WHERE actual_hours IS NOT NULL;

-- 3) Accuracy view – pre-joins estimation ↔ requirement ↔ technology
CREATE OR REPLACE VIEW estimation_accuracy AS
SELECT
  e.id                AS estimation_id,
  e.requirement_id,
  e.total_days,
  e.base_hours,
  e.actual_hours,
  CASE
    WHEN e.actual_hours IS NOT NULL AND e.total_days > 0
      THEN ROUND(((e.actual_hours / 8.0) - e.total_days) / e.total_days * 100, 1)
    ELSE NULL
  END                 AS deviation_percent,
  r.title             AS requirement_title,
  r.technology_id,
  t.name              AS technology_name,
  t.tech_category,
  e.scenario_name,
  e.created_at        AS estimated_at,
  e.actual_recorded_at
FROM estimations e
JOIN requirements r ON r.id = e.requirement_id
LEFT JOIN technologies t ON t.id = r.technology_id
WHERE e.actual_hours IS NOT NULL;

-- ============================================
-- S2-1b: RPC to update actual hours
-- ============================================
-- Follows the same SECURITY DEFINER + org membership check
-- pattern used by save_estimation_atomic.
-- ============================================

CREATE OR REPLACE FUNCTION update_estimation_actuals(
  p_estimation_id    UUID,
  p_user_id          UUID,
  p_actual_hours     DECIMAL(8,2),
  p_actual_start_date DATE          DEFAULT NULL,
  p_actual_end_date   DATE          DEFAULT NULL,
  p_actual_notes      TEXT          DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the estimation belongs to a requirement the user can access
  IF NOT EXISTS (
    SELECT 1
    FROM estimations e
    JOIN requirements r ON r.id = e.requirement_id
    JOIN lists l ON l.id = r.list_id
    JOIN organization_members om ON om.org_id = l.organization_id
    WHERE e.id = p_estimation_id
      AND om.user_id = p_user_id
      AND om.role IN ('admin', 'editor', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized or estimation not found';
  END IF;

  UPDATE estimations SET
    actual_hours       = p_actual_hours,
    actual_start_date  = p_actual_start_date,
    actual_end_date    = p_actual_end_date,
    actual_notes       = p_actual_notes,
    actual_recorded_at = NOW(),
    actual_recorded_by = p_user_id
  WHERE id = p_estimation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_estimation_actuals TO authenticated;
