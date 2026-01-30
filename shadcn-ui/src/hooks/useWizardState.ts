import { useState, useEffect, useCallback } from 'react';
import type { NormalizationResult } from '@/lib/openai';
import type { AIActivitySuggestion } from '@/types/estimation';
import type {
  TechnicalQuestion,
  InterviewAnswer,
  SelectedActivityWithReason,
  SuggestedDriver
} from '@/types/requirement-interview';

/** Project context for AI to avoid redundant questions */
export interface ProjectContext {
  name: string;
  description: string;
  owner?: string;
  defaultTechPresetId?: string;
}

export interface WizardData {
  reqId?: string;
  title?: string;
  description: string;
  techPresetId: string;
  techCategory: string;
  selectedActivityCodes: string[];
  aiSuggestedActivityCodes: string[];
  selectedDriverValues: Record<string, string>;
  selectedRiskCodes: string[];
  // New fields for creation
  business_owner?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  normalizationResult?: NormalizationResult | null;
  activitySuggestionResult?: AIActivitySuggestion | null;
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
    techPresetId: '',
    techCategory: '',
    selectedActivityCodes: [],
    aiSuggestedActivityCodes: [],
    selectedDriverValues: {},
    selectedRiskCodes: [],
    priority: 'MEDIUM',
    state: 'PROPOSED',
    business_owner: '',
    normalizationResult: null,
    activitySuggestionResult: null,
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
  };
}