// Estimation engine types

export interface SelectedActivity {
  code: string;
  baseHours: number;
  isAiSuggested: boolean;
}

export interface SelectedDriver {
  code: string;
  value: string;
  multiplier: number;
}

export interface SelectedRisk {
  code: string;
  weight: number;
}

export interface EstimationInput {
  activities: SelectedActivity[];
  drivers: SelectedDriver[];
  risks: SelectedRisk[];
}

export interface EstimationResult {
  baseDays: number;
  driverMultiplier: number;
  subtotal: number;
  riskScore: number;
  contingencyPercent: number;
  contingencyDays: number;
  totalDays: number;
  breakdown: {
    byGroup: Record<string, number>;
    byTech: Record<string, number>;
  };
}

export interface AIActivitySuggestion {
  isValidRequirement: boolean;
  activityCodes: string[];
  suggestedDrivers?: Record<string, string>;
  suggestedRisks?: string[];
  reasoning?: string;
  generatedTitle?: string;
}