import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRequirementBundle } from '@/lib/api';
import { toast } from 'sonner';
import type { Requirement, Technology, Project, RequirementDriverValue, EstimationWithDetails } from '@/types/database';

interface UseRequirementReturn {
    requirement: Requirement | null;
    project: Project | null;
    preset: Technology | null;
    driverValues: RequirementDriverValue[];
    assignedEstimation: EstimationWithDetails | null;
    loading: boolean;
    isRefetching: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to load requirement data with proper error handling and cleanup
 */
export function useRequirement(
    projectId: string | undefined,
    reqId: string | undefined,
    userId: string | undefined
): UseRequirementReturn {
    const navigate = useNavigate();

    const enabled = Boolean(userId && projectId && reqId);

    const query = useQuery({
        queryKey: ['requirement', userId, projectId, reqId],
        enabled,
        staleTime: 60_000, // 1 minute caching
        retry: false,
        queryFn: async () => {
            const bundle = await fetchRequirementBundle(projectId!, reqId!, userId!);
            return bundle;
        },
    });

    // Navigate away and notify on error
    useEffect(() => {
        if (!query.error || !enabled) return;
        const message =
            query.error instanceof Error ? query.error.message : 'Failed to load requirement';
        toast.error('Failed to load requirement', { description: message });
        const timer = setTimeout(() => {
            navigate(`/dashboard/${projectId}/requirements`);
        }, 2000);
        return () => clearTimeout(timer);
    }, [query.error, enabled, navigate, projectId]);

    const requirement = useMemo(() => query.data?.requirement ?? null, [query.data]);
    const project = useMemo(() => query.data?.project ?? null, [query.data]);
    const preset = useMemo(() => query.data?.preset ?? null, [query.data]);
    const driverValues = useMemo(() => query.data?.driverValues ?? [], [query.data]);
    const assignedEstimation = useMemo(() => query.data?.assignedEstimation ?? null, [query.data]);
    const loading = query.isLoading || !enabled;
    const isRefetching = query.isFetching;
    const error = (query.error as Error) || null;

    return {
        requirement,
        project,
        preset,
        driverValues,
        assignedEstimation,
        loading,
        isRefetching,
        error,
        refetch: async () => { await query.refetch(); }
    };
}
