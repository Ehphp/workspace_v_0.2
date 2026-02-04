# Technology Presets

## Purpose

Technology presets are pre-configured templates that accelerate estimation by:
- Filtering activities to a specific technology stack
- Setting default driver values
- Pre-selecting common risks

---

## Preset Structure

| Field | Description |
|-------|-------------|
| `code` | Unique identifier (e.g., `POWER_PLATFORM`) |
| `name` | Display name (e.g., "Power Platform") |
| `description` | Technology stack description |
| `tech_category` | Category for activity filtering |
| `default_activity_codes` | Activities to pre-select |
| `default_driver_values` | Default driver settings |
| `default_risks` | Risks to pre-select |

---

## System Presets

Defined in [supabase_seed.sql](../supabase_seed.sql):

| Preset | tech_category | Description |
|--------|---------------|-------------|
| Power Platform | `POWER_PLATFORM` | Microsoft Power Apps, Power Automate, Dataverse |
| Backend API | `BACKEND` | REST APIs, database, backend services |
| Frontend React | `FRONTEND` | React web applications |
| Multi-stack | `MULTI` | Full-stack projects spanning multiple technologies |

---

## How Presets Affect Estimation

### 1. Activity Filtering

When a preset is selected, only activities matching the preset's `tech_category` are shown:

```typescript
const relevantActivities = activities.filter(
  a => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
);
```

Activities with `tech_category = 'MULTI'` are always included (e.g., meetings, documentation).

### 2. AI Suggestions

AI receives only filtered activities, ensuring suggestions are relevant to the technology stack.

### 3. Default Selections

When the user starts a new estimation:
- `default_activity_codes` are pre-checked
- `default_driver_values` populate driver dropdowns
- `default_risks` are pre-selected

The user can modify all of these before saving.

---

## Custom Presets

Authenticated users can create custom presets:

### Creating a Custom Preset

1. Navigate to `/presets` or `/configuration/presets`
2. Click "Create New Preset"
3. Configure:
   - Name and description
   - Technology category
   - Default activities (select from catalog)
   - Default driver values
   - Default risks

### Preset Ownership

| Preset Type | `created_by` | Visibility | Editable |
|-------------|--------------|------------|----------|
| System | `NULL` | All users | No |
| Custom | User UUID | Creator only | Yes |

### RLS Policy

```sql
CREATE POLICY "Users can view system and own presets" ON technology_presets
    FOR SELECT USING (created_by IS NULL OR created_by = auth.uid());

CREATE POLICY "Users can update own presets" ON technology_presets
    FOR UPDATE USING (created_by = auth.uid());
```

---

## Preset-Activity Relationship

The `technology_preset_activities` table links presets to activities with ordering:

| Column | Description |
|--------|-------------|
| `tech_preset_id` | FK to technology_presets |
| `activity_id` | FK to activities |
| `position` | Display order (lower = higher priority) |

This allows custom presets to define which activities appear first in the UI.

---

## Database Schema

```sql
CREATE TABLE technology_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tech_category VARCHAR(50) NOT NULL,
    default_driver_values JSONB,
    default_risks JSONB,
    default_activity_codes JSONB,
    is_custom BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(code, created_by)
);
```

---

## Example Preset Data

```json
{
  "code": "BACKEND_API",
  "name": "Backend API",
  "description": "REST APIs, database, backend services",
  "tech_category": "BACKEND",
  "default_activity_codes": [
    "BE_API_DESIGN",
    "BE_DB_SCHEMA",
    "BE_IMPL",
    "BE_UNIT_TEST"
  ],
  "default_driver_values": {
    "COMPLEXITY": "MEDIUM",
    "INTEGRATION": "LOW"
  },
  "default_risks": [
    "VAGUE_REQUIREMENTS"
  ]
}
```

---

## Maintenance

### Adding a New System Preset

1. Add to [supabase_seed.sql](../supabase_seed.sql)
2. Run SQL in production
3. No code changes needed

### Adding Activities to a Preset

1. Insert into `technology_preset_activities`:
   ```sql
   INSERT INTO technology_preset_activities 
     (tech_preset_id, activity_id, position)
   VALUES 
     ('<preset-uuid>', '<activity-uuid>', 1);
   ```

### Deprecating a Preset

Set `active = false` (if column exists) or remove from seed. Existing estimations using the preset remain valid.

---

## Tech Categories

| Category | Description | Used By |
|----------|-------------|---------|
| `POWER_PLATFORM` | Microsoft Power Platform | Power Platform preset |
| `BACKEND` | Server-side development | Backend API preset |
| `FRONTEND` | Client-side development | Frontend React preset |
| `MULTI` | Cross-cutting concerns | Multi-stack preset, shared activities |

---

**Update this document when**:
- Adding new system presets
- Changing preset structure
- Modifying how presets affect estimation flow
