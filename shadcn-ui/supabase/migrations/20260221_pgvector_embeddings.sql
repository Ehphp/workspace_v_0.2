-- ============================================
-- Phase 1: pgvector Infrastructure Setup
-- Zero Downtime Migration
-- ============================================

-- Enable pgvector extension (requires Supabase database extensions enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Add embedding columns to activities table
-- Using vector(1536) for OpenAI text-embedding-3-small
-- ============================================

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for cosine similarity search on activities
CREATE INDEX IF NOT EXISTS idx_activities_embedding 
ON activities USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- Add embedding columns to requirements table
-- For RAG-based history search (Phase 4)
-- ============================================

ALTER TABLE requirements 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for cosine similarity search on requirements
CREATE INDEX IF NOT EXISTS idx_requirements_embedding 
ON requirements USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- Add embedding_updated_at for tracking freshness
-- ============================================

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE requirements 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- Vector similarity search function for activities
-- Returns top-K similar activities based on cosine distance
-- ============================================

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
    base_hours decimal(5,2),
    tech_category varchar(50),
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

-- ============================================
-- Vector similarity search function for requirements (RAG)
-- Returns similar past requirements for few-shot prompting
-- ============================================

CREATE OR REPLACE FUNCTION search_similar_requirements(
    query_embedding vector(1536),
    user_id_filter uuid DEFAULT NULL,
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    req_id varchar(100),
    title varchar(500),
    description text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.req_id,
        r.title,
        r.description,
        1 - (r.embedding <=> query_embedding) AS similarity
    FROM requirements r
    JOIN lists l ON r.list_id = l.id
    WHERE 
        r.embedding IS NOT NULL
        AND 1 - (r.embedding <=> query_embedding) > match_threshold
        AND (user_id_filter IS NULL OR l.user_id = user_id_filter)
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- Function to find semantically similar activities for deduplication
-- Used in Phase 3 to suggest existing activities when creating new ones
-- ============================================

CREATE OR REPLACE FUNCTION find_duplicate_activities(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.8
)
RETURNS TABLE (
    id uuid,
    code varchar(50),
    name varchar(255),
    description text,
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
        1 - (a.embedding <=> query_embedding) AS similarity
    FROM activities a
    WHERE 
        a.active = true
        AND a.embedding IS NOT NULL
        AND 1 - (a.embedding <=> query_embedding) > similarity_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT 5;
END;
$$;

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON COLUMN activities.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
COMMENT ON COLUMN requirements.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for RAG history search';
COMMENT ON FUNCTION search_similar_activities IS 'Returns top-K activities similar to query embedding using cosine similarity';
COMMENT ON FUNCTION search_similar_requirements IS 'Returns similar past requirements for few-shot prompting (RAG)';
COMMENT ON FUNCTION find_duplicate_activities IS 'Finds semantically similar activities for deduplication (>80% similarity)';
