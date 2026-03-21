/**
 * Domain estimation types — the canonical source of truth.
 *
 * These types define the contract for the pure estimation engine.
 * They live in the domain layer so backend code never imports from src/.
 *
 * Frontend consumers should import from '@/types/estimation',
 * which re-exports everything from here.
 */

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
