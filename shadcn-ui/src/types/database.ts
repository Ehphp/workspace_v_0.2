// Database types matching Supabase schema

export interface Activity {
  id: string;
  code: string;
  name: string;
  description: string;
  base_days: number;
  tech_category: 'POWER_PLATFORM' | 'BACKEND' | 'FRONTEND' | 'MULTI';
  group: 'ANALYSIS' | 'DEV' | 'TEST' | 'OPS' | 'GOVERNANCE';
  active: boolean;
  is_custom?: boolean;
  base_activity_id?: string | null;
  created_by?: string | null;
  created_at: string;
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

export interface TechnologyPreset {
  id: string;
  code: string;
  name: string;
  description: string;
  tech_category: string;
  default_driver_values: Record<string, string>;
  default_risks: string[];
  default_activity_codes: string[];
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  name: string;
  description: string;
  owner: string;
  tech_preset_id: string | null; // Default technology for requirements in this list
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  id: string;
  list_id: string;
  req_id: string;
  title: string;
  description: string;
  tech_preset_id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface Estimation {
  id: string;
  requirement_id: string;
  user_id: string;
  total_days: number;
  base_days: number;
  driver_multiplier: number;
  risk_score: number;
  contingency_percent: number;
  scenario_name: string;
  created_at: string;
}

export interface EstimationActivity {
  id: string;
  estimation_id: string;
  activity_id: string;
  is_ai_suggested: boolean;
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

// Extended types with joins
export interface RequirementWithEstimation extends Requirement {
  latest_estimation: Estimation | null;
}

export interface EstimationWithDetails extends Estimation {
  activities?: EstimationActivity[];
  drivers?: EstimationDriver[];
  risks?: EstimationRisk[];
}
