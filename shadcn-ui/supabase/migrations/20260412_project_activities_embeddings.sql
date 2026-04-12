-- ============================================================================
-- Migration: pgvector embeddings for project_activities
-- Date: 2026-04-12
-- Purpose: Adds embedding column + index + invalidation trigger to
--          project_activities so that search_catalog can discover PRJ_*
--          activities via semantic search (scoped to project_id).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Add embedding column + freshness tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_activities
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE project_activities
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: IVFFlat index for cosine similarity (lower lists count — fewer rows)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_activities_embedding
    ON project_activities USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 30);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Invalidation trigger — nullify embedding when text fields change
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_project_activity_update_for_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND (
        NEW.name <> OLD.name OR
        NEW.description IS DISTINCT FROM OLD.description OR
        NEW.code <> OLD.code OR
        NEW."group" <> OLD."group"
    )) THEN
        NEW.embedding = NULL;
        NEW.embedding_updated_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_activity_update_for_embeddings ON public.project_activities;
CREATE TRIGGER trg_project_activity_update_for_embeddings
    BEFORE UPDATE ON public.project_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_project_activity_update_for_embeddings();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Extend search_similar_activities with optional project_id
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop ALL known overloads to avoid ambiguity
DROP FUNCTION IF EXISTS search_similar_activities(vector, float, int, text[]);
DROP FUNCTION IF EXISTS search_similar_activities(vector(1536), float, int, text[]);
DROP FUNCTION IF EXISTS search_similar_activities(vector(1536), float, int, text[], uuid);

CREATE OR REPLACE FUNCTION search_similar_activities(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 30,
    tech_categories text[] DEFAULT ARRAY['MULTI'],
    p_project_id uuid DEFAULT NULL
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
    similarity float,
    source text          -- 'global' | 'project'
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Global catalog activities
    SELECT
        a.id,
        a.code::text,
        a.name::text,
        a.description,
        a.base_hours,
        a.tech_category::text,
        a.technology_id,
        a."group"::text,
        (1 - (a.embedding <=> query_embedding))::float AS similarity,
        'global'::text AS source
    FROM activities a
    WHERE
        a.active = true
        AND a.embedding IS NOT NULL
        AND a.tech_category = ANY(tech_categories)
        AND 1 - (a.embedding <=> query_embedding) > match_threshold

    UNION ALL

    -- Project-scoped activities (only when project_id is provided)
    SELECT
        pa.id,
        pa.code::text,
        pa.name::text,
        pa.description,
        pa.base_hours,
        'PROJECT'::text AS tech_category,
        NULL::uuid AS technology_id,
        pa."group"::text,
        (1 - (pa.embedding <=> query_embedding))::float AS similarity,
        'project'::text AS source
    FROM project_activities pa
    WHERE
        p_project_id IS NOT NULL
        AND pa.project_id = p_project_id
        AND pa.is_enabled = true
        AND pa.embedding IS NOT NULL
        AND 1 - (pa.embedding <=> query_embedding) > match_threshold

    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_activities
    IS 'Returns top-K activities similar to query embedding. Includes project-scoped activities when p_project_id is provided. Re-created 2026-04-12 with project activity support.';
