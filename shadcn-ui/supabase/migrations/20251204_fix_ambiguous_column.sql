-- Fix for "column reference user_id is ambiguous" error
-- We need to explicitly alias the table in the EXISTS check because 'user_id' is also an output parameter name.

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
    -- Fixed: Added alias 'om_check' and used 'om_check.user_id' to distinguish from output parameter 'user_id'
    IF NOT EXISTS (
        SELECT 1 FROM organization_members om_check
        WHERE om_check.org_id = target_org_id AND om_check.user_id = auth.uid()
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
