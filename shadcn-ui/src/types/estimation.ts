// Re-export domain estimation types so frontend imports remain unchanged.
export type {
  SelectedActivity,
  SelectedDriver,
  SelectedRisk,
  EstimationInput,
  EstimationResult,
} from '../../netlify/functions/lib/domain/types/estimation';

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