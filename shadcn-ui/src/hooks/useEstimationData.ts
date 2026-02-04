import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchEstimationMasterData } from '@/lib/api';
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
        queryFn: async () => {
            // AbortSignal not propagated in supabase fetch helper; rely on upstream cancellation for React Query
            const data = await fetchEstimationMasterData();
            return data as EstimationData;
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
