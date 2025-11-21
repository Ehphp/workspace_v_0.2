import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';

interface EstimationData {
    presets: TechnologyPreset[];
    activities: Activity[];
    drivers: Driver[];
    risks: Risk[];
}

interface UseEstimationDataReturn {
    data: EstimationData;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to load and manage estimation master data
 * Handles loading presets, activities, drivers, and risks with proper error handling
 */
export function useEstimationData(): UseEstimationDataReturn {
    const [data, setData] = useState<EstimationData>({
        presets: [],
        activities: [],
        drivers: [],
        risks: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);

        try {
            // Load all data in parallel for better performance
            const [presetsRes, activitiesRes, driversRes, risksRes, tpaRes] = await Promise.all([
                supabase
                    .from('technology_presets')
                    .select('*')
                    .order('name')
                    .abortSignal(signal as any),
                supabase
                    .from('activities')
                    .select('*')
                    .eq('active', true)
                    .order('group, name')
                    .abortSignal(signal as any),
                supabase
                    .from('drivers')
                    .select('*')
                    .order('code')
                    .abortSignal(signal as any),
                supabase
                    .from('risks')
                    .select('*')
                    .order('weight')
                    .abortSignal(signal as any),
                supabase
                    .from('technology_preset_activities')
                    .select('tech_preset_id, activity_id, position')
                    .abortSignal(signal as any),
            ]);

            // Check for errors
            if (presetsRes.error) throw presetsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;
            if (driversRes.error) throw driversRes.error;
            if (risksRes.error) throw risksRes.error;
            if (tpaRes.error) throw tpaRes.error;

            // Normalize presets default activities from pivot table (if present)
            const activityById = new Map<string, Activity>();
            (activitiesRes.data || []).forEach((a) => activityById.set(a.id, a));

            const pivotByPreset = new Map<string, { activity_id: string; position: number | null }[]>();
            (tpaRes.data || []).forEach((row: any) => {
                if (!pivotByPreset.has(row.tech_preset_id)) {
                    pivotByPreset.set(row.tech_preset_id, []);
                }
                pivotByPreset.get(row.tech_preset_id)!.push({
                    activity_id: row.activity_id,
                    position: row.position ?? null,
                });
            });

            const normalizedPresets: TechnologyPreset[] = (presetsRes.data || []).map((p) => {
                const rows = pivotByPreset.get(p.id) || [];
                if (rows.length === 0) return p;

                const codes = rows
                    .sort((a, b) => {
                        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                        return pa - pb;
                    })
                    .map((r) => activityById.get(r.activity_id)?.code)
                    .filter((code): code is string => Boolean(code));

                if (codes.length === 0) return p;
                return { ...p, default_activity_codes: codes };
            });

            // Update state only if not aborted
            if (!signal?.aborted) {
                setData({
                    presets: normalizedPresets,
                    activities: activitiesRes.data || [],
                    drivers: driversRes.data || [],
                    risks: risksRes.data || [],
                });
            }
        } catch (err) {
            if (!signal?.aborted) {
                const error = err instanceof Error ? err : new Error('Failed to load estimation data');
                setError(error);
                toast.error('Failed to load estimation data', {
                    description: error.message,
                });
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        loadData(abortController.signal);

        return () => {
            abortController.abort();
        };
    }, [loadData]);

    const refetch = useCallback(async () => {
        await loadData();
    }, [loadData]);

    return { data, loading, error, refetch };
}
