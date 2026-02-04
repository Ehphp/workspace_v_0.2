-- Migration: Add USU Technology Preset
-- Description: Adds a default Technology Preset for USU.

INSERT INTO technology_presets (code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes)
VALUES (
    'TECH_USU_STANDARD',
    'USU – Standard',
    'Preset standard per progetti USU Service Management.',
    'USU',
    '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
    '["R_INTEG_EXT", "R_DEPENDENCIES"]'::jsonb,
    '["USU_ACTION_PLUGIN", "USU_DYN_FORM", "USU_JOB_SCHED", "USU_API_INT", "USU_WORKFLOW", "USU_LIST_VIEW", "USU_DOCS"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tech_category = EXCLUDED.tech_category,
    default_driver_values = EXCLUDED.default_driver_values,
    default_risks = EXCLUDED.default_risks,
    default_activity_codes = EXCLUDED.default_activity_codes;
