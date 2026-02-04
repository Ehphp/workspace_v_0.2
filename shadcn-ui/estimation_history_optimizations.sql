-- Estimation History - Performance Optimizations
-- This migration adds useful indexes and views for estimation history queries

-- ============================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================

-- Index for faster history queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_estimations_req_created 
ON estimations(requirement_id, created_at DESC);

-- Index for user's estimations lookup
CREATE INDEX IF NOT EXISTS idx_estimations_user_created 
ON estimations(user_id, created_at DESC);

-- Composite index for estimation activities joins
CREATE INDEX IF NOT EXISTS idx_estimation_activities_composite
ON estimation_activities(estimation_id, activity_id, is_ai_suggested);

-- Composite index for estimation drivers joins
CREATE INDEX IF NOT EXISTS idx_estimation_drivers_composite
ON estimation_drivers(estimation_id, driver_id, selected_value);

-- Composite index for estimation risks joins
CREATE INDEX IF NOT EXISTS idx_estimation_risks_composite
ON estimation_risks(estimation_id, risk_id);

-- ============================================
-- MATERIALIZED VIEW FOR ESTIMATION SUMMARY
-- (Optional - for very large datasets)
-- ============================================

-- Create a view that pre-joins estimation data
-- This can be refreshed periodically for better performance
CREATE OR REPLACE VIEW estimations_with_details AS
SELECT 
    e.*,
    -- Count of related records
    (SELECT COUNT(*) FROM estimation_activities WHERE estimation_id = e.id) as activities_count,
    (SELECT COUNT(*) FROM estimation_drivers WHERE estimation_id = e.id) as drivers_count,
    (SELECT COUNT(*) FROM estimation_risks WHERE estimation_id = e.id) as risks_count,
    -- User info
    au.email as user_email,
    -- Requirement info
    r.req_id,
    r.title as requirement_title
FROM estimations e
LEFT JOIN auth.users au ON e.user_id = au.id
LEFT JOIN requirements r ON e.requirement_id = r.id;

-- ============================================
-- FUNCTION: Get Estimation Comparison
-- ============================================

-- Function to compare two estimations
CREATE OR REPLACE FUNCTION compare_estimations(
    estimation_id_1 UUID,
    estimation_id_2 UUID
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'estimation1', (
            SELECT json_build_object(
                'id', e1.id,
                'scenario_name', e1.scenario_name,
                'total_days', e1.total_days,
                'base_days', e1.base_days,
                'driver_multiplier', e1.driver_multiplier,
                'risk_score', e1.risk_score,
                'contingency_percent', e1.contingency_percent,
                'created_at', e1.created_at,
                'activities', (
                    SELECT json_agg(ea.activity_id)
                    FROM estimation_activities ea
                    WHERE ea.estimation_id = e1.id
                ),
                'drivers', (
                    SELECT json_agg(json_build_object('driver_id', ed.driver_id, 'value', ed.selected_value))
                    FROM estimation_drivers ed
                    WHERE ed.estimation_id = e1.id
                ),
                'risks', (
                    SELECT json_agg(er.risk_id)
                    FROM estimation_risks er
                    WHERE er.estimation_id = e1.id
                )
            )
            FROM estimations e1
            WHERE e1.id = estimation_id_1
        ),
        'estimation2', (
            SELECT json_build_object(
                'id', e2.id,
                'scenario_name', e2.scenario_name,
                'total_days', e2.total_days,
                'base_days', e2.base_days,
                'driver_multiplier', e2.driver_multiplier,
                'risk_score', e2.risk_score,
                'contingency_percent', e2.contingency_percent,
                'created_at', e2.created_at,
                'activities', (
                    SELECT json_agg(ea.activity_id)
                    FROM estimation_activities ea
                    WHERE ea.estimation_id = e2.id
                ),
                'drivers', (
                    SELECT json_agg(json_build_object('driver_id', ed.driver_id, 'value', ed.selected_value))
                    FROM estimation_drivers ed
                    WHERE ed.estimation_id = e2.id
                ),
                'risks', (
                    SELECT json_agg(er.risk_id)
                    FROM estimation_risks er
                    WHERE er.estimation_id = e2.id
                )
            )
            FROM estimations e2
            WHERE e2.id = estimation_id_2
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Get Latest Estimation per Requirement
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_estimations(list_id_param UUID)
RETURNS TABLE (
    requirement_id UUID,
    req_id VARCHAR,
    title VARCHAR,
    latest_estimation_id UUID,
    latest_scenario_name VARCHAR,
    latest_total_days DECIMAL,
    latest_created_at TIMESTAMP WITH TIME ZONE,
    estimation_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as requirement_id,
        r.req_id,
        r.title,
        e.id as latest_estimation_id,
        e.scenario_name as latest_scenario_name,
        e.total_days as latest_total_days,
        e.created_at as latest_created_at,
        COUNT(*) OVER (PARTITION BY r.id) as estimation_count
    FROM requirements r
    LEFT JOIN LATERAL (
        SELECT id, scenario_name, total_days, created_at
        FROM estimations
        WHERE requirement_id = r.id
        ORDER BY created_at DESC
        LIMIT 1
    ) e ON true
    WHERE r.list_id = list_id_param
    ORDER BY r.req_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TRIGGER: Update requirement updated_at on estimation save
-- ============================================

CREATE OR REPLACE FUNCTION update_requirement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE requirements
    SET updated_at = NOW()
    WHERE id = NEW.requirement_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_requirement_on_estimation
AFTER INSERT ON estimations
FOR EACH ROW
EXECUTE FUNCTION update_requirement_timestamp();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON VIEW estimations_with_details IS 
'Pre-joined view of estimations with counts and basic requirement info for faster queries';

COMMENT ON FUNCTION compare_estimations IS 
'Returns a JSON comparison of two estimations including all activities, drivers, and risks';

COMMENT ON FUNCTION get_latest_estimations IS 
'Returns the latest estimation for each requirement in a list, with estimation count';

COMMENT ON INDEX idx_estimations_req_created IS 
'Optimizes queries for estimation history ordered by date';

COMMENT ON INDEX idx_estimation_activities_composite IS 
'Speeds up joins between estimations and activities';
