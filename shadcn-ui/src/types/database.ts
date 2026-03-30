// Database types matching Supabase schema

export interface Organization {
  id: string;
  name: string;
  type: 'personal' | 'team';
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export interface Activity {
  id: string;
  code: string;
  name: string;
  description: string;
  base_hours: number;
  /** Canonical FK to technologies.id — preferred over tech_category */
  technology_id: string | null;
  /** @deprecated Use technology_id FK instead. Kept for backward compatibility. */
  tech_category: string;
  group: 'ANALYSIS' | 'DEV' | 'TEST' | 'OPS' | 'GOVERNANCE';
  active: boolean;
  is_custom?: boolean;
  base_activity_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

// Pivot table linking activities to technologies with optional overrides
export interface TechnologyActivity {
  technology_id: string;
  activity_id: string;
  position: number | null;
  name_override: string | null;
  description_override: string | null;
  base_hours_override: number | null;
}

/** @deprecated Use TechnologyActivity instead */
export type TechnologyPresetActivity = TechnologyActivity;

// Activity with resolved values (base + override applied)
export interface ActivityWithOverride extends Activity {
  // Original values from base activity (for reference/reset)
  original_name: string;
  original_description: string;
  original_base_hours: number;
  // Whether this activity has been customized for this technology
  has_override: boolean;
  // The override values (null if using base)
  name_override: string | null;
  description_override: string | null;
  base_hours_override: number | null;
}

export interface DriverOption {
  value: string;
  label: string;
  multiplier: number;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  description: string;
  options: DriverOption[];
  created_at: string;
}

export interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  created_at: string;
}

export interface Technology {
  id: string;
  code: string;
  name: string;
  description: string;
  tech_category: string; // matches code for system technologies
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  is_custom?: boolean;
  created_by?: string | null;
}

/** @deprecated Use Technology instead */
export type TechnologyPreset = Technology & {
  default_driver_values: Record<string, string>;
  default_risks: string[];
  default_activity_codes: string[];
};

export type ProjectType = 'NEW_DEVELOPMENT' | 'MAINTENANCE' | 'MIGRATION' | 'INTEGRATION' | 'REFACTORING';
export type ProjectScope = 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
export type DeadlinePressure = 'RELAXED' | 'NORMAL' | 'TIGHT' | 'CRITICAL';
export type Methodology = 'AGILE' | 'WATERFALL' | 'HYBRID';

export interface Project {
  id: string;
  user_id: string; // Now acts as "created_by"
  organization_id: string; // New owner field
  name: string;
  description: string;
  owner: string;
  technology_id: string | null; // Default technology for requirements in this project
  /** @deprecated Use technology_id */
  tech_preset_id?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  // Project context enrichment fields (all optional)
  project_type?: ProjectType | null;
  domain?: string | null;
  scope?: ProjectScope | null;
  team_size?: number | null;
  deadline_pressure?: DeadlinePressure | null;
  methodology?: Methodology | null;
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  req_id: string;
  title: string;
  description: string;
  technology_id: string;
  /** @deprecated Use technology_id */
  tech_preset_id?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner: string;
  labels: string[];
  assigned_estimation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Estimation {
  id: string;
  requirement_id: string;
  user_id: string;
  total_days: number;
  base_hours: number;
  driver_multiplier: number;
  risk_score: number;
  contingency_percent: number;
  scenario_name: string;
  ai_reasoning?: string | null;
  senior_consultant_analysis?: Record<string, unknown> | null;
  blueprint_id?: string | null;
  analysis_id?: string | null;
  decision_id?: string | null;
  created_at: string;
  // Consuntivo (actual) fields — Sprint 2
  actual_hours: number | null;
  actual_start_date: string | null;   // ISO date
  actual_end_date: string | null;     // ISO date
  actual_notes: string | null;
  actual_recorded_at: string | null;  // ISO timestamp
  actual_recorded_by: string | null;  // user UUID
}

export interface EstimationActivity {
  id: string;
  estimation_id: string;
  activity_id: string;
  is_ai_suggested: boolean;
  is_done: boolean;
  notes: string;
}

export interface EstimationDriver {
  id: string;
  estimation_id: string;
  driver_id: string;
  selected_value: string;
}

export interface EstimationRisk {
  id: string;
  estimation_id: string;
  risk_id: string;
}

export interface RequirementDriverValue {
  id: string;
  requirement_id: string;
  driver_id: string;
  selected_value: string;
  source?: 'PRESET' | 'USER';
  created_at: string;
  updated_at: string;
}

export interface RequirementUnderstandingRow {
  id: string;
  requirement_id: string | null;
  understanding: Record<string, unknown>;
  input_description: string;
  input_tech_category: string | null;
  user_id: string;
  version: number;
  created_at: string;
}

export interface ImpactMapRow {
  id: string;
  requirement_id: string | null;
  impact_map: Record<string, unknown>;
  input_description: string;
  input_tech_category: string | null;
  has_requirement_understanding: boolean;
  user_id: string;
  version: number;
  created_at: string;
}

export interface EstimationBlueprintRow {
  id: string;
  requirement_id: string | null;
  blueprint: Record<string, unknown>;
  input_description: string;
  input_tech_category: string | null;
  based_on_understanding_id: string | null;
  based_on_impact_map_id: string | null;
  confidence_score: number | null;
  user_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// Extended types with joins
export interface RequirementWithEstimation extends Requirement {
  latest_estimation: Estimation | null;
  assigned_estimation?: EstimationWithDetails | null;
}

export interface EstimationWithDetails extends Estimation {
  estimation_activities?: EstimationActivity[];
  estimation_drivers?: EstimationDriver[];
  estimation_risks?: EstimationRisk[];
}
