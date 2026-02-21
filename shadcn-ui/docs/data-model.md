# Data Model

## Overview

Syntero uses PostgreSQL (via Supabase) with Row Level Security (RLS) for data isolation.

**Schema file**: [supabase_schema.sql](../supabase_schema.sql)

---

## Entity Relationship

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   activities    │      │     drivers     │      │      risks      │
│   (catalog)     │      │    (catalog)    │      │    (catalog)    │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │ via junction tables    │ via junction tables    │ via junction tables
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           estimations                                │
│  (id, requirement_id, user_id, total_days, base_days, ...)          │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ 1:N
         │
┌─────────────────────────────────────────────────────────────────────┐
│                           requirements                               │
│  (id, list_id, req_id, title, description, tech_preset_id, ...)     │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ 1:N
         │
┌─────────────────────────────────────────────────────────────────────┐
│                              lists                                   │
│  (id, user_id, name, description, tech_preset_id, status, ...)      │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ N:1
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         auth.users                                   │
│  (Supabase managed)                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Catalog Tables (Shared, Read-Only*)

### activities

Atomic work units with fixed effort.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique identifier (e.g., `PP_DV_FIELD`) |
| `name` | VARCHAR(255) | Human-readable name |
| `description` | TEXT | Detailed description for AI context |
| `base_hours` | DECIMAL(5,2) | Default effort in hours |
| `tech_category` | VARCHAR(50) | `POWER_PLATFORM`, `BACKEND`, `FRONTEND`, `MULTI` |
| `group` | VARCHAR(50) | `ANALYSIS`, `DEV`, `TEST`, `OPS`, `GOVERNANCE` |
| `active` | BOOLEAN | Visibility flag |
| `is_custom` | BOOLEAN | `false` = system, `true` = user-created |
| `base_activity_id` | UUID | Reference to forked system activity (nullable) |
| `created_by` | UUID | User who created custom activity |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small vector (Phase 2) |
| `embedding_updated_at` | TIMESTAMP | When embedding was last generated |

*Custom activities (`is_custom=true`) are editable by their creator.

**Vector Index**: `idx_activities_embedding` (ivfflat, cosine similarity)

### drivers

Complexity multipliers with selectable options.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique identifier (e.g., `COMPLEXITY`) |
| `name` | VARCHAR(255) | Human-readable name |
| `description` | TEXT | Explanation |
| `options` | JSONB | Array of `{value, label, multiplier}` |

**Options example**:
```json
[
  {"value": "LOW", "label": "Low", "multiplier": 0.8},
  {"value": "MEDIUM", "label": "Medium", "multiplier": 1.0},
  {"value": "HIGH", "label": "High", "multiplier": 1.5}
]
```

### risks

Binary risk flags with weights.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique identifier (e.g., `VAGUE_REQUIREMENTS`) |
| `name` | VARCHAR(255) | Human-readable name |
| `description` | TEXT | Explanation |
| `weight` | INTEGER | Contribution to risk score |

### technology_presets

Pre-configured technology stacks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique identifier |
| `name` | VARCHAR(255) | Display name (e.g., "Java Backend") |
| `description` | TEXT | Stack description |
| `tech_category` | VARCHAR(50) | Category for activity filtering |
| `default_activity_codes` | JSONB | Array of activity codes |
| `default_driver_values` | JSONB | `{DRIVER_CODE: "VALUE"}` |
| `default_risks` | JSONB | Array of risk codes |
| `is_custom` | BOOLEAN | System vs. user-created |
| `created_by` | UUID | User who created custom preset |

---

## User Data Tables (RLS Protected)

### lists

Project containers owned by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (FK to auth.users) |
| `name` | VARCHAR(255) | Project name |
| `description` | TEXT | Project description |
| `owner` | VARCHAR(255) | Business owner label |
| `tech_preset_id` | UUID | Default preset for requirements |
| `status` | VARCHAR(20) | `DRAFT`, `ACTIVE`, `ARCHIVED` |

### requirements

Individual requirements within a list.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `list_id` | UUID | Parent list (FK) |
| `req_id` | VARCHAR(100) | Custom ID (e.g., `HR-API-001`) |
| `title` | VARCHAR(500) | Requirement title |
| `description` | TEXT | Full description |
| `tech_preset_id` | UUID | Override preset (nullable) |
| `priority` | VARCHAR(20) | `HIGH`, `MEDIUM`, `LOW` |
| `state` | VARCHAR(20) | `PROPOSED`, `SELECTED`, `SCHEDULED`, `DONE` |
| `business_owner` | VARCHAR(255) | Stakeholder |
| `labels` | JSONB | Tag array |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small vector (Phase 4 RAG) |
| `embedding_updated_at` | TIMESTAMP | When embedding was last generated |

**Vector Index**: `idx_requirements_embedding` (ivfflat, cosine similarity)

### estimations

Saved calculation snapshots.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | Parent requirement (FK) |
| `user_id` | UUID | Creator (FK to auth.users) |
| `total_days` | DECIMAL(10,2) | Final estimate |
| `base_days` | DECIMAL(10,2) | Sum of activities / 8 |
| `driver_multiplier` | DECIMAL(5,3) | Product of multipliers |
| `risk_score` | INTEGER | Sum of risk weights |
| `contingency_percent` | DECIMAL(5,2) | Applied contingency |
| `scenario_name` | VARCHAR(255) | User-defined label (e.g., "Optimistic") |

---

## Junction Tables

### estimation_activities

| Column | Type | Description |
|--------|------|-------------|
| `estimation_id` | UUID | FK to estimations |
| `activity_id` | UUID | FK to activities |
| `is_ai_suggested` | BOOLEAN | Was this suggested by AI? |
| `notes` | TEXT | User notes |

