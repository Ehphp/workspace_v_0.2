import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_TECHNOLOGY_PRESETS, MOCK_ACTIVITIES, MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import { quickFinalizeEstimation } from '@/lib/estimation-utils';
import { suggestActivities } from '@/lib/openai';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';
import type { FinalizedEstimation } from '@/lib/estimation-utils';

export function useQuickEstimation() {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [result, setResult] = useState<FinalizedEstimation | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedActivities, setSelectedActivities] = useState<Array<{ code: string; name: string; baseHours: number }>>([]);
    const [aiReasoning, setAiReasoning] = useState<string>('');

    const [presets, setPresets] = useState<TechnologyPreset[]>([]);
    const [presetActivities, setPresetActivities] = useState<Record<string, { activity_id: string; position: number | null }[]>>({});

    const loadPresets = async () => {
        setLoading(true);
        try {
            type PivotRow = { tech_preset_id: string; activity_id: string; position: number | null };

            const [{ data: presetsData, error: presetsError }, { data: pivotData, error: pivotError }] = await Promise.all([
                supabase
                    .from('technology_presets')
                    .select('*')
                    .order('name'),
                supabase
                    .from('technology_preset_activities')
                    .select('tech_preset_id, activity_id, position'),
            ]);

            if (presetsError || !presetsData || presetsData.length === 0) {
                setPresets(MOCK_TECHNOLOGY_PRESETS);
                setIsDemoMode(true);
            } else {
                setPresets(presetsData);
                setIsDemoMode(false);
                if (!pivotError && pivotData) {
                    const grouped: Record<string, { activity_id: string; position: number | null }[]> = {};
                    (pivotData as PivotRow[]).forEach((row) => {
                        const position = row.position ?? null;
                        if (!grouped[row.tech_preset_id]) grouped[row.tech_preset_id] = [];
                        grouped[row.tech_preset_id].push({
                            activity_id: row.activity_id,
                            position,
                        });
                    });
                    setPresetActivities(grouped);
                }
            }
        } catch (error) {
            setPresets(MOCK_TECHNOLOGY_PRESETS);
            setIsDemoMode(true);
        }
        setLoading(false);
    };

    const calculate = async (description: string, techPresetId: string) => {
        if (!description.trim() || !techPresetId) return;

        if (description.trim().length < 10) {
            setError('Please provide a more detailed description (at least 10 characters).');
            return false;
        }

        const selectedPreset = presets.find(p => p.id === techPresetId);
        if (!selectedPreset) return false;

        setCalculating(true);
        setError(null);

        try {
            const [activitiesResult, driversResult, risksResult] = await Promise.all([
                supabase.from('activities').select('*').eq('active', true),
                supabase.from('drivers').select('*'),
                supabase.from('risks').select('*'),
            ]);

            let allActivities: Activity[];
            let allDrivers: Driver[];
            let allRisks: Risk[];

            if (activitiesResult.error || !activitiesResult.data || activitiesResult.data.length === 0 ||
                driversResult.error || !driversResult.data || driversResult.data.length === 0 ||
                risksResult.error || !risksResult.data || risksResult.data.length === 0) {
                allActivities = MOCK_ACTIVITIES;
                allDrivers = MOCK_DRIVERS;
                allRisks = MOCK_RISKS;
            } else {
                allActivities = activitiesResult.data;
                allDrivers = driversResult.data;
                allRisks = risksResult.data;
            }

            const allowedActivities = allActivities.filter(
                (a) => a.tech_category === selectedPreset.tech_category || a.tech_category === 'MULTI'
            );

            if (allowedActivities.length === 0) {
                setError('No activities available for the selected technology preset. Please choose another preset.');
                return false;
            }

            const activityById = new Map(allowedActivities.map((a) => [a.id, a]));
            const defaultCodesFromPivot = (() => {
                const rows = presetActivities[selectedPreset.id] || [];
                if (rows.length === 0) return selectedPreset.default_activity_codes || [];
                return rows
                    .sort((a, b) => {
                        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                        return pa - pb;
                    })
                    .map((row) => activityById.get(row.activity_id)?.code)
                    .filter((code): code is string => Boolean(code));
            })();

            const aiSuggestion = await suggestActivities({
                description,
                preset: selectedPreset,
                activities: allowedActivities,
            });

            if (!aiSuggestion.isValidRequirement) {
                setError(aiSuggestion.reasoning || 'The requirement description is not valid for estimation. Please provide a clearer technical target.');
                setResult(null);
                setSelectedActivities([]);
                setAiReasoning(aiSuggestion.reasoning || '');
                return false;
            }

            let chosenCodes: string[] = [];
            let reasoning = aiSuggestion.reasoning || '';

            if (aiSuggestion.activityCodes && aiSuggestion.activityCodes.length > 0) {
                chosenCodes = aiSuggestion.activityCodes.filter((code) =>
                    allowedActivities.some((a) => a.code === code)
                );
                if (chosenCodes.length === 0) {
                    reasoning = 'Suggested activities are not compatible with the selected technology. Falling back to preset defaults.';
                }
            }

            if (chosenCodes.length === 0) {
                chosenCodes = defaultCodesFromPivot;
                if (chosenCodes.length === 0) {
                    setError(
                        aiSuggestion.reasoning ||
                        'No compatible activities found for this preset. Please provide more details or choose another preset.'
                    );
                    return false;
                }
            }

            const activitiesWithDetails = chosenCodes.map((code) => {
                const activity = allowedActivities.find((a) => a.code === code);
                return {
                    code,
                    name: activity?.name || code,
                    baseHours: activity?.base_hours || 0,
                };
            });

            // Use finalizeEstimation with preset defaults for drivers and risks
            const estimationResult = quickFinalizeEstimation(
                chosenCodes,
                allActivities,
                selectedPreset,
                allDrivers,
                allRisks
            );

            setResult(estimationResult);
            setSelectedActivities(activitiesWithDetails);
            setAiReasoning(reasoning);
            return true;
        } catch (err) {
            console.error('Error calculating quick estimate:', err);
            setError(err instanceof Error ? err.message : 'Failed to calculate estimate');
            return false;
        } finally {
            setCalculating(false);
        }
    };

    const reset = () => {
        setResult(null);
        setError(null);
        setSelectedActivities([]);
        setAiReasoning('');
    };

    return {
        loading,
        calculating,
        result,
        isDemoMode,
        error,
        selectedActivities,
        aiReasoning,
        presets,
        loadPresets,
        calculate,
        reset,
    };
}
