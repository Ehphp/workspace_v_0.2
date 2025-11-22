import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    const query = useQuery({
        queryKey: ['estimation-data'],
        staleTime: 60_000, // cache master data for 1 minute
        retry: false,
        queryFn: async ({ signal }) => {
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

            if (presetsRes.error) throw presetsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;
            if (driversRes.error) throw driversRes.error;
            if (risksRes.error) throw risksRes.error;
            if (tpaRes.error) throw tpaRes.error;

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

            return {
                presets: normalizedPresets,
                activities: activitiesRes.data || [],
                drivers: driversRes.data || [],
                risks: risksRes.data || [],
            } as EstimationData;
        },
    });

    useEffect(() => {
        if (!query.error) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load estimation data';
        toast.error('Failed to load estimation data', {
            description: message,
        });
    }, [query.error]);

    const data = useMemo<EstimationData>(() => query.data ?? {
        presets: [],
        activities: [],
        drivers: [],
        risks: [],
    }, [query.data]);

    const loading = query.isLoading || query.isFetching;
    const error = (query.error as Error) || null;

    return { data, loading, error, refetch: query.refetch };
}
