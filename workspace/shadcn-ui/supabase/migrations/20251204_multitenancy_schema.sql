-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure type column exists (safe for re-runs)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'personal' CHECK (type IN ('personal', 'team'));

-- Remove unique constraint on name if it exists (allows multiple 'Personal Workspace' entries)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_name_key;

-- 2. Create Organization Members Table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- 3. Helper Function for RLS
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT array_agg(org_id)
    FROM organization_members
    WHERE user_id = auth.uid();
$$;

-- 4. Modify Lists Table
ALTER TABLE lists
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'LOCKED')),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);

-- 5. Migration Block (Backfill)
DO $$
DECLARE
    user_record RECORD;
    new_org_id UUID;
BEGIN
    FOR user_record IN SELECT id, email FROM auth.users LOOP
        -- Check if user already has a personal org (optional, but good for idempotency)
        -- For simplicity in this script, we assume we need to create one if not exists in organization_members
        IF NOT EXISTS (
            SELECT 1 FROM organization_members om
            JOIN organizations o ON o.id = om.org_id
            WHERE om.user_id = user_record.id AND o.type = 'personal'
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

-- Make organization_id NOT NULL after backfill
ALTER TABLE lists ALTER COLUMN organization_id SET NOT NULL;

-- 6. Trigger for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create Personal Org
    INSERT INTO public.organizations (name, type)
    VALUES ('Personal Workspace', 'personal')
    RETURNING id INTO new_org_id;

    -- Add User as Admin
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'admin');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication during re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_lists_org_id ON lists(organization_id);
