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
  tech_category: string;
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
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  is_custom?: boolean;
  created_by?: string | null;
}

export interface List {
  id: string;
  user_id: string; // Now acts as "created_by"
  organization_id: string; // New owner field
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
  created_at: string;
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
