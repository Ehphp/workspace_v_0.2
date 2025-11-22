import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface EstimationHistoryItem {
    id: string;
    requirement_id: string;
    user_id: string;
    total_days: number;
    base_days: number;
    driver_multiplier: number;
    risk_score: number;
    contingency_percent: number;
    scenario_name: string;
    created_at: string;
    estimation_activities?: Array<{
        activity_id: string;
        is_ai_suggested: boolean;
    }>;
    estimation_drivers?: Array<{
        driver_id: string;
        selected_value: string;
    }>;
    estimation_risks?: Array<{
        risk_id: string;
    }>;
}

interface UseEstimationHistoryReturn {
    history: EstimationHistoryItem[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    totalCount: number;
}

interface UseEstimationHistoryOptions {
    page?: number;
    pageSize?: number;
}

/**
 * Custom hook to load estimation history with proper error handling
 */
export function useEstimationHistory(
    requirementId: string | undefined,
    options?: UseEstimationHistoryOptions
): UseEstimationHistoryReturn {
    const enabled = Boolean(requirementId);
    const pageSize = Math.max(1, options?.pageSize || 12);
    const page = Math.max(1, options?.page || 1);
    const rangeStart = (page - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize - 1;

    const query = useQuery({
        queryKey: ['estimation-history', requirementId, page, pageSize],
        enabled,
        staleTime: 30_000,
        retry: false,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
            const { data: estimations, error: historyError, count } = await supabase
                .from('estimations')
                .select(`
                    *,
                    estimation_activities (activity_id, is_ai_suggested),
                    estimation_drivers (driver_id, selected_value),
                    estimation_risks (risk_id)
                `, { count: 'exact' })
                .eq('requirement_id', requirementId)
                .order('created_at', { ascending: false })
                .range(rangeStart, rangeEnd)
                .abortSignal(signal);

            if (historyError) throw historyError;
            return { estimations: estimations || [], total: count ?? (estimations?.length || 0) };
        },
    });

    useEffect(() => {
        if (!query.error || !enabled) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load estimation history';
        toast.error('Failed to load estimation history', { description: message });
    }, [query.error, enabled]);

    const history = useMemo<EstimationHistoryItem[]>(() => query.data?.estimations || [], [query.data]);
    const totalCount = query.data?.total ?? history.length;
    const loading = query.isLoading || query.isFetching;
    const error = (query.error as Error) || null;

    return { history, loading, error, refetch: query.refetch, totalCount };
}
