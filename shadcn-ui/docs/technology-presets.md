# Technology Presets

> **Last Updated**: 2026-03-22

## Purpose

Technologies are configuration entities that control which activities are available during estimation. Each technology represents a distinct stack (Power Platform, Backend, Frontend) and determines the candidate activity pool via FK relationship.

> **Historical note**: Before migration `20260228`, these were called `technology_presets` and carried `default_activity_codes`, `default_driver_values`, and `default_risks` columns. Those template fields have been removed — AI now generates activity selections dynamically rather than relying on preset defaults.

---

## Schema

### `technologies` table

```sql
CREATE TABLE technologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tech_category VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_custom BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(code, created_by)
);
```

### `technology_activities` junction table

Links technologies to their candidate activities with optional overrides:

```sql
CREATE TABLE technology_activities (
    technology_id UUID NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id),
    position INTEGER,
    name_override VARCHAR(255),
    description_override TEXT,
    base_hours_override DECIMAL(5,2),
    UNIQUE (technology_id, activity_id)
);
```

| Column | Purpose |
|--------|---------|
| `position` | Display order (lower = higher priority) |
| `name_override` | Custom name for this activity within this technology |
| `description_override` | Custom description for this activity within this technology |
| `base_hours_override` | Override base hours for this technology context |

### `activities.technology_id` FK

Activities have a canonical FK to `technologies.id`:

```typescript
export interface Activity {
  technology_id: string | null;  // Canonical FK — preferred
  tech_category: string;         // @deprecated — legacy fallback only
  // ...
}
```

---

## System Technologies

Four system technologies are defined (migration `20260228` + `20260301`):

| Code | Name | Description | `tech_category` |
|------|------|-------------|-----------------|
| `POWER_PLATFORM` | Power Platform | Microsoft Power Platform: Power Apps, Power Automate, Dataverse | `POWER_PLATFORM` |
| `BACKEND` | Backend | Backend API development: REST/GraphQL endpoints, database, business logic | `BACKEND` |
| `FRONTEND` | Frontend | Frontend development: React/Angular/Vue components, SPA, responsive UI | `FRONTEND` |
| `MULTI` | Multi-stack | Cross-cutting or full-stack activities | `MULTI` |

System technologies have `is_custom = false` and `created_by = NULL`.

---

## How Technologies Affect Estimation

### 1. Activity Filtering (Canonical FK Path)

When a technology is selected in the wizard, the server filters activities by `technology_id` FK:

```typescript
// netlify/functions/lib/activities.ts — fetchActivitiesByTechnologyId
const { data } = await supabase
    .from('activities')
    .select('code, name, description, base_hours, group, tech_category, technology_id')
    .eq('active', true)
    .or(`technology_id.eq.${technologyId},technology_id.eq.${multiTechId}`);
```

**Key behaviors:**
- Activities matching the selected technology's `id` are included
- Activities with `technology_id = MULTI` are always included (cross-cutting)
- No activities are pre-selected — user chooses manually or via AI suggestion
- Emergency rollback: set `FORCE_LEGACY_ACTIVITY_FETCH=true` to revert to `tech_category` string matching

### 2. AI Suggestions

AI receives only the filtered activity pool, ensuring suggestions are relevant to the selected technology stack.

### 3. Wizard Flow

Technology is automatically inherited from the project (`projects.technology_id`) when a new requirement is created. The wizard no longer includes a manual technology selection step — `RequirementWizard.tsx` resolves the project's `defaultTechPresetId` via `fetchTechnology()` and sets `techPresetId` + `techCategory` in wizard state on mount.

This `techPresetId` flows forward to all subsequent steps and AI endpoints.

---

## Custom Technologies

### Manual Creation

Authenticated users create custom technologies via `/configuration/presets`:

1. Open Configuration → Technologies
2. Click "Create New"
3. Configure name, description, technology category
4. Select activities from the catalog (via `technology_activities` junction)
5. Save — stored with `is_custom = true`, `created_by = auth.uid()`

**Components**: `ConfigurationPresets.tsx` → `TechnologyDialog.tsx` → `usePresetManagement.ts`

### AI-Assisted Creation (Two-Stage Wizard)

Users can generate custom technologies via an AI wizard:

| Stage | Endpoint | Purpose |
|-------|----------|---------|
| 1 | `POST /ai-generate-questions` | AI generates context-aware questions from a technology description |
| 2 | `POST /ai-generate-preset` | AI generates a complete technology (activities, drivers, risks) from description + answers |

**Key characteristics:**
- AI can select activities from the existing catalog OR create new ones (`isNew: true` flag)
- Generated activities include custom titles and descriptions
- User reviews and confirms before saving
- Pipeline includes validation pass and retry-with-feedback for quality

**Components**: `TechnologyDialog.tsx` → `AiAssistPanel.tsx` → `ai-preset-api.ts`

### Ownership

| Technology Type | `created_by` | Visibility | Editable |
|-----------------|--------------|------------|----------|
| System | `NULL` | All authenticated users | No |
| Custom | User UUID | Creator only | Yes (update + delete) |

---

## RLS Policies

```sql
-- READ: All authenticated users can view all technologies
CREATE POLICY "Anyone can view technologies" ON technologies
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: Only custom technologies
CREATE POLICY "Users can insert custom technologies" ON technologies
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    );

-- UPDATE: Only own custom technologies
CREATE POLICY "Users can update their own custom technologies" ON technologies
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    );

-- DELETE: Only own custom technologies
CREATE POLICY "Users can delete their own custom technologies" ON technologies
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND is_custom = TRUE AND created_by = auth.uid()
    );

-- Junction table: view all, manage only for own custom technologies
CREATE POLICY "Anyone can view technology activities" ON technology_activities
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage activities for custom technologies" ON technology_activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM technologies
            WHERE technologies.id = technology_activities.technology_id
            AND technologies.is_custom = TRUE
            AND technologies.created_by = auth.uid()
        )
    );
```

---

## TypeScript Interface

```typescript
// src/types/database.ts
export interface Technology {
  id: string;
  code: string;
  name: string;
  description: string;
  tech_category: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  is_custom?: boolean;
  created_by?: string | null;
}

export interface TechnologyActivity {
  technology_id: string;
  activity_id: string;
  position: number | null;
  name_override: string | null;
  description_override: string | null;
  base_hours_override: number | null;
}
```

> **Deprecated alias**: `TechnologyPreset` still exists as `Technology & { default_driver_values, default_risks, default_activity_codes }` for backward compatibility but should not be used in new code.

---

## File References

| File | Purpose |
|------|---------|
| `src/types/database.ts` | `Technology` and `TechnologyActivity` interfaces |
| `src/components/requirements/RequirementWizard.tsx` | Technology inheritance from project |
| `src/pages/configuration/ConfigurationPresets.tsx` | Technology management page |
| `src/components/configuration/presets/TechnologyDialog.tsx` | Create/edit technology dialog |
| `src/hooks/usePresetManagement.ts` | Technology CRUD hooks |
| `netlify/functions/lib/activities.ts` | Server-side activity filtering by `technology_id` FK |
| `netlify/functions/ai-generate-questions.ts` | Stage 1: AI interview for preset creation |
| `netlify/functions/ai-generate-preset.ts` | Stage 2: AI preset generation |
| `supabase/migrations/20260228_simplify_presets_to_technologies.sql` | Schema migration from presets to technologies |
| `supabase/migrations/20260301_canonical_technology_model.sql` | `technology_id` FK on activities |
