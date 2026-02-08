# Data Integrity Playbook

This document provides verification checklists, diagnostic SQL queries, and recovery strategies for maintaining data integrity in Syntero's preset and activity system.

---

## Why Data Integrity Matters

Syntero's estimation reliability depends on consistent relationships between:

```
technology_presets ──────────────────────────────────────────┐
       │                                                      │
       │ tech_category                                        │
       │ default_activity_codes (JSONB array)                 │
       ▼                                                      │
activities ◄─────────────────────────────────────────────────┤
       │                                                      │
       │ tech_category                                        │
       │ code (unique identifier)                             │
       ▼                                                      │
technology_preset_activities (pivot table)                   │
       │                                                      │
       │ tech_preset_id ──────────────────────────────────────┘
       │ activity_id
       │ position (ordering)
       ▼
estimation_activities (junction table)
       │
       │ Links estimations to selected activities
       ▼
```

**Impact of broken relationships**:

| Issue | Effect |
|-------|--------|
| Preset references nonexistent activity codes | AI suggestions fail or return empty |
| Activity missing from filtered list | User cannot select required work |
| Invalid tech_category | Wrong activities shown to user |
| Missing pivot table entries | Preset defaults don't load |
| Orphan activities | Catalog bloat, confusing UI |

---

## Common Failure Scenarios

### 1. Preset with No Activities

**Symptom**: Selecting a preset shows empty activity list.

**Causes**:
- `default_activity_codes` JSONB array references codes that don't exist in `activities`
- `tech_category` mismatch between preset and activities
- All referenced activities have `active = false`

**Diagnostic**:
```sql
-- Find presets with no valid activities
SELECT 
    tp.id,
    tp.code AS preset_code,
    tp.name AS preset_name,
    tp.tech_category,
    jsonb_array_length(tp.default_activity_codes) AS declared_activities,
    COUNT(a.id) AS actual_matching_activities
FROM technology_presets tp
LEFT JOIN activities a ON (
    a.code = ANY(
        SELECT jsonb_array_elements_text(tp.default_activity_codes)
    )
    AND a.active = true
)
GROUP BY tp.id, tp.code, tp.name, tp.tech_category
HAVING COUNT(a.id) = 0 OR COUNT(a.id) < jsonb_array_length(tp.default_activity_codes);
```

### 2. Orphan Activities

**Symptom**: Activities exist but are never used; catalog grows with unused entries.

**Causes**:
- Migration deleted presets but not activities
- Custom activities created then abandoned
- Testing artifacts left in production

**Diagnostic**:
```sql
-- Find activities not referenced by any preset
SELECT a.id, a.code, a.name, a.tech_category, a.is_custom, a.created_by
FROM activities a
WHERE a.active = true
AND NOT EXISTS (
    SELECT 1 
    FROM technology_presets tp 
    WHERE tp.default_activity_codes ? a.code
)
AND NOT EXISTS (
    SELECT 1 
    FROM technology_preset_activities tpa 
    WHERE tpa.activity_id = a.id
)
ORDER BY a.tech_category, a.code;
```

### 3. Missing Ordering / Position

**Symptom**: Activities appear in random/inconsistent order in UI.

**Causes**:
- `technology_preset_activities` entries missing `position`
- Duplicate position values
- Position gaps

**Diagnostic**:
```sql
-- Find preset-activity links with position issues
SELECT 
    tp.code AS preset_code,
    a.code AS activity_code,
    tpa.position,
    LAG(tpa.position) OVER (PARTITION BY tpa.tech_preset_id ORDER BY tpa.position) AS prev_position,
    CASE 
        WHEN tpa.position IS NULL THEN 'MISSING'
        WHEN LAG(tpa.position) OVER (PARTITION BY tpa.tech_preset_id ORDER BY tpa.position) = tpa.position THEN 'DUPLICATE'
        ELSE 'OK'
    END AS status
FROM technology_preset_activities tpa
JOIN technology_presets tp ON tp.id = tpa.tech_preset_id
JOIN activities a ON a.id = tpa.activity_id
ORDER BY tp.code, tpa.position NULLS FIRST;
```

### 4. Tech Category Mismatch

**Symptom**: AI suggestions include irrelevant activities; filtering doesn't work correctly.

**Causes**:
- Activity `tech_category` doesn't match preset `tech_category`
- `MULTI` activities incorrectly excluded
- Preset misconfigured during creation

**Diagnostic**:
```sql
-- Find mismatched tech categories between presets and their default activities
SELECT 
    tp.code AS preset_code,
    tp.tech_category AS preset_category,
    a.code AS activity_code,
    a.tech_category AS activity_category,
    CASE 
        WHEN a.tech_category = tp.tech_category THEN 'MATCH'
        WHEN a.tech_category = 'MULTI' THEN 'OK (MULTI)'
        ELSE 'MISMATCH'
    END AS status
FROM technology_presets tp
CROSS JOIN LATERAL jsonb_array_elements_text(tp.default_activity_codes) AS dac(code)
JOIN activities a ON a.code = dac.code
WHERE a.tech_category != tp.tech_category AND a.tech_category != 'MULTI';
```

---

## Verification Checklist

Run these checks before:
- Enabling a new preset
- Running AI estimation on production data
- Deploying schema or seed changes

### Before Enabling a Preset

- [ ] All `default_activity_codes` reference existing activity codes
- [ ] All referenced activities have `active = true`
- [ ] Preset `tech_category` matches (or is compatible with) activity `tech_category`
- [ ] `technology_preset_activities` has entries for all default activities
- [ ] Position values in pivot table are sequential (no gaps, no duplicates)

