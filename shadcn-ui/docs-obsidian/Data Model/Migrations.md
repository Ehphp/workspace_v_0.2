# Migrations

Database migration history for the [[Data Model/Schema]].

## Type

Data Reference

## Migration Timeline

| Date | File | Purpose | Related |
|---|---|---|---|
| 2026-03-06 | `20260306_requirement_understanding.sql` | [[Requirement Understanding]] table | — |
| 2026-03-08 | `20260308_impact_map.sql` | [[Impact Map]] table | — |
| 2026-03-11 | `20260311_estimation_blueprint.sql` | [[Estimation Blueprint]] table | — |
| 2026-03-21 | `20260321_domain_model_tables.sql` | [[Candidate Set]], [[Estimation Decision]], snapshots | — |

## Locations

- `supabase/migrations/` — numbered migration files
- `migrations/` — standalone migration scripts (e.g., `migrate_base_days_to_base_hours.sql`)

## Stability

High

## Source of truth

Migration

## Verified at

2026-04-05

## Verified against code

- **status**: VERIFIED
- **source**:
  - All 4 migration files exist in `supabase/migrations/` (file_search confirmed)
  - `migrations/migrate_base_days_to_base_hours.sql` exists (workspace structure confirmed)
