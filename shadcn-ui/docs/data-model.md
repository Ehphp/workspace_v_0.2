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
| `technology_id` | UUID | **Canonical FK** to `technologies.id` (preferred) |
| `tech_category` | VARCHAR(50) | **@deprecated** — kept in sync by `trg_sync_activity_tech_category`. Use `technology_id` instead. |
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
| `tech_category` | VARCHAR(50) | **@deprecated** Legacy alias — matches `code` for system technologies. Use `technologies.id` as the canonical reference. |
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
| `project_type` | VARCHAR(30) | `NEW_DEVELOPMENT`, `MAINTENANCE`, `MIGRATION`, `INTEGRATION`, `REFACTORING` (nullable) |
| `domain` | VARCHAR(50) | Business domain (e.g., HR, Finance, E-commerce) (nullable) |
| `scope` | VARCHAR(20) | `SMALL`, `MEDIUM`, `LARGE`, `ENTERPRISE` (nullable) |
| `team_size` | INTEGER | Team members count, 1-100 (nullable) |
| `deadline_pressure` | VARCHAR(20) | `RELAXED`, `NORMAL`, `TIGHT`, `CRITICAL` (nullable) |
| `methodology` | VARCHAR(20) | `AGILE`, `WATERFALL`, `HYBRID` (nullable) |

**Migration**: `20260329_project_context_enrichment.sql` — added project context fields for AI enrichment.

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
| `actual_hours` | DECIMAL(8,2) | Actual hours spent (consuntivo). NULL until recorded |
| `actual_start_date` | DATE | Real start date (optional) |
| `actual_end_date` | DATE | Real end date (optional) |
| `actual_notes` | TEXT | Free-text notes on actual work |
| `actual_recorded_at` | TIMESTAMPTZ | When actuals were last saved |
| `actual_recorded_by` | UUID | User who recorded actuals (FK auth.users) |

**Migration**: `20260302_add_actual_fields.sql`

#### estimation_accuracy (view)

Pre-joined view for accuracy analytics.  Only includes estimations with `actual_hours IS NOT NULL`.

| Column | Source |
|--------|--------|
| `estimation_id` | estimations.id |
| `requirement_id` | estimations.requirement_id |
| `total_days` | estimations.total_days |
| `base_hours` | estimations.base_hours |
| `actual_hours` | estimations.actual_hours |
| `deviation_percent` | Computed: `((actual_hours/8 - total_days) / total_days) * 100` |
| `requirement_title` | requirements.title |
| `technology_name` | technologies.name |
| `tech_category` | technologies.tech_category |
| `scenario_name` | estimations.scenario_name |
| `estimated_at` | estimations.created_at |
| `actual_recorded_at` | estimations.actual_recorded_at |

#### RPC: `update_estimation_actuals`

Updates the actual/consuntivo fields on a single estimation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_estimation_id` | UUID | Target estimation |
| `p_user_id` | UUID | Calling user (verified against org membership) |
| `p_actual_hours` | DECIMAL(8,2) | Hours actually spent |
| `p_actual_start_date` | DATE | Optional real start |
| `p_actual_end_date` | DATE | Optional real end |
| `p_actual_notes` | TEXT | Optional notes |

Security: `SECURITY DEFINER`, checks org membership (`admin`/`editor`/`owner`).

---

## Junction Tables

### estimation_activities

| Column | Type | Description |
|--------|------|-------------|
| `estimation_id` | UUID | FK to estimations |
| `activity_id` | UUID | FK to activities |
| `is_ai_suggested` | BOOLEAN | Was this suggested by AI? |
| `notes` | TEXT | User notes |

**Trigger**: `trg_enforce_estimation_activity_category` — fires BEFORE INSERT, calls `enforce_estimation_activity_category()`. Validates that the inserted activity’s `technology_id` FK matches the requirement’s `technology_id` (via `estimations → requirements`). MULTI activities are always allowed. Updated in migration `20260301_canonical_technology_model.sql` to use FK-based comparison instead of `tech_category` strings.

**Trigger**: `trg_sync_activity_tech_category` — fires BEFORE INSERT/UPDATE OF `technology_id` on `activities`. Keeps the legacy `tech_category` column in sync with the technology’s `code`. Added in migration `20260301_canonical_technology_model.sql`.

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
| `estimations` | Via org membership | Editor/admin in org | — | — |
| `estimation_activities` | Via org membership | Editor/admin in org | — | — |
| `estimation_drivers` | Via org membership | Editor/admin in org | — | — |
| `estimation_risks` | Via org membership | Editor/admin in org | — | — |

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
  p_senior_consultant_analysis JSONB DEFAULT NULL,
  p_blueprint_id UUID DEFAULT NULL
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

-- Partial index for accuracy queries (only rows with actuals)
CREATE INDEX idx_estimations_with_actuals ON estimations(requirement_id) WHERE actual_hours IS NOT NULL;

-- Vector indexes for semantic search (Phase 2)
CREATE INDEX idx_activities_embedding ON activities USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_requirements_embedding ON requirements USING ivfflat (embedding vector_cosine_ops);
```

