import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EstimationHistoryItem {
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
}

/**
 * Custom hook to load estimation history with proper error handling
 */
export function useEstimationHistory(requirementId: string | undefined): UseEstimationHistoryReturn {
    const enabled = Boolean(requirementId);

    const query = useQuery({
        queryKey: ['estimation-history', requirementId],
        enabled,
        staleTime: 30_000,
        retry: false,
        queryFn: async ({ signal }) => {
            const { data: estimations, error: historyError } = await supabase
                .from('estimations')
                .select(`
          *,
          estimation_activities (activity_id, is_ai_suggested),
          estimation_drivers (driver_id, selected_value),
          estimation_risks (risk_id)
        `)
                .eq('requirement_id', requirementId)
                .order('created_at', { ascending: false })
                .abortSignal(signal as any);

            if (historyError) throw historyError;
            return estimations || [];
        },
    });

    useEffect(() => {
        if (!query.error || !enabled) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load estimation history';
        toast.error('Failed to load estimation history', { description: message });
    }, [query.error, enabled]);

    const history = useMemo<EstimationHistoryItem[]>(() => query.data || [], [query.data]);
    const loading = query.isLoading || query.isFetching;
    const error = (query.error as Error) || null;

    return { history, loading, error, refetch: query.refetch };
}
