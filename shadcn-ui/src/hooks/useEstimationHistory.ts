import { useState, useCallback, useEffect } from 'react';
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
    const [history, setHistory] = useState<EstimationHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const loadHistory = useCallback(async (signal?: AbortSignal) => {
        if (!requirementId) {
            setHistory([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
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

            if (!signal?.aborted) {
                setHistory(estimations || []);
            }
        } catch (err) {
            if (!signal?.aborted) {
                const error = err instanceof Error ? err : new Error('Failed to load estimation history');
                setError(error);
                toast.error('Failed to load estimation history', {
                    description: error.message,
                });
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [requirementId]);

    useEffect(() => {
        const abortController = new AbortController();
        loadHistory(abortController.signal);

        return () => {
            abortController.abort();
        };
    }, [loadHistory]);

    const refetch = useCallback(async () => {
        await loadHistory();
    }, [loadHistory]);

    return { history, loading, error, refetch };
}
