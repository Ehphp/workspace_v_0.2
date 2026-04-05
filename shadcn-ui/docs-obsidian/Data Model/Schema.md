# Database Schema

Supabase (PostgreSQL) schema powering the [[Estimation Pipeline]].

## Type

Data Reference

## Entity Groups

### User Data

| Table | Purpose | Related |
|---|---|---|
| `projects` | User projects (FK → auth.users) | — |
| `requirements` | Requirements within projects | — |
| `estimations` | Estimation results (FK → decision_id) | [[Engine]] output |

### AI Artifact Tables

| Table | Artifact | Migration |
|---|---|---|
| `requirement_understanding` | [[Requirement Understanding]] | `20260306` |
| `impact_map` | [[Impact Map]] | `20260308` |
| `estimation_blueprint` | [[Estimation Blueprint]] | `20260311` |

### Domain Model Tables

| Table | Artifact | Migration |
|---|---|---|
| `requirement_analyses` | Understanding (standardized) | `20260321` |
| `impact_maps` | Impact map (standardized) | `20260321` |
| `candidate_sets` | [[Candidate Set]] | `20260321` |
| `estimation_decisions` | [[Estimation Decision]] | `20260321` |
| `estimation_snapshots` | Immutable audit record | `20260321` |

### Catalogs

| Table | Purpose |
|---|---|
| `activities` | Activity definitions (code, base_hours) |
| `drivers` | Driver definitions (code, options) |
| `risks` | Risk definitions (code, weight) |
| `technologies` | Technology presets |
| `technology_activities` | Tech → activity mapping |

## Security

All tables protected by Row-Level Security (RLS) — see [[Architecture/Constraints]].

## Represented in code

- `supabase_schema.sql` — base schema
- `supabase/migrations/` — migration history (see [[Data Model/Migrations]])
- `docs/data-model.md` (technical reference)

## Stability

Medium

## Source of truth

Migration

## Verified at

2026-04-05

## Verified against code

- **status**: PARTIAL
- **source**:
  - `supabase/migrations/20260306_requirement_understanding.sql` — requirement_understanding table confirmed
  - `supabase/migrations/20260308_impact_map.sql` — impact_map table confirmed
  - `supabase/migrations/20260311_estimation_blueprint.sql` — estimation_blueprint table confirmed
  - `supabase/migrations/20260321_domain_model_tables.sql` — domain model tables confirmed
  - `src/types/domain-model.ts` — CandidateSetRow, EstimationDecisionRow types confirmed
- **partial because**:
  - Catalog tables (activities, drivers, risks, technologies) listed from schema docs but not individually verified in migration files
  - RLS policies assumed but not individually verified
