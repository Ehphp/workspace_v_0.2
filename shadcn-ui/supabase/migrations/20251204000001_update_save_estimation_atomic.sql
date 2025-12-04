-- Update save_estimation_atomic to use base_hours instead of base_days
CREATE OR REPLACE FUNCTION save_estimation_atomic(
    p_requirement_id UUID,
    p_user_id UUID,
    p_total_days NUMERIC,
    p_base_hours NUMERIC, -- Renamed from p_base_days
    p_driver_multiplier NUMERIC,
    p_risk_score NUMERIC,
    p_contingency_percent NUMERIC,
    p_scenario_name TEXT,
    p_activities JSONB,
    p_drivers JSONB,
    p_risks JSONB
) RETURNS UUID AS $$
DECLARE
    v_estimation_id UUID;
    v_activity JSONB;
    v_driver JSONB;
    v_risk JSONB;
BEGIN
    -- Insert into estimations
    INSERT INTO estimations (
        requirement_id,
        user_id,
        total_days,
        base_hours, -- Renamed column
        driver_multiplier,
        risk_score,
        contingency_percent,
        scenario_name
    ) VALUES (
        p_requirement_id,
        p_user_id,
        p_total_days,
        p_base_hours,
        p_driver_multiplier,
        p_risk_score,
        p_contingency_percent,
        p_scenario_name
    ) RETURNING id INTO v_estimation_id;

    -- Insert activities
    IF p_activities IS NOT NULL THEN
        FOR v_activity IN SELECT * FROM jsonb_array_elements(p_activities)
        LOOP
            INSERT INTO estimation_activities (
                estimation_id,
                activity_id,
                is_ai_suggested,
                notes
            ) VALUES (
                v_estimation_id,
                (v_activity->>'activity_id')::UUID,
                (v_activity->>'is_ai_suggested')::BOOLEAN,
                v_activity->>'notes'
            );
        END LOOP;
    END IF;

    -- Insert drivers
    IF p_drivers IS NOT NULL THEN
        FOR v_driver IN SELECT * FROM jsonb_array_elements(p_drivers)
        LOOP
            INSERT INTO estimation_drivers (
                estimation_id,
                driver_id,
                selected_value
            ) VALUES (
                v_estimation_id,
                (v_driver->>'driver_id')::UUID,
                v_driver->>'selected_value'
            );
        END LOOP;
    END IF;

    -- Insert risks
    IF p_risks IS NOT NULL THEN
        FOR v_risk IN SELECT * FROM jsonb_array_elements(p_risks)
        LOOP
            INSERT INTO estimation_risks (
                estimation_id,
                risk_id
            ) VALUES (
                v_estimation_id,
                (v_risk->>'risk_id')::UUID
            );
        END LOOP;
    END IF;

    RETURN v_estimation_id;
END;
$$ LANGUAGE plpgsql;
