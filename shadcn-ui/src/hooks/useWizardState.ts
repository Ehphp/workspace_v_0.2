import { useState, useEffect, useCallback } from 'react';
import type {
  TechnicalQuestion,
  InterviewAnswer,
  SelectedActivityWithReason,
  SuggestedDriver,
  PreEstimate,
  CandidateProvenanceEntry,
} from '@/types/requirement-interview';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';
import type { ImpactMap } from '@/types/impact-map';
import type { EstimationBlueprint } from '@/types/estimation-blueprint';
import type { RequirementValidationResult } from '@/types/ai-validation';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

/** Project context for AI to avoid redundant questions */
export interface ProjectContext {
  name: string;
  description: string;
  owner?: string;
  defaultTechnologyId?: string;
  projectType?: string;
  domain?: string;
  scope?: string;
  teamSize?: number;
  deadlinePressure?: string;
  methodology?: string;
}

export interface WizardData {
  reqId?: string;
  title?: string;
  description: string;
  technologyId: string;
  techCategory: string;
  selectedActivityCodes: string[];
  aiSuggestedActivityCodes: string[];
  selectedDriverValues: Record<string, string>;
  selectedRiskCodes: string[];
  // New fields for creation
  business_owner?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  // Project context
  projectContext?: ProjectContext;
  // Interview fields
  interviewQuestions?: TechnicalQuestion[];
  interviewAnswers?: Record<string, InterviewAnswer>;
  interviewReasoning?: string;
  estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  activityBreakdown?: SelectedActivityWithReason[];
  suggestedDrivers?: SuggestedDriver[];
  suggestedRisks?: string[];
  confidenceScore?: number;
  // AI analysis from estimation (the reasoning text shown in UI)
  aiAnalysis?: string;
  // Information-gain planner fields
  preEstimate?: PreEstimate;
  plannerDecision?: 'ASK' | 'SKIP';
  // Requirement Validation Gate
  requirementValidation?: RequirementValidationResult;
  // Requirement Understanding artifact (Phase 1c)
  requirementUnderstanding?: RequirementUnderstanding;
  requirementUnderstandingConfirmed?: boolean;
  // Impact Map artifact (Phase 2d)
  impactMap?: ImpactMap;
  impactMapConfirmed?: boolean;
  // Estimation Blueprint artifact
  estimationBlueprint?: EstimationBlueprint;
  estimationBlueprintConfirmed?: boolean;
  // Project Technical Blueprint (project-level architectural baseline)
  projectTechnicalBlueprint?: ProjectTechnicalBlueprint;
  // Rich candidate provenance from CandidateBuilder (for domain save persistence)
  candidateProvenance?: CandidateProvenanceEntry[];
  // DecisionEngine trace (for observability)
  decisionTrace?: Array<{ step: string; action: string; code: string; reason: string; score?: number; layer?: string }>;
  // Coverage report from DecisionEngine
  coverageReport?: { byLayer: Record<string, { covered: boolean; activityCount: number; topScore: number; topCode: string }>; totalSelected: number; totalCandidates: number; gapLayers: string[] };
}

const STORAGE_KEY = 'estimation_wizard_data';

export function useWizardState() {
  const [data, setData] = useState<WizardData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getInitialData();
      }
    }
    return getInitialData();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetData = useCallback(() => {
    setData(getInitialData());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { data, updateData, resetData };
}

function getInitialData(): WizardData {
  return {
    description: '',
    technologyId: '',
    techCategory: '',
    selectedActivityCodes: [],
    aiSuggestedActivityCodes: [],
    selectedDriverValues: {},
    selectedRiskCodes: [],
    priority: 'MEDIUM',
    state: 'PROPOSED',
    business_owner: '',
    // Project context
    projectContext: undefined,
    // Interview fields
    interviewQuestions: undefined,
    interviewAnswers: undefined,
    interviewReasoning: undefined,
    estimatedComplexity: undefined,
    activityBreakdown: undefined,
    suggestedDrivers: undefined,
    suggestedRisks: undefined,
    confidenceScore: undefined,
    aiAnalysis: undefined,
    preEstimate: undefined,
    plannerDecision: undefined,
    // Requirement Validation Gate
    requirementValidation: undefined,
    // Requirement Understanding
    requirementUnderstanding: undefined,
    requirementUnderstandingConfirmed: undefined,
    // Impact Map
    impactMap: undefined,
    impactMapConfirmed: undefined,
    // Estimation Blueprint
    estimationBlueprint: undefined,
    estimationBlueprintConfirmed: undefined,
  };
}