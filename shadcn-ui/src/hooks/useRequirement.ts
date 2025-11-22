import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Requirement, TechnologyPreset, List } from '@/types/database';

interface UseRequirementReturn {
    requirement: Requirement | null;
    list: List | null;
    preset: TechnologyPreset | null;
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
            // Load list scoped to user
            const { data: listData, error: listError } = await supabase
                .from('lists')
                .select('*')
                .eq('id', listId)
                .eq('user_id', userId)
                .single();

            if (listError) throw listError;
            if (!listData) throw new Error('List not found');

            // Load requirement scoped to list
            const { data: reqData, error: reqError } = await supabase
                .from('requirements')
                .select('*')
                .eq('id', reqId)
                .eq('list_id', listId)
                .single();

            if (reqError) throw reqError;
            if (!reqData) throw new Error('Requirement not found');

            // Load technology preset if defined on requirement or list
            const techPresetId = reqData.tech_preset_id || listData.tech_preset_id;
            let presetData: TechnologyPreset | null = null;
            if (techPresetId) {
                const { data, error } = await supabase
                    .from('technology_presets')
                    .select('*')
                    .eq('id', techPresetId)
                    .single();
                if (error) {
                    console.warn('Failed to load preset:', error);
                } else if (data) {
                    presetData = data;
                }
            }

            return {
                list: listData as List,
                requirement: reqData as Requirement,
                preset: presetData,
            };
        },
    });

    // Navigate away and notify on error
    useEffect(() => {
        if (!query.error || !enabled) return;
        const message =
            query.error instanceof Error ? query.error.message : 'Failed to load requirement';
        toast.error('Failed to load requirement', { description: message });
        const timer = setTimeout(() => {
            navigate(`/lists/${listId}/requirements`);
        }, 2000);
        return () => clearTimeout(timer);
    }, [query.error, enabled, navigate, listId]);

    const requirement = useMemo(() => query.data?.requirement ?? null, [query.data]);
    const list = useMemo(() => query.data?.list ?? null, [query.data]);
    const preset = useMemo(() => query.data?.preset ?? null, [query.data]);
    const loading = query.isLoading || query.isFetching || !enabled;
    const error = (query.error as Error) || null;

    return { requirement, list, preset, loading, error, refetch: query.refetch };
}
