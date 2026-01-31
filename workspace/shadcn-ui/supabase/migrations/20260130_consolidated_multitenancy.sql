-- ============================================
-- CONSOLIDATED MULTITENANCY & GOVERNANCE
-- This file consolidates all RLS policies and RPC functions
-- for the multi-tenant team/organization system
-- 
-- Replaces:
--   - 20251204_multitenancy_rls.sql
--   - 20251204_phase3_governance.sql  
--   - 20251204_fix_rls_and_data.sql
--   - 20260130_fix_critical_rls_policies.sql
--   - 20260130_fix_last_admin_check.sql
-- ============================================

-- =============================================
-- PART 1: ENABLE RLS ON TABLES
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PART 2: HELPER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(array_agg(org_id), ARRAY[]::UUID[])
    FROM organization_members
    WHERE user_id = auth.uid();
$$;

-- =============================================
-- PART 3: DROP ALL LEGACY POLICIES
-- =============================================

-- Lists legacy policies
DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;
DROP POLICY IF EXISTS "Users can view lists in their orgs" ON lists;
DROP POLICY IF EXISTS "Admins and Editors can create lists" ON lists;
DROP POLICY IF EXISTS "Admins and Editors can update lists" ON lists;
DROP POLICY IF EXISTS "Only Admins can delete lists" ON lists;

-- Requirements legacy policies  
DROP POLICY IF EXISTS "Users can view requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can insert requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can update requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can delete requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can view requirements in their orgs" ON requirements;
DROP POLICY IF EXISTS "Editors can insert requirements if not locked" ON requirements;
DROP POLICY IF EXISTS "Editors can update requirements if not locked" ON requirements;
DROP POLICY IF EXISTS "Editors can delete requirements if not locked" ON requirements;

-- Estimations legacy policies
DROP POLICY IF EXISTS "Users can view estimations for their requirements" ON estimations;
DROP POLICY IF EXISTS "Users can insert estimations for their requirements" ON estimations;
DROP POLICY IF EXISTS "Users can view estimations in their orgs" ON estimations;
DROP POLICY IF EXISTS "Editors can insert estimations if not locked" ON estimations;

-- Requirement driver values legacy policies
DROP POLICY IF EXISTS "Users can view requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can upsert requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can update requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can delete requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can view requirement driver values in their orgs" ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can insert requirement driver values if not locked" ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can update requirement driver values if not locked" ON requirement_driver_values;
DROP POLICY IF EXISTS "Editors can delete requirement driver values if not locked" ON requirement_driver_values;

-- Organization policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

-- =============================================
-- PART 4: ORGANIZATION & MEMBER POLICIES
-- =============================================

CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR org_id = ANY(get_user_org_ids())
    );

-- =============================================
-- PART 5: LISTS POLICIES
-- =============================================

CREATE POLICY "Users can view lists in their orgs" ON lists
    FOR SELECT USING (
        organization_id = ANY(get_user_org_ids())
    );

CREATE POLICY "Admins and Editors can create lists" ON lists
    FOR INSERT WITH CHECK (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Admins and Editors can update lists" ON lists
    FOR UPDATE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    )
    WITH CHECK (
        (
            status != 'LOCKED' OR
            EXISTS (
                SELECT 1 FROM organization_members
                WHERE org_id = organization_id
                AND user_id = auth.uid()
                AND role = 'admin'
            )
        )
    );

CREATE POLICY "Only Admins can delete lists" ON lists
    FOR DELETE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = organization_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =============================================
-- PART 6: REQUIREMENTS POLICIES
-- =============================================

CREATE POLICY "Users can view requirements in their orgs" ON requirements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lists
            WHERE lists.id = requirements.list_id
            AND lists.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert requirements if not locked" ON requirements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lists
            JOIN organization_members om ON om.org_id = lists.organization_id
            WHERE lists.id = requirements.list_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND lists.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can update requirements if not locked" ON requirements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM lists
            JOIN organization_members om ON om.org_id = lists.organization_id
            WHERE lists.id = requirements.list_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND lists.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can delete requirements if not locked" ON requirements
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lists
            JOIN organization_members om ON om.org_id = lists.organization_id
            WHERE lists.id = requirements.list_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND lists.status != 'LOCKED'
        )
    );

-- =============================================
-- PART 7: ESTIMATIONS POLICIES
-- =============================================

CREATE POLICY "Users can view estimations in their orgs" ON estimations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = estimations.requirement_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert estimations if not locked" ON estimations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE r.id = estimations.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND l.status != 'LOCKED'
        )
    );

-- =============================================
-- PART 8: REQUIREMENT DRIVER VALUES POLICIES
-- =============================================

CREATE POLICY "Users can view requirement driver values in their orgs" ON requirement_driver_values
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

CREATE POLICY "Editors can insert requirement driver values if not locked" ON requirement_driver_values
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND l.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can update requirement driver values if not locked" ON requirement_driver_values
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND l.status != 'LOCKED'
        )
    );

