import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRequirementBundle } from '@/lib/api';
import { toast } from 'sonner';
import type { Requirement, TechnologyPreset, List, RequirementDriverValue } from '@/types/database';

interface UseRequirementReturn {
    requirement: Requirement | null;
    list: List | null;
    preset: TechnologyPreset | null;
    driverValues: RequirementDriverValue[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to load requirement data with proper error handling and cleanup
 */
export function useRequirement(
    listId: string | undefined,
    reqId: string | undefined,
    userId: string | undefined
): UseRequirementReturn {
    const navigate = useNavigate();

    const enabled = Boolean(userId && listId && reqId);

    const query = useQuery({
        queryKey: ['requirement', userId, listId, reqId],
        enabled,
        staleTime: 60_000, // 1 minute caching
        retry: false,
        queryFn: async () => {
            const bundle = await fetchRequirementBundle(listId!, reqId!, userId!);
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
            navigate(`/dashboard/${listId}/requirements`);
        }, 2000);
        return () => clearTimeout(timer);
    }, [query.error, enabled, navigate, listId]);

    const requirement = useMemo(() => query.data?.requirement ?? null, [query.data]);
    const list = useMemo(() => query.data?.list ?? null, [query.data]);
    const preset = useMemo(() => query.data?.preset ?? null, [query.data]);
    const driverValues = useMemo(() => query.data?.driverValues ?? [], [query.data]);
    const loading = query.isLoading || query.isFetching || !enabled;
    const error = (query.error as Error) || null;

    return {
        requirement,
        list,
        preset,
        driverValues,
        loading,
        error,
        refetch: async () => { await query.refetch(); }
    };
}
