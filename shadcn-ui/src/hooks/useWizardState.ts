import { useState, useEffect, useCallback } from 'react';
import type { NormalizationResult } from '@/lib/openai';
import type { AIActivitySuggestion } from '@/types/estimation';

export interface WizardData {
  reqId?: string;
  title?: string;
  description: string;
  techPresetId: string;
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
    selectedActivityCodes: [],
    aiSuggestedActivityCodes: [],
    selectedDriverValues: {},
    selectedRiskCodes: [],
    priority: 'MEDIUM',
    state: 'PROPOSED',
    business_owner: '',
    normalizationResult: null,
    activitySuggestionResult: null,
  };
}