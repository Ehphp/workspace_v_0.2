-- ============================================
-- FIX: RLS policies on estimation junction tables
-- Date: 2026-03-04
-- Problem: estimation_activities, estimation_drivers, estimation_risks
--   still use l.user_id = auth.uid() from the original schema,
--   but the multitenancy migration (20260130) switched estimations/lists/requirements
--   to organization_members-based access. This causes silent 400 errors
--   when inserting activities, drivers, risks via direct REST (the wizard flow).
-- ============================================

-- =============================================
-- STEP 1: Drop legacy policies
-- =============================================

DROP POLICY IF EXISTS "Users can view estimation_activities" ON estimation_activities;
DROP POLICY IF EXISTS "Users can insert estimation_activities" ON estimation_activities;
DROP POLICY IF EXISTS "Users can view estimation_drivers"    ON estimation_drivers;
DROP POLICY IF EXISTS "Users can insert estimation_drivers"    ON estimation_drivers;
DROP POLICY IF EXISTS "Users can view estimation_risks"       ON estimation_risks;
DROP POLICY IF EXISTS "Users can insert estimation_risks"       ON estimation_risks;

-- =============================================
-- STEP 2: Create org-based SELECT policies
-- =============================================

CREATE POLICY "Users can view estimation_activities" ON estimation_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_activities.estimation_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Users can view estimation_drivers" ON estimation_drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_drivers.estimation_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Users can view estimation_risks" ON estimation_risks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_risks.estimation_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

-- =============================================
-- STEP 3: Create org-based INSERT policies
-- Uses the same pattern as "Editors can insert estimations" from
-- the consolidated multitenancy migration.
-- =============================================

CREATE POLICY "Editors can insert estimation_activities" ON estimation_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE e.id = estimation_activities.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can insert estimation_drivers" ON estimation_drivers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE e.id = estimation_drivers.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can insert estimation_risks" ON estimation_risks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE e.id = estimation_risks.estimation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
        )
    );
