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
│  (id, list_id, req_id, title, description, technology_id, ...)     │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ 1:N
         │
┌─────────────────────────────────────────────────────────────────────┐
│                              lists                                   │
│  (id, user_id, name, description, technology_id, status, ...)      │
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

### technologies

Technology stacks. After simplification (migration `20260228`), template fields (`default_activity_codes`, `default_driver_values`, `default_risks`) have been removed. Activity suggestions are now fully AI-driven.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique identifier |
| `name` | VARCHAR(255) | Display name (e.g., "Backend") |
| `description` | TEXT | Stack description |
| `tech_category` | VARCHAR(50) | Category for activity filtering |
| `color` | VARCHAR(50) | UI color |
| `icon` | VARCHAR(50) | UI icon name |
| `sort_order` | INTEGER | Display order |
| `is_custom` | BOOLEAN | System vs. user-created |
| `created_by` | UUID | User who created custom technology |

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
| `technology_id` | UUID | Default technology for requirements |
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
| `technology_id` | UUID | Override technology (nullable) |
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
| `senior_consultant_analysis` | JSONB | AI consultant analysis (tips, discrepancies, risks) |
| `ai_reasoning` | TEXT | AI explanation for estimation decisions |

---

## Junction Tables

### estimation_activities

| Column | Type | Description |
|--------|------|-------------|
| `estimation_id` | UUID | FK to estimations |
| `activity_id` | UUID | FK to activities |
| `is_ai_suggested` | BOOLEAN | Was this suggested by AI? |
| `notes` | TEXT | User notes |

**Trigger**: `trg_enforce_estimation_activity_category` — fires BEFORE INSERT, calls `enforce_estimation_activity_category()`. Validates that the inserted activity's `tech_category` matches the technology assigned to the requirement (via `estimations → requirements → technologies`). Fixed in migration `20260228_fix_estimation_activity_trigger.sql` to use the renamed `technologies` table and `technology_id` column.

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

### consultant_analyses

Stores each Senior Consultant AI analysis run with full context snapshots.
Each row captures the analysis result plus the exact state of the requirement
and estimation at the time, enabling full traceability and history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | FK to requirements |
| `estimation_id` | UUID | FK to estimations (nullable, SET NULL on delete) |
| `user_id` | UUID | FK to auth.users |
| `analysis` | JSONB | Full `SeniorConsultantAnalysis` result |
| `requirement_snapshot` | JSONB | Requirement state at analysis time (title, description, priority, state, technology) |
| `estimation_snapshot` | JSONB | Estimation state at analysis time (total_days, base_hours, activities, drivers, etc.) |
| `created_at` | TIMESTAMP | When the analysis was generated |

**Snapshot Contents**:
- `requirement_snapshot`: `{title, description, priority, state, technology_id, technology_name}`
- `estimation_snapshot`: `{estimation_id, total_days, base_hours, driver_multiplier, risk_score, contingency_percent, scenario_name, activities: [{code, name, base_hours, group}], drivers: [{code, name, selected_value, multiplier}]}`

**RLS**: Users can read/insert analyses for requirements they own (via list ownership).

**Migration**: [20260301_consultant_analysis_history.sql](../supabase/migrations/20260301_consultant_analysis_history.sql)

---

### technology_activities

Links activities to technologies with optional per-technology overrides. 
This allows customizing activity names, descriptions, and effort estimates for each technology 
without modifying the base activity catalog.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `technology_id` | UUID | FK to technologies |
| `activity_id` | UUID | FK to activities |
| `position` | INTEGER | Display order within technology |
| `name_override` | VARCHAR(255) | Custom name for this technology (null = use base) |
| `description_override` | TEXT | Custom description (null = use base) |
| `base_hours_override` | DECIMAL(5,2) | Custom hours (null = use base) |

**Override Behavior**:
- When override columns are `NULL`, the base activity values are used.
- When a technology is edited, overrides are saved to the pivot table, not the activity catalog.
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
| `technologies` | System + own custom | Own only | Own only | Own only |
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
  p_risks JSONB,
  p_ai_reasoning TEXT DEFAULT NULL,
  p_senior_consultant_analysis JSONB DEFAULT NULL
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

## Phase 3: Agentic Pipeline Tables

**Migration**: `supabase/migrations/20260301_consultant_analysis_history.sql`

### consultant_analyses

Stores Senior Consultant AI analysis runs with full context snapshots for traceability.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | FK → requirements (CASCADE) |
| `estimation_id` | UUID | FK → estimations (SET NULL) |
| `user_id` | UUID | FK → auth.users |
| `analysis` | JSONB | Full SeniorConsultantAnalysis result |
| `requirement_snapshot` | JSONB | {title, description, priority, state, technology_id, technology_name} |
| `estimation_snapshot` | JSONB | {total_days, base_hours, driver_multiplier, risk_score, activities, drivers} |
| `created_at` | TIMESTAMPTZ | Auto-set |

**RLS**: Users can read analyses for requirements in lists they own. Insert requires `user_id = auth.uid()`.

### agent_execution_log

Full execution trace of each agentic estimation pipeline run.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `execution_id` | TEXT | Unique agent execution ID |
| `requirement_id` | UUID | FK → requirements (nullable) |
| `user_id` | UUID | FK → auth.users (nullable) |
| `input_description` | TEXT | Sanitized requirement description |
| `input_tech_category` | TEXT | Technology category |
| `success` | BOOLEAN | Pipeline success status |
| `generated_title` | TEXT | AI-generated title |
| `activity_count` | INTEGER | Number of selected activities |
| `total_base_days` | NUMERIC(8,2) | Calculated base days |
| `confidence_score` | NUMERIC(4,2) | AI confidence 0-1 |
| `model` | TEXT | LLM model used |
| `iterations` | INTEGER | Reflection loop iterations |
| `tool_call_count` | INTEGER | Number of tool calls |
| `total_duration_ms` | INTEGER | Total pipeline duration |
| `execution_trace` | JSONB | {transitions, toolCalls, flags} |
| `reflection_result` | JSONB | {assessment, confidence, issues, correctionPrompt} |
| `engine_validation` | JSONB | {baseDays, driverMultiplier, subtotal, totalDays} |
| `error_message` | TEXT | Error details (if failed) |
| `created_at` | TIMESTAMPTZ | Auto-set |

**RLS**: Users can view/insert their own executions and anonymous (Quick Estimate) sessions.

**Indexes**: requirement_id, user_id, success status, failures (partial).

---

## Maintenance Notes

- **Schema changes**: Run migration SQL in Supabase SQL Editor.
- **Seed data**: [supabase_seed.sql](../supabase_seed.sql) contains initial activities, drivers, risks, technologies.
- **History optimizations**: [estimation_history_optimizations.sql](../estimation_history_optimizations.sql) adds helper views.
- **Vector embeddings**: Run `ai-generate-embeddings` endpoint after migration to populate embedding columns.
- **Trigger fix (2026-02-28)**: `enforce_estimation_activity_category()` was updated to reference `technologies` (not the old `technology_presets`) and join through `requirements.technology_id`. Migration: `20260228_fix_estimation_activity_trigger.sql`.
- **Agentic tables (2026-03-01)**: `consultant_analyses` and `agent_execution_log` added for Phase 3 agentic pipeline. Migration: `20260301_consultant_analysis_history.sql`.

---

**Update this document when**:
- Adding new tables or columns
- Modifying RLS policies
- Changing relationships between entities
- Adding new vector search functions