---

## Vector Search Functions (pgvector)

Added in migration `20260221_pgvector_embeddings.sql`.  
Updated in `20260301_fix_vector_search_rpc.sql` (added `technology_id`, changed `base_hours` to `numeric`).

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
    base_hours numeric, tech_category varchar, technology_id uuid,
    "group" varchar, similarity float
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

## Milestone 1: Requirement Understanding

### requirement_understanding

Stores structured AI-generated understanding artifacts for requirements. Each row captures one generation run, enabling version history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | FK → requirements (CASCADE). Nullable — understanding can be generated before the requirement is persisted. |
| `understanding` | JSONB | Full `RequirementUnderstanding` artifact (businessObjective, expectedOutput, functionalPerimeter, exclusions, actors, stateTransition, preconditions, assumptions, complexityAssessment, confidence, metadata) |
| `input_description` | TEXT | Snapshot of the description used to generate the understanding |
| `input_tech_category` | TEXT | Technology category at generation time (nullable) |
| `user_id` | UUID | FK → auth.users |
| `version` | INTEGER | Auto-incremented per `requirement_id` (starts at 1) |
| `created_at` | TIMESTAMPTZ | Auto-set |

**Indexes**:
- `idx_requirement_understanding_requirement` — `(requirement_id, created_at DESC)` for fast latest-version lookup
- `idx_requirement_understanding_user` — `(user_id)` for RLS policy

**RLS**:
- **SELECT**: User can read understanding for requirements they own (via `requirements → lists → user_id`) or that they created (`user_id = auth.uid()`)
- **INSERT**: `user_id = auth.uid()`
- **UPDATE**: `user_id = auth.uid()`
- **DELETE**: `user_id = auth.uid()`

**Migration**: [20260306_requirement_understanding.sql](../supabase/migrations/20260306_requirement_understanding.sql)

---

## Milestone 2: Impact Map

### impact_map

Stores structured AI-generated architectural impact analysis artifacts for requirements. Each row captures one generation run, enabling version history. The Impact Map identifies which system layers are affected by a requirement and what structural action each requires — without estimating effort.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | FK → requirements (CASCADE). Nullable — impact map can be generated before the requirement is persisted. |
| `impact_map` | JSONB | Full `ImpactMap` artifact (summary, impacts[]{layer, action, components[], reason, confidence}, overallConfidence) |
| `input_description` | TEXT | Snapshot of the description used to generate the impact map |
| `input_tech_category` | TEXT | Technology category at generation time (nullable) |
| `has_requirement_understanding` | BOOLEAN | Whether a confirmed Requirement Understanding was available as input (DEFAULT FALSE) |
| `user_id` | UUID | FK → auth.users |
| `version` | INTEGER | Auto-incremented per `requirement_id` (starts at 1) |
| `created_at` | TIMESTAMPTZ | Auto-set |

**Indexes**:
- `idx_impact_map_requirement` — `(requirement_id, created_at DESC)` for fast latest-version lookup
- `idx_impact_map_user` — `(user_id)` for RLS policy

**RLS**:
- **SELECT**: User can read impact maps for requirements they own (via `requirements → lists → user_id`) or that they created (`user_id = auth.uid()`)
- **INSERT**: `user_id = auth.uid()`
- **UPDATE**: `user_id = auth.uid()`
- **DELETE**: `user_id = auth.uid()`

**Migration**: [20260308_impact_map.sql](../supabase/migrations/20260308_impact_map.sql)

---

### estimation_blueprint

Stores structured AI-generated Estimation Blueprint artifacts for requirements. Each row captures one generation run with version tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (DEFAULT gen_random_uuid()) |
| `requirement_id` | UUID | FK → requirements (CASCADE). Nullable — blueprint can be generated before the requirement is persisted. |
| `blueprint` | JSONB | Full `EstimationBlueprint` artifact (summary, components[], integrations[], dataEntities[], testingScope[], assumptions[], exclusions[], uncertainties[], overallConfidence, reasoning) |
| `input_description` | TEXT | Snapshot of the description used to generate the blueprint |
| `input_tech_category` | TEXT | Technology category at generation time |
| `based_on_understanding_id` | UUID | FK → requirement_understanding. Tracks which understanding informed this blueprint. |
| `based_on_impact_map_id` | UUID | FK → impact_map. Tracks which impact map informed this blueprint. |
| `confidence_score` | NUMERIC(3,2) | Overall confidence score (0.00–1.00) |
| `user_id` | UUID | FK → auth.users. Who triggered the generation. |
| `version` | INTEGER | Monotonically increasing per requirement_id. |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes**:
- `idx_estimation_blueprint_requirement` — `(requirement_id, created_at DESC)` for fast latest-version lookup
- `idx_estimation_blueprint_user` — `(user_id)` for RLS policy

