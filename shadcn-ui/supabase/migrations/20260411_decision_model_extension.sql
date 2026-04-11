-- ─────────────────────────────────────────────────────────────────────────────
-- V2 Pipeline Phase 8 — Decision Model Extension
--
-- Adds element_states (per-element provenance/status tracking),
-- based_on_understanding_version, and based_on_impact_map_id to
-- estimation_decisions for full traceability.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE estimation_decisions
    ADD COLUMN IF NOT EXISTS element_states JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS based_on_understanding_version INTEGER,
    ADD COLUMN IF NOT EXISTS based_on_impact_map_id UUID;

-- Index for querying decisions by understanding version
CREATE INDEX IF NOT EXISTS idx_est_decisions_understanding_version
    ON estimation_decisions (based_on_understanding_version)
    WHERE based_on_understanding_version IS NOT NULL;

-- FK to impact_map (nullable — backward compat)
-- Note: impact_map table may use 'impact_maps' or 'impact_map' depending
-- on the migration that created it. Adjust if FK fails.
-- ALTER TABLE estimation_decisions
--     ADD CONSTRAINT fk_est_decisions_impact_map
--     FOREIGN KEY (based_on_impact_map_id) REFERENCES impact_map(id);

COMMENT ON COLUMN estimation_decisions.element_states IS
    'V2 Phase 5/8: Per-element provenance and user-interaction state. Array of SelectedElement objects.';

COMMENT ON COLUMN estimation_decisions.based_on_understanding_version IS
    'V2 Phase 8: Version of requirement_understanding this decision was based on.';

COMMENT ON COLUMN estimation_decisions.based_on_impact_map_id IS
    'V2 Phase 8: ID of impact_map this decision was based on.';