### Before Running AI Estimation

- [ ] Selected preset has at least 5 valid activities
- [ ] Activities span required groups (ANALYSIS, DEV, TEST, at minimum)
- [ ] No `base_hours = 0` activities (would produce 0-day estimates)
- [ ] Activity descriptions are non-empty (AI uses these for suggestions)

### Before Deploying to Production

- [ ] Run all diagnostic queries — zero rows returned for error conditions
- [ ] Compare activity count before/after migration
- [ ] Verify seed data matches expected counts:
  - Activities: ~27+ system activities
  - Drivers: 5
  - Risks: 8
  - Presets: 4+ system presets

---

## SQL Diagnostic Queries

### Presets Without Linked Activities

```sql
-- Presets with default_activity_codes that don't exist
SELECT 
    tp.code AS preset_code,
    tp.name AS preset_name,
    dac.code AS missing_activity_code
FROM technology_presets tp
CROSS JOIN LATERAL jsonb_array_elements_text(tp.default_activity_codes) AS dac(code)
WHERE NOT EXISTS (
    SELECT 1 FROM activities a WHERE a.code = dac.code AND a.active = true
);
```

### Activities Not Linked to Any Preset

```sql
-- Active activities not in any preset's default_activity_codes
SELECT 
    a.code,
    a.name,
    a.tech_category,
    a.base_hours,
    a.is_custom
FROM activities a
WHERE a.active = true
AND NOT EXISTS (
    SELECT 1 
    FROM technology_presets tp 
    WHERE tp.default_activity_codes ? a.code
);
```

### Missing or Duplicated Ordering

```sql
-- Duplicate positions within same preset
SELECT 
    tp.code AS preset_code,
    tpa.position,
    COUNT(*) AS count
FROM technology_preset_activities tpa
JOIN technology_presets tp ON tp.id = tpa.tech_preset_id
GROUP BY tp.code, tpa.position
HAVING COUNT(*) > 1;

-- Gaps in position sequence
WITH positions AS (
    SELECT 
        tech_preset_id,
        position,
        ROW_NUMBER() OVER (PARTITION BY tech_preset_id ORDER BY position) AS expected_pos
    FROM technology_preset_activities
)
SELECT 
    tp.code AS preset_code,
    p.position AS actual_position,
    p.expected_pos AS expected_position
FROM positions p
JOIN technology_presets tp ON tp.id = p.tech_preset_id
WHERE p.position != p.expected_pos;
```

### Activities with Zero Hours

```sql
-- These would produce 0-day estimates
SELECT code, name, tech_category, base_hours
FROM activities
WHERE base_hours <= 0 AND active = true;
```

### Empty Activity Descriptions

```sql
-- AI needs descriptions for context
SELECT code, name, tech_category
FROM activities
WHERE (description IS NULL OR description = '') AND active = true;
```

---

## Recovery Strategies

### When Preset References Nonexistent Activities

**Option A: Remove bad references (preserve preset)**

```sql
UPDATE technology_presets
SET default_activity_codes = (
    SELECT jsonb_agg(code)
    FROM jsonb_array_elements_text(default_activity_codes) AS code
    WHERE EXISTS (SELECT 1 FROM activities a WHERE a.code = code AND a.active = true)
)
WHERE id = '<preset-id>';
```

**Option B: Disable preset until fixed**

```sql
UPDATE technology_presets
SET active = false
WHERE id = '<preset-id>';
```

### When Activities Are Orphaned

**Option A: Deactivate orphan activities**

```sql
UPDATE activities
SET active = false
WHERE id IN (
    SELECT a.id
    FROM activities a
    WHERE a.active = true
    AND NOT EXISTS (
        SELECT 1 FROM technology_presets tp WHERE tp.default_activity_codes ? a.code
    )
    AND a.is_custom = false  -- Only system activities
);
```

**Option B: Link to appropriate preset**

```sql
UPDATE technology_presets
SET default_activity_codes = default_activity_codes || to_jsonb('<activity-code>'::text)
WHERE code = '<preset-code>';
```

### When Position Values Are Invalid

```sql
-- Resequence positions for a preset
WITH numbered AS (
    SELECT 
        tpa.tech_preset_id,
        tpa.activity_id,
        ROW_NUMBER() OVER (ORDER BY COALESCE(tpa.position, 999), tpa.activity_id) AS new_position
    FROM technology_preset_activities tpa
    WHERE tpa.tech_preset_id = '<preset-id>'
)
UPDATE technology_preset_activities tpa
SET position = n.new_position
FROM numbered n
WHERE tpa.tech_preset_id = n.tech_preset_id
AND tpa.activity_id = n.activity_id;
```

### When to Fix Data vs Code

| Situation | Fix Data | Fix Code |
|-----------|----------|----------|
| One-off bad records | ✓ | |
| Pattern of missing references | | ✓ (add validation) |
| Seed file outdated | ✓ (update seed) | |
| RLS blocking valid operations | | ✓ (adjust policy) |
| Migration broke relationships | ✓ (migration rollback or fix) | |
| UI creating invalid records | | ✓ (add frontend validation) |

---

## Related Documentation

- [../data-model.md](../data-model.md) — Full schema reference
- [../technology-presets.md](../technology-presets.md) — Preset system documentation
- [../architecture/tech-preset-integrity.md](../architecture/tech-preset-integrity.md) — Technical integrity details
- [../setup/setup-guide.md](../setup/setup-guide.md) — Seed data setup

---

**Last Updated**: 2026-02-08  
**Derived from**: Existing schema files and data model documentation