**RLS Policies**:
- **SELECT**: User can read blueprints for requirements they own (via `requirements → lists → user_id`) or that they created (`user_id = auth.uid()`)
- **INSERT**: `user_id = auth.uid()`
- **UPDATE**: `user_id = auth.uid()`
- **DELETE**: `user_id = auth.uid()`

**Auditability**: The `estimations` table has a `blueprint_id UUID` FK column (nullable) that links each estimation to the blueprint that informed it. This enables full traceability: requirement → understanding → impact map → blueprint → estimation.

**Migration**: [20260311_estimation_blueprint.sql](../supabase/migrations/20260311_estimation_blueprint.sql)

---

### requirement_analyses

Domain-model entity capturing a structured understanding of a requirement. Links to the full traceability chain.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requirement_id` | UUID | FK → requirements (CASCADE) |
| `understanding` | JSONB | Structured RequirementUnderstanding artifact |
| `input_description` | TEXT | Description at analysis time |
| `input_tech_category` | TEXT | Tech category at analysis time |
| `confidence` | NUMERIC(3,2) | 0.00–1.00 |
| `created_by` | UUID | FK → auth.users |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql)

---

### impact_maps (domain model)

Structured impact map linked to a `requirement_analyses` record. Distinct from the legacy `impact_map` table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `analysis_id` | UUID | FK → requirement_analyses (CASCADE) |
| `impact_data` | JSONB | Structured impact map payload |
| `confidence` | NUMERIC(3,2) | 0.00–1.00 |
| `created_by` | UUID | FK → auth.users |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql)

---

### candidate_sets

Ranked list of candidate activities for an estimation, with source and confidence metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `analysis_id` | UUID | FK → requirement_analyses (CASCADE) |
| `impact_map_id` | UUID | FK → impact_maps (SET NULL) |
| `technology_id` | UUID | FK → technologies (SET NULL) |
| `candidates` | JSONB | CandidateActivity[] — activity_id, source, score, confidence |
| `created_by` | UUID | FK → auth.users |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql)

---

### estimation_decisions

Captures the final selection decisions made for an estimation — what was included, excluded, and why.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `candidate_set_id` | UUID | FK → candidate_sets (CASCADE) |
| `selected_activity_ids` | UUID[] | Activities included in estimation |
| `excluded_activity_ids` | UUID[] | Activities explicitly excluded |
| `driver_values` | JSONB | [{driver_id, selected_value}] |
| `risk_ids` | UUID[] | Selected risk UUIDs |
| `warnings` | TEXT[] | System/AI warnings |
| `assumptions` | TEXT[] | Stated assumptions |
| `decision_confidence` | NUMERIC(3,2) | 0.00–1.00 |
| `created_by` | UUID | FK → auth.users |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql)

---

### estimation_snapshots

Immutable snapshot of the full input and output for an estimation, enabling reproducibility and auditing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `estimation_id` | UUID | FK → estimations (CASCADE) |
| `snapshot_data` | JSONB | Full EstimationSnapshotData (activities, drivers, risks, totals, metadata) |
| `engine_version` | TEXT | Version of the estimation engine used |
| `created_by` | UUID | FK → auth.users |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql)

---

### estimations (extended columns)

Two new nullable FK columns added for domain-model traceability:

| Column | Type | Description |
|--------|------|-------------|
| `analysis_id` | UUID | FK → requirement_analyses (SET NULL). Links estimation to its analysis. |
| `decision_id` | UUID | FK → estimation_decisions (SET NULL). Links estimation to its decision. |

**Traceability chain**: estimation → decision → candidate_set → analysis (→ impact_map)

**Migration**: [20260321_domain_model_tables.sql](../supabase/migrations/20260321_domain_model_tables.sql), [20260321_domain_model_rpc.sql](../supabase/migrations/20260321_domain_model_rpc.sql)

---

## Maintenance Notes

- **Schema changes**: Run migration SQL in Supabase SQL Editor.
- **Seed data**: [supabase_seed.sql](../supabase_seed.sql) contains initial activities, drivers, risks, technologies.
- **History optimizations**: [estimation_history_optimizations.sql](../estimation_history_optimizations.sql) adds helper views.
- **Vector embeddings**: Run `ai-generate-embeddings` endpoint after migration to populate embedding columns.
- **Trigger fix (2026-02-28)**: `enforce_estimation_activity_category()` was updated to reference `technologies` (not the old `technology_presets`) and join through `requirements.technology_id`. Migration: `20260228_fix_estimation_activity_trigger.sql`.
- **Agentic tables (2026-03-01)**: `consultant_analyses` and `agent_execution_log` added for Phase 3 agentic pipeline. Migration: `20260301_consultant_analysis_history.sql`.
- **Actual fields (2026-03-02)**: `estimations` table extended with `actual_hours`, `actual_start_date`, `actual_end_date`, `actual_notes`, `actual_recorded_at`, `actual_recorded_by`. View `estimation_accuracy` and RPC `update_estimation_actuals()`. Migration: `20260302_add_actual_fields.sql`.
- **Vector search RPC fix (2026-03-01)**: `search_similar_activities` re-created with `technology_id uuid` in result set and `base_hours` widened to `numeric`. Fixes plan-cache invalidation after `activities.technology_id` column was added. Migration: `20260301_fix_vector_search_rpc.sql`.
- **Prompt versioning (2026-03-10)**: `ai_prompts` table extended with `variant`, `traffic_pct`, `usage_count`, `avg_confidence`, `promoted_at`. Dropped `UNIQUE(prompt_key)`, added `UNIQUE(prompt_key, variant) WHERE is_active`. RPCs: `record_prompt_confidence()`, `increment_prompt_usage()`. View: `prompt_ab_comparison`. Supports A/B testing. Migration: `20260310_prompt_versioning.sql`.
- **Vector search technology_id fix (2026-03-04)**: Idempotent migration that ensures `activities.technology_id` column exists before the `search_similar_activities` RPC references it. Required when `20260301_canonical_technology_model` was not applied before `20260301_fix_vector_search_rpc`. Also back-fills `technology_id` from `tech_category` and re-creates the RPC. Migration: `20260304_fix_vector_search_technology_id.sql`.
- **Junction table RLS fix (2026-03-04)**: Replaced legacy `user_id`-based RLS on `estimation_activities`, `estimation_drivers`, `estimation_risks` with organization-based policies consistent with the multitenancy migration. Migration: `20260304_fix_junction_table_rls.sql`.
- **Smart updated_at trigger (2026-03-04)**: Replaced blanket `update_requirements_updated_at` trigger with `update_requirements_updated_at_smart()`. The new trigger only bumps `updated_at` when user-facing content columns change (`title`, `description`, `priority`, `state`, `business_owner`, `technology_id`, `req_id`). System writes (embedding, `assigned_estimation_id`, labels) no longer touch `updated_at`. Migration: `20260304_fix_updated_at_trigger.sql`.
- **Requirement Understanding (2026-03-06)**: `requirement_understanding` table added for Milestone 1. Stores structured AI understanding artifacts with version history. JSONB `understanding` column holds the full `RequirementUnderstanding` interface. Migration: `20260306_requirement_understanding.sql`.
- **Impact Map (2026-03-08)**: `impact_map` table added for Milestone 2. Stores structured AI architectural impact analysis artifacts with version history. JSONB `impact_map` column holds the full `ImpactMap` interface (summary, impacts[], overallConfidence). Boolean `has_requirement_understanding` tracks whether the understanding was available as input. Migration: `20260308_impact_map.sql`.
- **Estimation Blueprint (2026-03-11)**: `estimation_blueprint` table added for Milestone 3. Stores structured AI estimation blueprint artifacts with technical component decomposition, integrations, data entities, testing scope, and confidence scoring. FKs to `requirement_understanding` and `impact_map` for provenance. Also adds `blueprint_id UUID` FK to `estimations` table for audit traceability. Migration: `20260311_estimation_blueprint.sql`.
- **Persistence Convergence (2026-03-21)**: All estimation save paths now converge on `saveEstimationByIds()` → `save_estimation_atomic` RPC. Added `p_blueprint_id UUID DEFAULT NULL` parameter to the RPC. Dropped all 4 historical overloads (11-param NUMERIC/TEXT, 12-param DECIMAL/VARCHAR, 13-param +JSONB, 14-param +UUID) and created definitive 14-param version. Migration: `20260321_add_blueprint_id_to_rpc.sql`.
- **Domain Model (2026-03-21)**: Five new tables introduced for structured estimation traceability: `requirement_analyses`, `impact_maps` (domain-level, separate from legacy `impact_map`), `candidate_sets`, `estimation_decisions`, `estimation_snapshots`. Two new nullable FK columns added to `estimations`: `analysis_id`, `decision_id`. RPC `save_estimation_atomic` extended with `p_analysis_id UUID` and `p_decision_id UUID`. Migrations: `20260321_domain_model_tables.sql`, `20260321_domain_model_rpc.sql`. Types: `src/types/domain-model.ts`. Domain services: `netlify/functions/lib/domain/estimation/`.

---

**Update this document when**:
- Adding new tables or columns
- Modifying RLS policies
- Changing relationships between entities
- Adding new vector search functions
