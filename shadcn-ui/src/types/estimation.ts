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

// Senior Consultant Analysis Types

/**
 * Discrepancy identified by the senior consultant
 */
export interface DiscrepancyItem {
  type: 'missing_coverage' | 'over_engineering' | 'activity_mismatch' | 'driver_issue';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

/**
 * Risk analysis item from senior consultant
 */
export interface RiskAnalysisItem {
  category: 'technical' | 'integration' | 'resource' | 'timeline' | 'requirement_clarity';
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

/**
 * Complete Senior Consultant Analysis
 */
export interface SeniorConsultantAnalysis {
  implementationTips: string; // Markdown formatted
  discrepancies: DiscrepancyItem[];
  riskAnalysis: RiskAnalysisItem[];
  overallAssessment: 'approved' | 'needs_review' | 'concerns';
  estimatedConfidence: number; // 0-100
  generatedAt: string;
}