-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on lists (and others if they conflict, but mostly lists needs update)
DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;

-- Organizations Policies
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    );

-- Organization Members Policies
CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    );

-- Lists Policies (The Core Governance)

-- READ: Users can see lists in their orgs
CREATE POLICY "Users can view lists in their orgs" ON lists
    FOR SELECT USING (
        organization_id = ANY(get_user_org_ids())
    );

-- INSERT: Only Admins and Editors can create lists
CREATE POLICY "Admins and Editors can create lists" ON lists
    FOR INSERT WITH CHECK (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = lists.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

-- UPDATE: Admins/Editors can update if NOT LOCKED (unless unlocking or admin locking)
CREATE POLICY "Admins and Editors can update lists" ON lists
    FOR UPDATE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = lists.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    )
    WITH CHECK (
        -- Prevent Editors from modifying locked lists
        (
            status != 'LOCKED' OR
            EXISTS (
                SELECT 1 FROM organization_members
                WHERE org_id = lists.organization_id
                AND user_id = auth.uid()
                AND role = 'admin'
            )
        )
    );

-- DELETE: Only Admins can delete
CREATE POLICY "Only Admins can delete lists" ON lists
    FOR DELETE USING (
        organization_id = ANY(get_user_org_ids()) AND
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE org_id = lists.organization_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Requirements Policies (Cascading Governance)

-- Drop old policies
DROP POLICY IF EXISTS "Users can view requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can insert requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can update requirements in their lists" ON requirements;
DROP POLICY IF EXISTS "Users can delete requirements in their lists" ON requirements;

-- READ
CREATE POLICY "Users can view requirements in their orgs" ON requirements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lists
            WHERE lists.id = requirements.list_id
            AND lists.organization_id = ANY(get_user_org_ids())
        )
    );

-- INSERT (Blocked if Locked)
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

-- UPDATE (Blocked if Locked)
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

-- DELETE (Blocked if Locked)
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

-- Estimations Policies (Cascading Governance)

-- Drop old policies
DROP POLICY IF EXISTS "Users can view estimations for their requirements" ON estimations;
DROP POLICY IF EXISTS "Users can insert estimations for their requirements" ON estimations;

-- READ
CREATE POLICY "Users can view estimations in their orgs" ON estimations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = estimations.requirement_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

-- INSERT (Blocked if Locked)
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

-- Requirement Driver Values Policies (Cascading Governance)

-- Drop old policies
DROP POLICY IF EXISTS "Users can view requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can upsert requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can update requirement driver values" ON requirement_driver_values;
DROP POLICY IF EXISTS "Users can delete requirement driver values" ON requirement_driver_values;

-- READ
CREATE POLICY "Users can view requirement driver values in their orgs" ON requirement_driver_values
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = requirement_driver_values.requirement_id
            AND l.organization_id = ANY(get_user_org_ids())
        )
    );

-- INSERT (Blocked if Locked)
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

-- UPDATE (Blocked if Locked)
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

-- DELETE (Blocked if Locked)
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
