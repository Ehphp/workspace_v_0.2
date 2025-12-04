-- 1. Fix RLS Policy for Organization Members (Avoid Recursion)
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        -- Explicitly allow seeing your own membership rows
        user_id = auth.uid()
        OR
        -- Allow seeing other members in your orgs (using Security Definer function to bypass recursion)
        org_id = ANY(get_user_org_ids())
    );

-- 2. Ensure Data Backfill (Idempotent Run)
-- This will ensure you have a Personal Organization if the previous run failed
DO $$
DECLARE
    user_record RECORD;
    new_org_id UUID;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        -- Check if user has ANY organization membership
        IF NOT EXISTS (
            SELECT 1 FROM organization_members WHERE user_id = user_record.id
        ) THEN
            -- Create Personal Org
            INSERT INTO organizations (name, type)
            VALUES ('Personal Workspace', 'personal')
            RETURNING id INTO new_org_id;

            -- Add User as Admin
            INSERT INTO organization_members (org_id, user_id, role)
            VALUES (new_org_id, user_record.id, 'admin');

            -- Update existing lists for this user
            UPDATE lists
            SET organization_id = new_org_id
            WHERE user_id = user_record.id AND organization_id IS NULL;
        END IF;
    END LOOP;
END $$;
