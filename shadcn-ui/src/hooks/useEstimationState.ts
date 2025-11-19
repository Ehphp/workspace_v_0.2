import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';
import { calculateEstimation } from '@/lib/estimationEngine';

interface UseEstimationStateProps {
    activities: Activity[];
    drivers: Driver[];
    risks: Risk[];
    presets: TechnologyPreset[];
}

interface UseEstimationStateReturn {
    // Selections
    selectedPresetId: string;
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    selectedDriverValues: Record<string, string>; // driver.id -> value
    selectedRiskIds: string[];

    // Actions
    setSelectedPresetId: (id: string) => void;
    toggleActivity: (id: string) => void;
    setDriverValue: (driverId: string, value: string) => void; // Use ID instead of code
    toggleRisk: (id: string) => void;
    applyPreset: (presetId: string) => void;
    applyPresetDefaults: (presetId: string) => void;
    applyAiSuggestions: (activityIds: string[], driverValues?: Record<string, string>, riskIds?: string[]) => void;
    resetSelections: () => void;

    // Computed
    estimationResult: EstimationResult | null;
    selectedPreset: TechnologyPreset | null;
    hasSelections: boolean;
    isValid: boolean;
}

/**
 * Custom hook to manage estimation state and calculations
 * Centralizes all selection logic with memoization for performance
 */
export function useEstimationState({
    activities,
    drivers,
    risks,
    presets,
}: UseEstimationStateProps): UseEstimationStateReturn {
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
    const [aiSuggestedIds, setAiSuggestedIds] = useState<string[]>([]);
    const [selectedDriverValues, setSelectedDriverValues] = useState<Record<string, string>>({});
    const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

    // Memoized selected preset
    const selectedPreset = useMemo(() => {
        return presets.find((p) => p.id === selectedPresetId) || null;
    }, [presets, selectedPresetId]);

    // Memoized toggle handlers
    const toggleActivity = useCallback((activityId: string) => {
        setSelectedActivityIds((prev) =>
            prev.includes(activityId)
                ? prev.filter((id) => id !== activityId)
                : [...prev, activityId]
        );
    }, []);

    const setDriverValue = useCallback((driverId: string, value: string) => {
        setSelectedDriverValues((prev) => ({
            ...prev,
            [driverId]: value, // Use ID as key
        }));
    }, []);

    const toggleRisk = useCallback((riskId: string) => {
        setSelectedRiskIds((prev) =>
            prev.includes(riskId)
                ? prev.filter((id) => id !== riskId)
                : [...prev, riskId]
        );
    }, []);

    // Apply preset (only changes the preset ID, no defaults)
    const applyPreset = useCallback((presetId: string) => {
        setSelectedPresetId(presetId);
    }, []);

    // Apply preset defaults (loads activities, drivers, and risks from preset template)
    const applyPresetDefaults = useCallback((presetId: string) => {
        const preset = presets.find((p) => p.id === presetId);

        if (!preset) return;

        // Convert driver values from code-based to ID-based
        const driverValuesById: Record<string, string> = {};
        if (preset.default_driver_values) {
            Object.entries(preset.default_driver_values).forEach(([code, value]) => {
                const driver = drivers.find(d => d.code === code);
                if (driver) {
                    driverValuesById[driver.id] = value;
                }
            });
        }
        setSelectedDriverValues(driverValuesById);

        // Apply default activities
        const defaultActivityIds = activities
            .filter((a) => preset.default_activity_codes?.includes(a.code))
            .map((a) => a.id);
        setSelectedActivityIds(defaultActivityIds);

        // Apply default risks
        const defaultRiskIds = risks
            .filter((r) => preset.default_risks?.includes(r.code))
            .map((r) => r.id);
        setSelectedRiskIds(defaultRiskIds);

        // Clear AI suggestions when applying preset template
        setAiSuggestedIds([]);
    }, [activities, drivers, risks, presets]);

    // Apply AI suggestions
    const applyAiSuggestions = useCallback((
        activityIds: string[],
        driverValues?: Record<string, string>, // Can be code-based or ID-based
        riskIds?: string[]
    ) => {
        setSelectedActivityIds(activityIds);
        setAiSuggestedIds(activityIds);

        if (driverValues) {
            // Smart conversion: detect if keys are IDs or codes
            const driverValuesById: Record<string, string> = {};
            Object.entries(driverValues).forEach(([keyCodeOrId, value]) => {
                // Check if key is already a valid driver ID
                const isId = drivers.some(d => d.id === keyCodeOrId);
                if (isId) {
                    driverValuesById[keyCodeOrId] = value;
                } else {
                    // Assume it's a code, convert to ID
                    const driver = drivers.find(d => d.code === keyCodeOrId);
                    if (driver) {
                        driverValuesById[driver.id] = value;
                    } else {
                        console.warn(`Driver not found for key: ${keyCodeOrId}`);
                    }
                }
            });
            setSelectedDriverValues(driverValuesById);
        }

        if (riskIds) {
            setSelectedRiskIds(riskIds);
        }
    }, []);

    // Reset all selections
    const resetSelections = useCallback(() => {
        setSelectedPresetId('');
        setSelectedActivityIds([]);
        setAiSuggestedIds([]);
        setSelectedDriverValues({});
        setSelectedRiskIds([]);
    }, []);

    // Validation
    const isValid = useMemo(() => {
        return selectedPresetId !== '' && selectedActivityIds.length > 0;
    }, [selectedPresetId, selectedActivityIds.length]);

    const hasSelections = useMemo(() => {
        return selectedActivityIds.length > 0 ||
            Object.keys(selectedDriverValues).length > 0 ||
            selectedRiskIds.length > 0;
    }, [selectedActivityIds.length, selectedDriverValues, selectedRiskIds.length]);

    // Memoized estimation calculation
    const estimationResult = useMemo(() => {
        if (selectedActivityIds.length === 0) {
            return null;
        }

        // Map selected activities
        const selectedActivities = activities
            .filter((a) => selectedActivityIds.includes(a.id))
            .map((a) => ({
                code: a.code,
                baseDays: a.base_days,
                isAiSuggested: aiSuggestedIds.includes(a.id),
            }));

        // Map selected drivers using ID-based lookup
        const selectedDrivers = Object.entries(selectedDriverValues)
            .map(([driverId, value]) => {
                const driver = drivers.find((d) => d.id === driverId); // Lookup by ID
                const option = driver?.options.find((o) => o.value === value);
                return option ? {
                    code: driver.code,
                    value,
                    multiplier: option.multiplier,
                } : null;
            })
            .filter((d): d is NonNullable<typeof d> => d !== null);

        // Map selected risks
        const selectedRisks = risks
            .filter((r) => selectedRiskIds.includes(r.id))
            .map((r) => ({
                code: r.code,
                weight: r.weight,
            }));

        // Calculate estimation
        return calculateEstimation({
            activities: selectedActivities,
            drivers: selectedDrivers,
            risks: selectedRisks,
        });
    }, [
        selectedActivityIds,
        selectedDriverValues,
        selectedRiskIds,
        activities,
        drivers,
        risks,
        aiSuggestedIds,
    ]);

    return {
        // State
        selectedPresetId,
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,

        // Actions
        setSelectedPresetId,
        toggleActivity,
        setDriverValue,
        toggleRisk,
        applyPreset,
        applyPresetDefaults,
        applyAiSuggestions,
        resetSelections,

        // Computed
        estimationResult,
        selectedPreset,
        hasSelections,
        isValid,
    };
}
