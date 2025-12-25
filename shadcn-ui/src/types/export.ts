/**
 * Export Types and Interfaces
 * Defines all types used by the export system
 */

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeDescription: boolean;
  includeActivities: boolean;
  includeDrivers: boolean;
  includeRisks: boolean;
  includeHistory: boolean;
  includeAiReasoning: boolean;
  projectName?: string;
  generatedAt?: Date;
}

export interface ExportableActivity {
  code: string;
  name: string;
  group: string;
  hours: number;
  isAiSuggested: boolean;
}

export interface ExportableDriver {
  code: string;
  name: string;
  value: string;
  label: string;
  multiplier: number;
}

export interface ExportableRisk {
  code: string;
  name: string;
  weight: number;
}

export interface ExportableEstimation {
  requirement: {
    id: string;
    reqId: string;
    title: string;
    description?: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    state: string;
    businessOwner?: string;
  };
  estimation: {
    totalDays: number;
    baseDays: number;
    driverMultiplier: number;
    subtotal: number;
    riskScore: number;
    contingencyPercent: number;
    contingencyDays: number;
    createdAt?: string;
    scenarioName?: string;
  };
  technology?: {
    name: string;
    category: string;
  };
  activities: ExportableActivity[];
  drivers: ExportableDriver[];
  risks: ExportableRisk[];
  aiReasoning?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  blob?: Blob;
  error?: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  includeDescription: true,
  includeActivities: true,
  includeDrivers: true,
  includeRisks: true,
  includeHistory: false,
  includeAiReasoning: false,
};

// Group labels for activities
export const ACTIVITY_GROUP_LABELS: Record<string, string> = {
  ANALYSIS: 'Analisi',
  DEV: 'Sviluppo',
  TEST: 'Testing',
  OPS: 'Operations',
  GOVERNANCE: 'Governance',
};

// Priority labels
export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Bassa',
};

// State labels
export const STATE_LABELS: Record<string, string> = {
  PROPOSED: 'Proposto',
  SELECTED: 'Selezionato',
  SCHEDULED: 'Pianificato',
  DONE: 'Completato',
};
