-- Requirements Estimation System - Database Schema
-- Phase 1 MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE CATALOG TABLES
-- ============================================

-- Activities catalog
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_days DECIMAL(5,2) NOT NULL,
    tech_category VARCHAR(50) NOT NULL, -- POWER_PLATFORM, BACKEND, FRONTEND, MULTI
    "group" VARCHAR(50) NOT NULL, -- ANALYSIS, DEV, TEST, OPS, GOVERNANCE
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers catalog
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    options JSONB NOT NULL, -- Array of {value, label, multiplier}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risks catalog
CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Technology presets
CREATE TABLE technology_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tech_category VARCHAR(50) NOT NULL,
    default_driver_values JSONB, -- {COMPLEXITY: "MEDIUM", ...}
    default_risks JSONB, -- Array of risk codes
    default_activity_codes JSONB, -- Array of activity codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USER DATA TABLES
-- ============================================

-- Lists (Projects)
CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner VARCHAR(255),
    tech_preset_id UUID REFERENCES technology_presets(id), -- Default technology for all requirements in this list
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, ACTIVE, ARCHIVED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Requirements
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    req_id VARCHAR(100) NOT NULL, -- Custom ID like HR-API-001
    title VARCHAR(500) NOT NULL,
    description TEXT,
    tech_preset_id UUID REFERENCES technology_presets(id),
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    state VARCHAR(20) DEFAULT 'PROPOSED', -- PROPOSED, SELECTED, SCHEDULED, DONE
    business_owner VARCHAR(255),
    labels JSONB, -- Array of strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(list_id, req_id)
);

-- Estimations
CREATE TABLE estimations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    total_days DECIMAL(10,2) NOT NULL,
    base_days DECIMAL(10,2) NOT NULL,
    driver_multiplier DECIMAL(5,3) NOT NULL,
    risk_score INTEGER NOT NULL,
    contingency_percent DECIMAL(5,2) NOT NULL,
    scenario_name VARCHAR(255) DEFAULT 'Base',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estimation activities (junction table)
CREATE TABLE estimation_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id),
    is_ai_suggested BOOLEAN DEFAULT false,
    notes TEXT,
    UNIQUE(estimation_id, activity_id)
);

-- Estimation drivers (junction table)
CREATE TABLE estimation_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    selected_value VARCHAR(50) NOT NULL, -- e.g., "MEDIUM", "HIGH"
    UNIQUE(estimation_id, driver_id)
);

-- Estimation risks (junction table)
CREATE TABLE estimation_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    risk_id UUID NOT NULL REFERENCES risks(id),
    UNIQUE(estimation_id, risk_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_status ON lists(status);
CREATE INDEX idx_requirements_list_id ON requirements(list_id);
CREATE INDEX idx_requirements_tech_preset ON requirements(tech_preset_id);
CREATE INDEX idx_requirements_priority ON requirements(priority);
CREATE INDEX idx_requirements_state ON requirements(state);
CREATE INDEX idx_estimations_requirement_id ON estimations(requirement_id);
CREATE INDEX idx_estimations_user_id ON estimations(user_id);
CREATE INDEX idx_activities_tech_category ON activities(tech_category);
CREATE INDEX idx_activities_group ON activities("group");

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on user data tables
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_risks ENABLE ROW LEVEL SECURITY;

-- Catalog tables are public read-only
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE technology_presets ENABLE ROW LEVEL SECURITY;

-- Policies for catalog tables (public read)
CREATE POLICY "Allow public read on activities" ON activities FOR SELECT USING (true);
CREATE POLICY "Allow public read on drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Allow public read on risks" ON risks FOR SELECT USING (true);
CREATE POLICY "Allow public read on technology_presets" ON technology_presets FOR SELECT USING (true);

-- Policies for lists (users see only their own)
CREATE POLICY "Users can view their own lists" ON lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lists" ON lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists" ON lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists" ON lists
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for requirements (through list ownership)
CREATE POLICY "Users can view requirements in their lists" ON requirements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lists 
            WHERE lists.id = requirements.list_id 
            AND lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert requirements in their lists" ON requirements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lists 
            WHERE lists.id = requirements.list_id 
            AND lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update requirements in their lists" ON requirements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM lists 
            WHERE lists.id = requirements.list_id 
            AND lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete requirements in their lists" ON requirements
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lists 
            WHERE lists.id = requirements.list_id 
            AND lists.user_id = auth.uid()
        )
    );

-- Policies for estimations
CREATE POLICY "Users can view estimations for their requirements" ON estimations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = estimations.requirement_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert estimations for their requirements" ON estimations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM requirements r
            JOIN lists l ON l.id = r.list_id
            WHERE r.id = estimations.requirement_id
            AND l.user_id = auth.uid()
        )
        AND auth.uid() = user_id
    );

-- Policies for estimation junction tables
CREATE POLICY "Users can view estimation_activities" ON estimation_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_activities.estimation_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert estimation_activities" ON estimation_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_activities.estimation_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view estimation_drivers" ON estimation_drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_drivers.estimation_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert estimation_drivers" ON estimation_drivers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_drivers.estimation_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view estimation_risks" ON estimation_risks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_risks.estimation_id
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert estimation_risks" ON estimation_risks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimations e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN lists l ON l.id = r.list_id
            WHERE e.id = estimation_risks.estimation_id
            AND l.user_id = auth.uid()
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();