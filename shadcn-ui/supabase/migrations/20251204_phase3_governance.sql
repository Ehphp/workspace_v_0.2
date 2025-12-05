-- 1. RPC to Create a Team Organization
CREATE OR REPLACE FUNCTION create_team_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create Organization
    INSERT INTO organizations (name, type)
    VALUES (org_name, 'team')
    RETURNING id INTO new_org_id;

    -- Add Creator as Admin
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, auth.uid(), 'admin');

    RETURN new_org_id;
END;
$$;

-- 2. RPC to Add Member by Email (Only for existing users)
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
    -- Check if requester is Admin of the org
    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can add members';
    END IF;

    -- Find user by email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if already member
    IF EXISTS (SELECT 1 FROM organization_members WHERE org_id = target_org_id AND user_id = target_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'User is already a member');
    END IF;

    -- Add Member
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (target_org_id, target_user_id, target_role);

    RETURN json_build_object('success', true, 'message', 'Member added successfully');
END;
$$;

-- 3. RPC to Get Organization Members with Emails
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
    -- Check if requester is a member of the org
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

-- 4. RPC to Remove Member
CREATE OR REPLACE FUNCTION remove_org_member(target_user_id UUID, target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requester_role TEXT;
BEGIN
    -- Check if requester is Admin
    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can remove members';
    END IF;

    -- Prevent removing yourself if you are the last admin (optional safety, but good practice)
    -- For MVP, just allow removal.
    
    DELETE FROM organization_members
    WHERE org_id = target_org_id AND user_id = target_user_id;
END;
$$;

-- 5. RPC to Update Member Role
CREATE OR REPLACE FUNCTION update_org_member_role(target_user_id UUID, target_org_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requester_role TEXT;
BEGIN
    -- Check if requester is Admin
    SELECT role INTO requester_role
    FROM organization_members
    WHERE org_id = target_org_id AND user_id = auth.uid();

    IF requester_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update roles';
    END IF;

    UPDATE organization_members
    SET role = new_role
    WHERE org_id = target_org_id AND user_id = target_user_id;
END;
$$;
