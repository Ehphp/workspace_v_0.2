import { useState, useEffect } from 'react';

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

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const resetData = () => {
    setData(getInitialData());
    localStorage.removeItem(STORAGE_KEY);
  };

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
  };
}