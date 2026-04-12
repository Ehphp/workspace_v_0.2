-- ============================================================================
-- Migration: Add structured_digest JSONB column to project_technical_blueprints
-- ============================================================================
-- Stores the Structured Document Digest (SDD) produced by Pass 1 of the
-- AI generation pipeline. Contains functional areas, business entities,
-- external systems, technical constraints, key passages (verbatim excerpts),
-- ambiguities, and a document quality signal.
--
-- Nullable for backward compatibility with existing rows.
-- ============================================================================

ALTER TABLE project_technical_blueprints
ADD COLUMN structured_digest JSONB DEFAULT NULL;

COMMENT ON COLUMN project_technical_blueprints.structured_digest IS
    'Structured Document Digest (SDD) — AI-extracted structured summary of the source documentation with verbatim key passages, functional areas, business entities, and external systems.';
