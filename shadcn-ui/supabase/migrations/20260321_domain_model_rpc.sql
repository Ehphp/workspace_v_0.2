-- ============================================
-- ADD analysis_id + decision_id TO save_estimation_atomic RPC
-- ============================================
-- Extends the RPC to accept domain-model FK references.
-- Backward compatible: both new params default to NULL.

-- Drop all known overloads to avoid "function name is not unique"
DROP FUNCTION IF EXISTS save_estimation_atomic(
    UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR,
    JSONB, JSONB, JSONB
);
DROP FUNCTION IF EXISTS save_estimation_atomic(
    UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR,
    JSONB, JSONB, JSONB, TEXT
);
DROP FUNCTION IF EXISTS save_estimation_atomic(
    UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR,
    JSONB, JSONB, JSONB, TEXT, JSONB
);
DROP FUNCTION IF EXISTS save_estimation_atomic(
    UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR,
    JSONB, JSONB, JSONB, TEXT, JSONB, UUID
);
-- Previous version from 20260321_add_blueprint_id_to_rpc.sql
DROP FUNCTION IF EXISTS save_estimation_atomic(
    UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR,
    JSONB, JSONB, JSONB, TEXT, JSONB, UUID
);

CREATE OR REPLACE FUNCTION save_estimation_atomic(
    p_requirement_id UUID,
    p_user_id UUID,
    p_total_days DECIMAL(10,2),
    p_base_hours DECIMAL(10,2),
    p_driver_multiplier DECIMAL(5,3),
    p_risk_score INTEGER,
    p_contingency_percent DECIMAL(5,2),
    p_scenario_name VARCHAR(255),
    p_activities JSONB,
    p_drivers JSONB,
    p_risks JSONB,
    p_ai_reasoning TEXT DEFAULT NULL,
    p_senior_consultant_analysis JSONB DEFAULT NULL,
    p_blueprint_id UUID DEFAULT NULL,
    p_analysis_id UUID DEFAULT NULL,       -- NEW: FK to requirement_analyses
    p_decision_id UUID DEFAULT NULL        -- NEW: FK to estimation_decisions
)
RETURNS TABLE(
    estimation_id UUID,
    activities_count INTEGER,
    drivers_count INTEGER,
    risks_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_estimation_id UUID;
    v_activities_count INTEGER;
    v_drivers_count INTEGER;
    v_risks_count INTEGER;
BEGIN
    IF p_requirement_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'requirement_id and user_id are required';
    END IF;

    IF p_activities IS NULL OR jsonb_array_length(p_activities) = 0 THEN
        RAISE EXCEPTION 'At least one activity is required';
    END IF;

    -- Step 1: Insert estimation with domain FK references
    INSERT INTO estimations (
        requirement_id, user_id, total_days, base_hours,
        driver_multiplier, risk_score, contingency_percent, scenario_name,
        ai_reasoning, senior_consultant_analysis, blueprint_id,
        analysis_id, decision_id
    ) VALUES (
        p_requirement_id, p_user_id, p_total_days, p_base_hours,
        p_driver_multiplier, p_risk_score, p_contingency_percent, p_scenario_name,
        p_ai_reasoning, p_senior_consultant_analysis, p_blueprint_id,
        p_analysis_id, p_decision_id
    )
    RETURNING id INTO v_estimation_id;

    -- Step 2: Insert activities (required)
    INSERT INTO estimation_activities (estimation_id, activity_id, is_ai_suggested, notes)
    SELECT
        v_estimation_id,
        (item->>'activity_id')::UUID,
        COALESCE((item->>'is_ai_suggested')::BOOLEAN, false),
        COALESCE(item->>'notes', '')
    FROM jsonb_array_elements(p_activities) AS item;

    GET DIAGNOSTICS v_activities_count = ROW_COUNT;

    IF v_activities_count = 0 THEN
        RAISE EXCEPTION 'Failed to insert activities';
    END IF;

    -- Step 3: Insert drivers (optional)
    IF p_drivers IS NOT NULL AND jsonb_array_length(p_drivers) > 0 THEN
        INSERT INTO estimation_drivers (estimation_id, driver_id, selected_value)
        SELECT
            v_estimation_id,
            (item->>'driver_id')::UUID,
            item->>'selected_value'
        FROM jsonb_array_elements(p_drivers) AS item
        WHERE (item->>'driver_id') IS NOT NULL
          AND (item->>'selected_value') IS NOT NULL;

        GET DIAGNOSTICS v_drivers_count = ROW_COUNT;
    ELSE
        v_drivers_count := 0;
    END IF;

    -- Step 4: Insert risks (optional)
    IF p_risks IS NOT NULL AND jsonb_array_length(p_risks) > 0 THEN
        INSERT INTO estimation_risks (estimation_id, risk_id)
        SELECT
            v_estimation_id,
            (item->>'risk_id')::UUID
        FROM jsonb_array_elements(p_risks) AS item
        WHERE (item->>'risk_id') IS NOT NULL;

        GET DIAGNOSTICS v_risks_count = ROW_COUNT;
    ELSE
        v_risks_count := 0;
    END IF;

    -- Step 5: Return summary
    RETURN QUERY SELECT
        v_estimation_id,
        v_activities_count,
        v_drivers_count,
        v_risks_count;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to save estimation: %', SQLERRM;
END;
$$;
