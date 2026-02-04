-- ============================================
-- ADD AI REASONING TO ESTIMATIONS
-- ============================================
-- This migration adds the ai_reasoning field to store AI analysis text
-- when an estimation is generated through the AI interview flow.

-- 1. Add the ai_reasoning column
ALTER TABLE estimations 
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- 2. Add comment for documentation
COMMENT ON COLUMN estimations.ai_reasoning IS 
'AI analysis/reasoning text that was generated during the estimation process. Contains the AI explanation of why certain activities were selected.';

-- 3. Drop the old function first (to avoid signature conflict)
DROP FUNCTION IF EXISTS save_estimation_atomic(UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR, JSONB, JSONB, JSONB);

-- 4. Create the updated function with ai_reasoning parameter
CREATE OR REPLACE FUNCTION save_estimation_atomic(
    p_requirement_id UUID,
    p_user_id UUID,
    p_total_days DECIMAL(10,2),
    p_base_hours DECIMAL(10,2),
    p_driver_multiplier DECIMAL(5,3),
    p_risk_score INTEGER,
    p_contingency_percent DECIMAL(5,2),
    p_scenario_name VARCHAR(255),
    p_activities JSONB,  -- [{activity_id: uuid, is_ai_suggested: bool, notes: string}]
    p_drivers JSONB,     -- [{driver_id: uuid, selected_value: string}]
    p_risks JSONB,       -- [{risk_id: uuid}]
    p_ai_reasoning TEXT DEFAULT NULL  -- AI analysis text (optional)
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
    -- Validate inputs
    IF p_requirement_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'requirement_id and user_id are required';
    END IF;

    IF p_activities IS NULL OR jsonb_array_length(p_activities) = 0 THEN
        RAISE EXCEPTION 'At least one activity is required';
    END IF;

    -- Step 1: Insert estimation record
    INSERT INTO estimations (
        requirement_id, 
        user_id, 
        total_days, 
        base_hours,
        driver_multiplier, 
        risk_score, 
        contingency_percent, 
        scenario_name,
        ai_reasoning
    ) VALUES (
        p_requirement_id, 
        p_user_id, 
        p_total_days, 
        p_base_hours,
        p_driver_multiplier, 
        p_risk_score, 
        p_contingency_percent, 
        p_scenario_name,
        p_ai_reasoning
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

    -- Validate at least one activity was inserted
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

    -- Return results
    RETURN QUERY SELECT v_estimation_id, v_activities_count, v_drivers_count, v_risks_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION save_estimation_atomic(UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR, JSONB, JSONB, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION save_estimation_atomic(UUID, UUID, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, VARCHAR, JSONB, JSONB, JSONB, TEXT) IS 
'Atomically saves an estimation with all related data (activities, drivers, risks, and optional AI reasoning). All operations are performed in a single transaction.';
