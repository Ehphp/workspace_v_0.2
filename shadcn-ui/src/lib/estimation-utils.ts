/**
 * Estimation Utilities
 * 
 * Provides unified estimation finalization across all entry points.
 * Ensures consistent application of drivers and risks regardless of the
 * estimation flow (Quick Estimate, Wizard Interview, Bulk Interview).
 */

import { calculateEstimation } from './estimationEngine';
import type {
    EstimationInput,
    EstimationResult,
    SelectedActivity,
    SelectedDriver,
    SelectedRisk
} from '@/types/estimation';
import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';

/**
 * Input for finalizing an estimation with preset defaults
 */
export interface FinalizeEstimationInput {
    /** Activity codes selected (by AI or user) */
    activityCodes: string[];
    /** Whether each activity was AI-suggested */
    isAiSuggested?: boolean;
    /** Full activity catalog to look up base_hours */
    activities: Activity[];
    /** Driver values to apply (code -> value). Falls back to preset defaults if not provided */
    driverValues?: Record<string, string>;
    /** Risk codes to apply. Falls back to preset defaults if not provided */
    riskCodes?: string[];
    /** Technology preset for defaults */
    preset?: TechnologyPreset;
    /** Full driver catalog to look up multipliers */
    drivers: Driver[];
    /** Full risk catalog to look up weights */
    risks: Risk[];
    /** AI-suggested driver values (from interview) */
    suggestedDrivers?: Array<{ code: string; suggestedValue: string }>;
    /** AI-suggested risk codes (from interview) */
    suggestedRisks?: string[];
}

/**
 * Extended estimation result with metadata
 */
export interface FinalizedEstimation extends EstimationResult {
    /** Source of driver values: 'preset' | 'suggested' | 'manual' */
    driverSource: 'preset' | 'suggested' | 'manual';
    /** Source of risk values: 'preset' | 'suggested' | 'manual' */
    riskSource: 'preset' | 'suggested' | 'manual';
    /** Selected activities with full details */
    selectedActivities: Array<{
        code: string;
        name: string;
        baseHours: number;
        isAiSuggested: boolean;
    }>;
    /** Applied driver values */
    appliedDrivers: SelectedDriver[];
    /** Applied risks */
    appliedRisks: SelectedRisk[];
}

/**
 * Finalize an estimation by applying consistent driver and risk values.
 * 
 * Priority for drivers:
 * 1. Explicit driverValues parameter
 * 2. AI suggestedDrivers (from interview)
 * 3. preset.default_driver_values
 * 4. First option of each driver (neutral)
 * 
 * Priority for risks:
 * 1. Explicit riskCodes parameter
 * 2. AI suggestedRisks (from interview)
 * 3. preset.default_risks
 * 4. Empty (no risks)
 * 
 * @param input - Finalization parameters
 * @returns Complete estimation result with metadata
 */
