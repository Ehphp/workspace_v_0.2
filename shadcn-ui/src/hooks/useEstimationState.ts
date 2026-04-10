import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type { Technology, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';
import { calculateEstimation } from '@/lib/estimationEngine';
import { isActivityCompatible } from '@/lib/technology-helpers';

interface UseEstimationStateProps {
    activities: Activity[];
    drivers: Driver[];
    risks: Risk[];
    technologies: Technology[];
    /** @deprecated Use technologies */
    presets?: Technology[];
}

export interface UseEstimationStateReturn {
    // Selections
    selectedTechnologyId: string;
    /** @deprecated Use selectedTechnologyId */
    selectedPresetId: string;
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    selectedDriverValues: Record<string, string>; // driver.id -> value
    selectedRiskIds: string[];

    // Actions
    setSelectedTechnologyId: (id: string) => void;
    /** @deprecated Use setSelectedTechnologyId */
    setSelectedPresetId: (id: string) => void;
    toggleActivity: (id: string) => void;
    setDriverValue: (driverId: string, value: string) => void;
    setDriverValues: (values: Record<string, string>) => void;
    toggleRisk: (id: string) => void;
    selectTechnology: (technologyId: string) => void;
    /** @deprecated Use selectTechnology */
    applyPreset: (presetId: string) => void;
    /** @deprecated No-op: templates removed */
    applyPresetDefaults: (presetId: string) => void;
    applyAiSuggestions: (activityIds: string[], driverValues?: Record<string, string>, riskIds?: string[]) => void;
    hydrateFromEstimation: (params: {
        activityIds: string[];
        aiSuggestedActivityIds: string[];
        driverValues: Record<string, string>;
        riskIds: string[];
    }) => void;
    resetSelections: () => void;

    // Computed
    estimationResult: EstimationResult | null;
    selectedTechnology: Technology | null;
    /** @deprecated Use selectedTechnology */
    selectedPreset: Technology | null;
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
    technologies,
    presets,
}: UseEstimationStateProps): UseEstimationStateReturn {
    const techs = technologies || presets || [];
    const [selectedTechnologyId, setSelectedTechnologyId] = useState<string>('');
    const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
    const [aiSuggestedIds, setAiSuggestedIds] = useState<string[]>([]);
    const [selectedDriverValues, setSelectedDriverValues] = useState<Record<string, string>>({});
    const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

    // Memoized selected technology
    const selectedTechnology = useMemo(() => {
        return techs.find((t) => t.id === selectedTechnologyId) || null;
    }, [techs, selectedTechnologyId]);

    // Check if an activity is compatible with the selected technology (canonical FK check)
    const isActivityAllowed = useCallback((activity: Activity | undefined) => {
        if (!activity) return false;
        return isActivityCompatible(activity, selectedTechnology, techs);
    }, [selectedTechnology, techs]);

    // Memoized toggle handlers
    const toggleActivity = useCallback((activityId: string) => {
        const activity = activities.find((a) => a.id === activityId);
        if (!isActivityAllowed(activity)) {
            toast.error('Attività non compatibile con la tecnologia selezionata.');
            return;
        }

        setSelectedActivityIds((prev) =>
            prev.includes(activityId)
                ? prev.filter((id) => id !== activityId)
                : [...prev, activityId]
        );
    }, [activities, isActivityAllowed]);

    const setDriverValue = useCallback((driverId: string, value: string) => {
        setSelectedDriverValues((prev) => ({
            ...prev,
            [driverId]: value, // Use ID as key
        }));
    }, []);

    const setDriverValues = useCallback((values: Record<string, string>) => {
        setSelectedDriverValues(values);
    }, []);

    const toggleRisk = useCallback((riskId: string) => {
        setSelectedRiskIds((prev) =>
            prev.includes(riskId)
                ? prev.filter((id) => id !== riskId)
                : [...prev, riskId]
        );
    }, []);

    // Select technology (just changes the ID)
    const selectTechnology = useCallback((technologyId: string) => {
        setSelectedTechnologyId(technologyId);
    }, []);

    /** @deprecated No-op: preset templates removed. Use AI suggestions instead. */
    const applyPresetDefaults = useCallback((_presetId: string) => {
        console.warn('[useEstimationState] applyPresetDefaults is deprecated. Preset templates have been removed. Use AI suggestions instead.');
    }, []);

    // Apply AI suggestions
    const applyAiSuggestions = useCallback((
        activityIds: string[],
        driverValues?: Record<string, string>, // Can be code-based or ID-based
        riskIds?: string[]
    ) => {
        // Allow any activity compatible with the selected technology (canonical FK check)
        const allowedActivityIds = activityIds.filter((id) => {
            const activity = activities.find((a) => a.id === id);
            if (!activity) return false;
            return isActivityCompatible(activity, selectedTechnology, techs);
        });

        const removed = activityIds.length - allowedActivityIds.length;
        if (removed > 0) {
            console.warn(`[applyAiSuggestions] Removed ${removed} activities outside technology ${selectedTechnology?.code}`);
        }

        setSelectedActivityIds(allowedActivityIds);
        setAiSuggestedIds(allowedActivityIds);

        // ✅ FIX: Reset drivers/risks if undefined (instead of keeping previous values)
        if (driverValues !== undefined) {
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
        } else {
            // Reset drivers if undefined
            setSelectedDriverValues({});
        }

        if (riskIds !== undefined) {
            setSelectedRiskIds(riskIds);
        } else {
            // Reset risks if undefined
            setSelectedRiskIds([]);
        }
    }, [activities, drivers, selectedTechnology]);

    // Hydrate state from a saved estimation (assigned or latest)
    // Unlike applyAiSuggestions, this preserves the original AI-suggested flags
    const hydrateFromEstimation = useCallback((params: {
        activityIds: string[];
        aiSuggestedActivityIds: string[];
        driverValues: Record<string, string>;
        riskIds: string[];
    }) => {
        const { activityIds, aiSuggestedActivityIds, driverValues, riskIds } = params;

        // Filter activities by technology compatibility
        const allowedActivityIds = activityIds.filter((id) => {
            const activity = activities.find((a) => a.id === id);
            if (!activity) return false;
            return isActivityCompatible(activity, selectedTechnology, techs);
        });

        const removed = activityIds.length - allowedActivityIds.length;
        if (removed > 0) {
            console.warn(`[hydrateFromEstimation] Removed ${removed} activities outside technology ${selectedTechnology?.code}`);
        }

        setSelectedActivityIds(allowedActivityIds);
        // Only mark activities that were originally AI-suggested
        setAiSuggestedIds(aiSuggestedActivityIds.filter(id => allowedActivityIds.includes(id)));
        setSelectedDriverValues(driverValues);
        setSelectedRiskIds(riskIds);
    }, [activities, selectedTechnology, techs]);

    // Reset all selections
    const resetSelections = useCallback(() => {
        setSelectedTechnologyId('');
        setSelectedActivityIds([]);
        setAiSuggestedIds([]);
        setSelectedDriverValues({});
        setSelectedRiskIds([]);
    }, []);

    // Validation
    const isValid = useMemo(() => {
        return selectedTechnologyId !== '' && selectedActivityIds.length > 0;
    }, [selectedTechnologyId, selectedActivityIds.length]);

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
                baseHours: a.base_hours,
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
        selectedTechnologyId,
        selectedPresetId: selectedTechnologyId, // backward compat
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,

        // Actions
        setSelectedTechnologyId,
        setSelectedPresetId: setSelectedTechnologyId, // backward compat
        toggleActivity,
        setDriverValue,
        setDriverValues,
        toggleRisk,
        selectTechnology,
        applyPreset: selectTechnology, // backward compat
        applyPresetDefaults,
        applyAiSuggestions,
        hydrateFromEstimation,
        resetSelections,

        // Computed
        estimationResult,
        selectedTechnology,
        selectedPreset: selectedTechnology, // backward compat
        hasSelections,
        isValid,
    };
}
