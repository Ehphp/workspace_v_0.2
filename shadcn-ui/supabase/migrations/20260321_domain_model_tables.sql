-- ============================================
-- DOMAIN MODEL: Structured Estimation Entities
-- ============================================
-- Introduces: requirement_analyses, impact_maps, candidate_sets,
--             estimation_decisions, estimation_snapshots
-- Extends:    estimations (analysis_id, decision_id)
--
-- Non-breaking: all new columns are nullable, no existing columns touched.

-- ────────────────────────────────────────────
-- 1. requirement_analyses
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requirement_analyses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    understanding  JSONB NOT NULL,          -- RequirementUnderstanding artifact
    input_description TEXT NOT NULL,
    input_tech_category TEXT,
    confidence     NUMERIC(3,2),            -- 0.00–1.00
    created_by     UUID NOT NULL REFERENCES auth.users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_req_analyses_requirement
    ON requirement_analyses(requirement_id);

ALTER TABLE requirement_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analyses"
    ON requirement_analyses FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert own analyses"
    ON requirement_analyses FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ────────────────────────────────────────────
-- 2. impact_maps (domain model, separate from legacy impact_map table)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impact_maps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES requirement_analyses(id) ON DELETE CASCADE,
    impact_data JSONB NOT NULL,             -- structured impact map payload
    confidence  NUMERIC(3,2),
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impact_maps_analysis
    ON impact_maps(analysis_id);

ALTER TABLE impact_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own impact_maps"
    ON impact_maps FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert own impact_maps"
    ON impact_maps FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ────────────────────────────────────────────
-- 3. candidate_sets
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_sets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES requirement_analyses(id) ON DELETE CASCADE,
    impact_map_id UUID REFERENCES impact_maps(id) ON DELETE SET NULL,
    technology_id UUID REFERENCES technologies(id) ON DELETE SET NULL,
    candidates  JSONB NOT NULL,             -- CandidateActivity[] array
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_sets_analysis
    ON candidate_sets(analysis_id);

ALTER TABLE candidate_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own candidate_sets"
    ON candidate_sets FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert own candidate_sets"
    ON candidate_sets FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ────────────────────────────────────────────
-- 4. estimation_decisions
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimation_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_set_id    UUID NOT NULL REFERENCES candidate_sets(id) ON DELETE CASCADE,
    selected_activity_ids  UUID[] NOT NULL,
    excluded_activity_ids  UUID[] NOT NULL DEFAULT '{}',
    driver_values       JSONB NOT NULL DEFAULT '[]',   -- [{driver_id, selected_value}]
    risk_ids            UUID[] NOT NULL DEFAULT '{}',
    warnings            TEXT[] NOT NULL DEFAULT '{}',
    assumptions         TEXT[] NOT NULL DEFAULT '{}',
    decision_confidence NUMERIC(3,2),                  -- 0.00–1.00
    created_by          UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimation_decisions_candidate_set
    ON estimation_decisions(candidate_set_id);

ALTER TABLE estimation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own estimation_decisions"
    ON estimation_decisions FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert own estimation_decisions"
    ON estimation_decisions FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ────────────────────────────────────────────
-- 5. estimation_snapshots
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimation_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimation_id   UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    snapshot_data   JSONB NOT NULL,          -- full input + output for reproducibility
    engine_version  TEXT NOT NULL DEFAULT '1.0.0',
    created_by      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimation_snapshots_estimation
    ON estimation_snapshots(estimation_id);

ALTER TABLE estimation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own estimation_snapshots"
    ON estimation_snapshots FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can insert own estimation_snapshots"
    ON estimation_snapshots FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ────────────────────────────────────────────
-- 6. Extend estimations table
-- ────────────────────────────────────────────
ALTER TABLE estimations
    ADD COLUMN IF NOT EXISTS analysis_id  UUID REFERENCES requirement_analyses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS decision_id  UUID REFERENCES estimation_decisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimations_analysis_id
    ON estimations(analysis_id);

CREATE INDEX IF NOT EXISTS idx_estimations_decision_id
    ON estimations(decision_id);