CREATE POLICY "Editors can delete requirement driver values if not locked" ON requirement_driver_values
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            JOIN organization_members om ON om.org_id = l.organization_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND om.user_id = auth.uid()
            AND om.role IN ('admin', 'editor')
            AND l.status != 'LOCKED'
        )
    );

-- =============================================
-- PART 9: RPC FUNCTIONS - TEAM MANAGEMENT
-- =============================================

-- 9.1 Create Team Organization
CREATE OR REPLACE FUNCTION create_team_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
BEGIN
    INSERT INTO organizations (name, type)
    VALUES (org_name, 'team')
    RETURNING id INTO new_org_id;

    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, auth.uid(), 'admin');

    RETURN new_org_id;
END;
$$;

-- 9.2 Get Organization Members Details
CREATE OR REPLACE FUNCTION get_org_members_details(target_org_id UUID)
RETURNS TABLE (
    user_id UUID,
    email VARCHAR,
    role VARCHAR,
    joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE org_id = target_org_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        om.user_id,
        au.email::VARCHAR,
        om.role::VARCHAR,
        om.created_at
    FROM organization_members om
    JOIN auth.users au ON au.id = om.user_id
    WHERE om.org_id = target_org_id
    ORDER BY om.created_at DESC;
END;
$$;

-- 9.3 Add Member by Email (with role validation)
CREATE OR REPLACE FUNCTION add_member_by_email(target_email TEXT, target_role TEXT, target_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
    requester_role TEXT;
BEGIN
    -- Validate role enum FIRST
    IF target_role NOT IN ('admin', 'editor', 'viewer') THEN
        RETURN json_build_object('success', false, 'message', 'Invalid role. Must be admin, editor, or viewer.');
    END IF;

    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role IS NULL OR requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can add members';
    END IF;

    SELECT id INTO target_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(target_email);

    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found. They must register first.');
    END IF;

    IF EXISTS (SELECT 1 FROM organization_members WHERE org_id = target_org_id AND user_id = target_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'User is already a member of this organization.');
    END IF;

    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (target_org_id, target_user_id, target_role);

    RETURN json_build_object('success', true, 'message', 'Member added successfully.');
END;
$$;

-- 9.4 Remove Member (with last admin check)
CREATE OR REPLACE FUNCTION remove_org_member(target_user_id UUID, target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requester_role TEXT;
    target_member_role TEXT;
    admin_count INTEGER;
BEGIN
    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role IS NULL OR requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can remove members';
    END IF;

    SELECT role INTO target_member_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = target_user_id;

    IF target_member_role IS NULL THEN
        RAISE EXCEPTION 'Member not found in this organization';
    END IF;

    -- Prevent removing the last admin
    IF target_member_role = 'admin' THEN
        SELECT COUNT(*) INTO admin_count
        FROM organization_members
        WHERE org_id = target_org_id AND role = 'admin';

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot remove the last admin. Promote another member to admin first.';
        END IF;
    END IF;

    DELETE FROM organization_members
    WHERE org_id = target_org_id AND user_id = target_user_id;
END;
$$;

-- 9.5 Update Member Role (with last admin check + role validation)
CREATE OR REPLACE FUNCTION update_org_member_role(target_user_id UUID, target_org_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requester_role TEXT;
    current_role TEXT;
    admin_count INTEGER;
BEGIN
    -- Validate role enum FIRST
    IF new_role NOT IN ('admin', 'editor', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role. Must be admin, editor, or viewer.';
    END IF;

    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role IS NULL OR requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update roles';
    END IF;

    SELECT role INTO current_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = target_user_id;

    IF current_role IS NULL THEN
        RAISE EXCEPTION 'Member not found in this organization';
    END IF;

    -- Prevent demoting the last admin
    IF current_role = 'admin' AND new_role != 'admin' THEN
        SELECT COUNT(*) INTO admin_count
        FROM organization_members
        WHERE org_id = target_org_id AND role = 'admin';

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the last admin. Promote another member to admin first.';
        END IF;
    END IF;

    UPDATE organization_members
    SET role = new_role
    WHERE org_id = target_org_id AND user_id = target_user_id;
END;
$$;

-- =============================================
-- PART 10: DATA BACKFILL (Idempotent)
-- Ensures all existing users have a Personal Workspace
-- =============================================

DO $$
DECLARE
    user_record RECORD;
    new_org_id UUID;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        IF NOT EXISTS (
            SELECT 1 FROM organization_members WHERE user_id = user_record.id
        ) THEN
            INSERT INTO organizations (name, type)
            VALUES ('Personal Workspace', 'personal')
            RETURNING id INTO new_org_id;

            INSERT INTO organization_members (org_id, user_id, role)
            VALUES (new_org_id, user_record.id, 'admin');

            UPDATE lists
            SET organization_id = new_org_id
            WHERE user_id = user_record.id AND organization_id IS NULL;
        END IF;
    END LOOP;
END $$;
