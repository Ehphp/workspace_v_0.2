# Multi-tenancy & Governance Architecture

## 1. Overview

The application has been refactored from a single-user model to a **Multi-tenant** architecture with **Governance** controls. This allows users to:
1.  Have a private **Personal Workspace**.
2.  Belong to multiple **Team Organizations**.
3.  Manage project lifecycles with **Draft/Review/Locked** states.
4.  Enforce role-based access control (Admin, Editor, Viewer).

## 2. Data Model

### Organizations (`organizations`)
- **id**: UUID (PK)
- **name**: String
- **type**: Enum (`personal`, `team`)
- **created_at**: Timestamp

### Memberships (`organization_members`)
- **org_id**: FK to organizations
- **user_id**: FK to auth.users
- **role**: Enum (`admin`, `editor`, `viewer`)
- *Constraint*: Unique pair (org_id, user_id)

### Lists (Projects) Updates
- **organization_id**: FK to organizations (Replaces `user_id` as the ownership field).
- **user_id**: Retained as "Created By" audit field.
- **status**: Enum (`DRAFT`, `REVIEW`, `LOCKED`).
- **locked_at** / **locked_by**: Audit fields for governance.

## 3. Security & RLS (Row Level Security)

Security is enforced at the database layer via PostgreSQL RLS policies.

### Access Hierarchy
1.  **Organization Level**: Users can only see organizations they are a member of.
2.  **Project Level**: Users can only see lists belonging to their organizations.
3.  **Resource Level**: Requirements and Estimations inherit access from their parent List.

### Governance Rules
| Role | View | Create/Edit | Delete | Lock/Unlock |
|------|------|-------------|--------|-------------|
| **Viewer** | ✅ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ (If not Locked) | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ |

**Critical Rule**: If a list is `LOCKED`, even Editors cannot modify requirements or estimations. Only Admins can unlock the list to allow changes.

## 4. Frontend Architecture

### Authentication Store (`useAuthStore`)
Replaces direct `useAuth` usage for organization context.
- **State**: `organizations`, `currentOrganization`, `userRole`.
- **Persistence**: `currentOrganization` ID is saved to `localStorage`.
- **Sync**: Automatically fetches organizations upon login.

### Components
- **`OrganizationSwitcher`**: Dropdown in the header to switch contexts.
- **`LockBanner`**: Visual indicator when a project is read-only.
- **`AuthGuard`**: Ensures user is logged in and auth store is hydrated.

## 5. Testing & Validation Guide

### Test Scenario 1: New User Onboarding
1.  **Action**: Register a new account via `/register`.
2.  **Expected Result**:
    - User is redirected to Dashboard.
    - "Personal Workspace" is automatically selected in the header.
    - User is an `admin` of this workspace.

### Test Scenario 2: Organization Switching
1.  **Prerequisite**: Manually insert a second organization and membership in DB (until UI for creating teams is built).
    ```sql
    -- Run in Supabase SQL Editor
    WITH new_org AS (
      INSERT INTO organizations (name, type) VALUES ('Acme Corp', 'team') RETURNING id
    )
    INSERT INTO organization_members (org_id, user_id, role)
    SELECT id, 'YOUR_USER_ID', 'editor' FROM new_org;
    ```
2.  **Action**: Refresh page and use the Organization Switcher.
3.  **Expected Result**:
    - Dropdown shows "Acme Corp".
    - Selecting it clears the dashboard (shows 0 projects).
    - Creating a project here assigns it to "Acme Corp".

### Test Scenario 3: Governance Locking
1.  **Action**: Create a project. Add a requirement.
2.  **Action (DB)**: Manually lock the project.
    ```sql
    UPDATE lists SET status = 'LOCKED' WHERE name = 'My Project';
    ```
3.  **Expected Result**:
    - Refresh the project page.
    - A red "Project is Locked" banner appears.
    - Edit buttons should either be disabled or fail upon save (RLS error).

### Test Scenario 4: RLS Isolation
1.  **Action**: Create a project in "Personal Workspace".
2.  **Action**: Switch to "Acme Corp" (if created in Test 2).
3.  **Expected Result**: The project from Personal Workspace must NOT be visible.

## 6. Future Implementation (Phase 3)
- UI for creating Team Organizations.
- UI for inviting members (email invitations).
- Settings page to manage members and roles.
- UI toggle for Locking/Unlocking projects (for Admins).
