-- Migration: Fix search_similar_activities after schema change
-- Date: 2026-03-01
-- Description: Re-create the vector search RPC function to force plan
--   invalidation after activities table gained the technology_id column.
--   Also bumps base_hours type to numeric (compatible with decimal(5,2))
--   and adds technology_id to the result set for future FK-based filtering.

-- Drop and re-create to force full plan refresh
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
    code varchar(50),
    name varchar(255),
    description text,
    base_hours numeric,
    tech_category varchar(50),
    technology_id uuid,
    "group" varchar(50),
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.code,
        a.name,
        a.description,
        a.base_hours,
        a.tech_category,
        a.technology_id,
        a."group",
        1 - (a.embedding <=> query_embedding) AS similarity
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

COMMENT ON FUNCTION search_similar_activities IS 'Returns top-K activities similar to query embedding using cosine similarity. Re-created 2026-03-01 to fix plan cache after schema change.';