### estimation_drivers

| Column | Type | Description |
|--------|------|-------------|
| `estimation_id` | UUID | FK to estimations |
| `driver_id` | UUID | FK to drivers |
| `selected_value` | VARCHAR(50) | e.g., "MEDIUM", "HIGH" |

### estimation_risks

| Column | Type | Description |
|--------|------|-------------|
| `estimation_id` | UUID | FK to estimations |
| `risk_id` | UUID | FK to risks |

### technology_preset_activities

Links activities to technology presets with optional per-technology overrides. 
This allows customizing activity names, descriptions, and effort estimates for each technology 
without modifying the base activity catalog.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tech_preset_id` | UUID | FK to technology_presets |
| `activity_id` | UUID | FK to activities |
| `position` | INTEGER | Display order within preset |
| `name_override` | VARCHAR(255) | Custom name for this preset (null = use base) |
| `description_override` | TEXT | Custom description (null = use base) |
| `base_hours_override` | DECIMAL(5,2) | Custom hours (null = use base) |

**Override Behavior**:
- When override columns are `NULL`, the base activity values are used.
- When a preset is edited, overrides are saved to the pivot table, not the activity catalog.
- This ensures activities can be customized independently per technology.

**Migration**: [20260220_activity_overrides.sql](../supabase/migrations/20260220_activity_overrides.sql)

---

## Row Level Security (RLS)

### Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `activities` | System + own custom | Own custom only | Own custom only | — |
| `drivers` | Public | — | — | — |
| `risks` | Public | — | — | — |
| `technology_presets` | System + own custom | Own only | Own only | Own only |
| `lists` | Own only | Own only | Own only | Own only |
| `requirements` | Via list ownership | Via list ownership | Via list ownership | Via list ownership |
| `estimations` | Via requirement ownership | Via requirement ownership | — | — |

### Example Policy

```sql
CREATE POLICY "Users can view their own lists" ON lists
    FOR SELECT USING (auth.uid() = user_id);
```

---

## Atomic Estimation Save

Estimations are saved via an RPC to ensure transactional integrity:

**File**: [supabase_save_estimation_rpc.sql](../supabase_save_estimation_rpc.sql)

```sql
CREATE OR REPLACE FUNCTION save_estimation_atomic(
  p_requirement_id UUID,
  p_total_days DECIMAL,
  p_base_days DECIMAL,
  p_driver_multiplier DECIMAL,
  p_risk_score INTEGER,
  p_contingency_percent DECIMAL,
  p_scenario_name VARCHAR,
  p_activities JSONB,
  p_drivers JSONB,
  p_risks JSONB
) RETURNS UUID AS $$
DECLARE
  v_estimation_id UUID;
BEGIN
  -- Insert estimation
  INSERT INTO estimations (...) VALUES (...) RETURNING id INTO v_estimation_id;
  
  -- Insert activities
  INSERT INTO estimation_activities (...) SELECT ...;
  
  -- Insert drivers
  INSERT INTO estimation_drivers (...) SELECT ...;
  
  -- Insert risks
  INSERT INTO estimation_risks (...) SELECT ...;
  
  RETURN v_estimation_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Indexes

Key indexes for performance:

```sql
CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_requirements_list_id ON requirements(list_id);
CREATE INDEX idx_estimations_requirement_id ON estimations(requirement_id);
CREATE INDEX idx_activities_tech_category ON activities(tech_category);
CREATE INDEX idx_activities_is_custom ON activities(is_custom);

-- Vector indexes for semantic search (Phase 2)
CREATE INDEX idx_activities_embedding ON activities USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_requirements_embedding ON requirements USING ivfflat (embedding vector_cosine_ops);
```

---

## Vector Search Functions (pgvector)

Added in migration `20260221_pgvector_embeddings.sql`.

### search_similar_activities

Top-K retrieval for activity suggestions based on requirement description.

```sql
search_similar_activities(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 30,
    tech_categories text[] DEFAULT ARRAY['MULTI']
) RETURNS TABLE (
    id uuid, code varchar, name varchar, description text,
    base_hours decimal, tech_category varchar, "group" varchar,
    similarity float
)
```

**Usage**: Called by `ai-suggest` and `ai-generate-preset` for semantic activity matching.

### search_similar_requirements

RAG search to find similar past requirements for few-shot learning.

```sql
search_similar_requirements(
    query_embedding vector(1536),
    user_id_filter uuid DEFAULT NULL,
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5
) RETURNS TABLE (
    id uuid, req_id varchar, title varchar, description text,
    similarity float
)
```

**Usage**: Called by RAG module to enrich prompts with historical examples.

### find_duplicate_activities

Deduplication check for new custom activities.

```sql
find_duplicate_activities(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.8
) RETURNS TABLE (
    id uuid, code varchar, name varchar, description text,
    similarity float
)
```

**Usage**: Called by `ai-check-duplicates` to prevent catalog bloat.

---

## Maintenance Notes

- **Schema changes**: Run migration SQL in Supabase SQL Editor.
- **Seed data**: [supabase_seed.sql](../supabase_seed.sql) contains initial activities, drivers, risks, presets.
- **History optimizations**: [estimation_history_optimizations.sql](../estimation_history_optimizations.sql) adds helper views.
- **Vector embeddings**: Run `ai-generate-embeddings` endpoint after migration to populate embedding columns.

---

**Update this document when**:
- Adding new tables or columns
- Modifying RLS policies
- Changing relationships between entities
- Adding new vector search functions
