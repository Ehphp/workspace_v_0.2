-- Create technologies table
CREATE TABLE IF NOT EXISTS technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default technologies
INSERT INTO technologies (code, name, description, color, sort_order)
VALUES
    ('POWER_PLATFORM', 'Power Platform', 'Microsoft Power Platform development', '#742774', 10),
    ('BACKEND', 'Backend API', 'Backend services and API development', '#000000', 20),
    ('FRONTEND', 'Frontend', 'Web and mobile frontend development', '#3b82f6', 30),
    ('MULTI', 'Multi-stack', 'Cross-cutting or full-stack activities', '#64748b', 99)
ON CONFLICT (code) DO NOTHING;

-- Fix type mismatch: Convert tech_category from enum/varchar to TEXT to match technologies.code
DO $$
BEGIN
    -- Convert activities.tech_category to TEXT if it's not already
    -- This handles the "incompatible types: tech_category and text" error
    ALTER TABLE activities 
    ALTER COLUMN tech_category TYPE TEXT USING tech_category::TEXT;

    -- Also convert technology_presets.tech_category for consistency
    ALTER TABLE technology_presets 
    ALTER COLUMN tech_category TYPE TEXT USING tech_category::TEXT;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error converting columns: %', SQLERRM;
END $$;

-- Add foreign key to activities table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'activities_tech_category_fkey'
    ) THEN
        ALTER TABLE activities
        ADD CONSTRAINT activities_tech_category_fkey
        FOREIGN KEY (tech_category)
        REFERENCES technologies(code)
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key to technology_presets table (optional but recommended)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'technology_presets_tech_category_fkey'
    ) THEN
        ALTER TABLE technology_presets
        ADD CONSTRAINT technology_presets_tech_category_fkey
        FOREIGN KEY (tech_category)
        REFERENCES technologies(code)
        ON UPDATE CASCADE;
    END IF;
END $$;
