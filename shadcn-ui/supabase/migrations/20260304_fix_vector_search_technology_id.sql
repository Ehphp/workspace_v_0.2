-- ============================================
-- FIX: search_similar_activities references activities.technology_id
--      which may not exist if 20260301_canonical_technology_model was not applied.
-- Date: 2026-03-04
-- Problem: column a.technology_id does not exist error from vector search RPC.
-- Solution:
--   1. Ensure activities.technology_id column exists (idempotent).
--   2. Re-create search_similar_activities to force plan refresh.
-- ============================================

-- =============================================
-- STEP 1: Ensure the technology_id column exists on activities
-- (Idempotent — no-op if 20260301_canonical_technology_model already ran)
-- =============================================
ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS technology_id UUID REFERENCES technologies(id) ON DELETE SET NULL;

-- Back-fill from tech_category for any existing rows (idempotent)
UPDATE activities a
SET technology_id = t.id
FROM technologies t
WHERE a.tech_category = t.code
  AND a.technology_id IS NULL;

-- Ensure a MULTI technology exists for cross-cutting activities
INSERT INTO technologies (code, name, description, tech_category, color, sort_order)
VALUES ('MULTI', 'Multi-stack', 'Cross-cutting or full-stack activities', 'MULTI', '#64748b', 99)
ON CONFLICT (code) DO NOTHING;

UPDATE activities a
SET technology_id = t.id
FROM technologies t
WHERE a.tech_category = 'MULTI'
  AND t.code = 'MULTI'
  AND a.technology_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_technology_id ON activities(technology_id);

-- =============================================
-- STEP 2: Re-create search_similar_activities RPC
-- (Identical to 20260301_fix_vector_search_rpc but now guaranteed
--  that activities.technology_id exists)
-- =============================================
DROP FUNCTION IF EXISTS search_similar_activities(vector, float, int, text[]);
DROP FUNCTION IF EXISTS search_similar_activities(vector(1536), float, int, text[]);

CREATE OR REPLACE FUNCTION search_similar_activities(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 30,
    tech_categories text[] DEFAULT ARRAY['MULTI']
)
RETURNS TABLE (
    id uuid,
    code text,
    name text,
    description text,
    base_hours numeric,
    tech_category text,
    technology_id uuid,
    "group" text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.code::text,
        a.name::text,
        a.description,
        a.base_hours,
        a.tech_category::text,
        a.technology_id,
        a."group"::text,
        (1 - (a.embedding <=> query_embedding))::float AS similarity
    FROM activities a
    WHERE
        a.active = true
        AND a.embedding IS NOT NULL
        AND a.tech_category = ANY(tech_categories)
        AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_activities
    IS 'Returns top-K activities similar to query embedding. Re-created 2026-03-04 with text return types for compatibility.';
