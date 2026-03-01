import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { SeniorConsultantAnalysis } from '@/types/estimation';

/**
 * Snapshot of the requirement at analysis time
 */
export interface RequirementSnapshot {
    title: string;
    description: string;
    priority: string;
    state: string;
    technology_id: string | null;
    technology_name: string | null;
}

/**
 * Snapshot of the estimation at analysis time
 */
export interface EstimationSnapshot {
    estimation_id: string | null;
    total_days: number;
    base_hours: number;
    driver_multiplier: number;
    risk_score: number;
    contingency_percent: number;
    scenario_name: string;
    activities: Array<{
        code: string;
        name: string;
        base_hours: number;
        group: string;
    }>;
    drivers: Array<{
        code: string;
        name: string;
        selected_value: string;
        multiplier: number;
    }>;
}

/**
 * A single consultant analysis record with full context
 */
export interface ConsultantAnalysisRecord {
    id: string;
    requirement_id: string;
    estimation_id: string | null;
    user_id: string;
    analysis: SeniorConsultantAnalysis;
    requirement_snapshot: RequirementSnapshot;
    estimation_snapshot: EstimationSnapshot;
    created_at: string;
}

/**
 * Data needed to save a new consultant analysis
 */
export interface SaveConsultantAnalysisInput {
    requirementId: string;
    estimationId: string | null;
    userId: string;
    analysis: SeniorConsultantAnalysis;
    requirementSnapshot: RequirementSnapshot;
    estimationSnapshot: EstimationSnapshot;
}

interface UseConsultantHistoryReturn {
    history: ConsultantAnalysisRecord[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<any>;
    saveAnalysis: (input: SaveConsultantAnalysisInput) => Promise<ConsultantAnalysisRecord>;
    isSaving: boolean;
}

/**
 * Hook to load and save consultant analysis history for a requirement.
 * Each analysis is stored with a snapshot of the requirement and estimation state
 * at the time it was generated, providing full traceability.
 */
export function useConsultantHistory(requirementId: string | undefined): UseConsultantHistoryReturn {
    const queryClient = useQueryClient();
    const enabled = Boolean(requirementId);

    // Fetch history
    const query = useQuery({
        queryKey: ['consultant-history', requirementId],
        enabled,
        staleTime: 30_000,
        retry: false,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
            const { data, error } = await supabase
                .from('consultant_analyses')
                .select('*')
                .eq('requirement_id', requirementId)
                .order('created_at', { ascending: false })
                .abortSignal(signal);

            if (error) throw error;
            return (data || []) as ConsultantAnalysisRecord[];
        },
    });

    useEffect(() => {
        if (!query.error || !enabled) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load consultant history';
        toast.error('Errore caricamento storico analisi', { description: message });
    }, [query.error, enabled]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (input: SaveConsultantAnalysisInput) => {
            const { data, error } = await supabase
                .from('consultant_analyses')
                .insert({
                    requirement_id: input.requirementId,
                    estimation_id: input.estimationId,
                    user_id: input.userId,
                    analysis: input.analysis,
                    requirement_snapshot: input.requirementSnapshot,
                    estimation_snapshot: input.estimationSnapshot,
                })
                .select()
                .single();

            if (error) throw error;
            return data as ConsultantAnalysisRecord;
        },
        onSuccess: () => {
            // Invalidate the query to refetch history
            queryClient.invalidateQueries({ queryKey: ['consultant-history', requirementId] });
        },
        onError: (error: Error) => {
            console.error('Failed to save consultant analysis:', error);
            toast.error('Errore salvataggio analisi', {
                description: error.message || 'Impossibile salvare l\'analisi del consulente'
            });
        },
    });

    const history = useMemo<ConsultantAnalysisRecord[]>(() => query.data || [], [query.data]);
    const loading = query.isLoading || query.isFetching;
    const error = (query.error as Error) || null;

    return {
        history,
        loading,
        error,
        refetch: query.refetch,
        saveAnalysis: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending,
    };
}