export function finalizeEstimation(input: FinalizeEstimationInput): FinalizedEstimation {
    const {
        activityCodes,
        isAiSuggested = true,
        activities,
        driverValues,
        riskCodes,
        preset,
        drivers,
        risks,
        suggestedDrivers,
        suggestedRisks,
    } = input;

    // 1. Map activity codes to SelectedActivity
    const selectedActivities: SelectedActivity[] = activityCodes
        .map(code => {
            const activity = activities.find(a => a.code === code);
            if (!activity) return null;
            return {
                code,
                baseHours: activity.base_hours,
                isAiSuggested,
            };
        })
        .filter((a): a is SelectedActivity => a !== null);

    // Build activity details for metadata
    const activityDetails = activityCodes
        .map(code => {
            const activity = activities.find(a => a.code === code);
            if (!activity) return null;
            return {
                code,
                name: activity.name,
                baseHours: activity.base_hours,
                isAiSuggested,
            };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

    // 2. Determine driver values with priority cascade
    let appliedDriverValues: Record<string, string> = {};
    let driverSource: 'preset' | 'suggested' | 'manual' = 'preset';

    if (driverValues && Object.keys(driverValues).length > 0) {
        // Explicit values provided
        appliedDriverValues = driverValues;
        driverSource = 'manual';
    } else if (suggestedDrivers && suggestedDrivers.length > 0) {
        // AI suggestions from interview
        appliedDriverValues = suggestedDrivers.reduce((acc, d) => {
            acc[d.code] = d.suggestedValue;
            return acc;
        }, {} as Record<string, string>);
        driverSource = 'suggested';
    } else if (preset?.default_driver_values) {
        // Preset defaults
        appliedDriverValues = preset.default_driver_values;
        driverSource = 'preset';
    }

    // Map to SelectedDriver with multipliers
    const selectedDrivers: SelectedDriver[] = drivers
        .map(driver => {
            const value = appliedDriverValues[driver.code];
            if (!value) {
                // Use first option as neutral default
                const firstOption = driver.options[0];
                if (!firstOption) return null;
                return {
                    code: driver.code,
                    value: firstOption.value,
                    multiplier: firstOption.multiplier,
                };
            }
            const option = driver.options.find(o => o.value === value);
            if (!option) return null;
            return {
                code: driver.code,
                value,
                multiplier: option.multiplier,
            };
        })
        .filter((d): d is SelectedDriver => d !== null);

    // 3. Determine risk codes with priority cascade
    let appliedRiskCodes: string[] = [];
    let riskSource: 'preset' | 'suggested' | 'manual' = 'preset';

    if (riskCodes && riskCodes.length > 0) {
        appliedRiskCodes = riskCodes;
        riskSource = 'manual';
    } else if (suggestedRisks && suggestedRisks.length > 0) {
        appliedRiskCodes = suggestedRisks;
        riskSource = 'suggested';
    } else if (preset?.default_risks) {
        appliedRiskCodes = preset.default_risks;
        riskSource = 'preset';
    }

    // Map to SelectedRisk with weights
    const selectedRisks: SelectedRisk[] = appliedRiskCodes
        .map(code => {
            const risk = risks.find(r => r.code === code);
            if (!risk) return null;
            return {
                code,
                weight: risk.weight,
            };
        })
        .filter((r): r is SelectedRisk => r !== null);

    // 4. Calculate estimation
    const estimationInput: EstimationInput = {
        activities: selectedActivities,
        drivers: selectedDrivers,
        risks: selectedRisks,
    };

    const result = calculateEstimation(estimationInput);

    // 5. Return with metadata
    return {
        ...result,
        driverSource,
        riskSource,
        selectedActivities: activityDetails,
        appliedDrivers: selectedDrivers,
        appliedRisks: selectedRisks,
    };
}

/**
 * Quick estimation with preset defaults applied.
 * Use this for Quick Estimate flow where drivers/risks come from preset.
 */
export function quickFinalizeEstimation(
    activityCodes: string[],
    activities: Activity[],
    preset: TechnologyPreset,
    drivers: Driver[],
    risks: Risk[]
): FinalizedEstimation {
    return finalizeEstimation({
        activityCodes,
        isAiSuggested: true,
        activities,
        preset,
        drivers,
        risks,
    });
}

/**
 * Interview estimation with AI suggestions applied.
 * Use this for Wizard Interview flow where AI suggests drivers/risks.
 */
export function interviewFinalizeEstimation(
    activityCodes: string[],
    activities: Activity[],
    drivers: Driver[],
    risks: Risk[],
    suggestedDrivers?: Array<{ code: string; suggestedValue: string }>,
    suggestedRisks?: string[],
    preset?: TechnologyPreset
): FinalizedEstimation {
    return finalizeEstimation({
        activityCodes,
        isAiSuggested: true,
        activities,
        drivers,
        risks,
        suggestedDrivers,
        suggestedRisks,
        preset, // Fallback if no suggestions
    });
}
