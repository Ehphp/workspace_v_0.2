import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const [requirement, setRequirement] = useState<Requirement | null>(null);
    const [list, setList] = useState<List | null>(null);
    const [preset, setPreset] = useState<TechnologyPreset | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadRequirement = useCallback(async (signal?: AbortSignal) => {
        if (!userId || !listId || !reqId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Load list first
            const { data: listData, error: listError } = await supabase
                .from('lists')
                .select('*')
                .eq('id', listId)
                .eq('user_id', userId)
                .abortSignal(signal as any)
                .single();

            if (listError) throw listError;

            if (!listData) {
                throw new Error('List not found');
            }

            if (!signal?.aborted) {
                setList(listData);
            }

            // Load requirement
            const { data: reqData, error: reqError } = await supabase
                .from('requirements')
                .select('*')
                .eq('id', reqId)
                .eq('list_id', listId)
                .abortSignal(signal as any)
                .single();

            if (reqError) throw reqError;

            if (!reqData) {
                throw new Error('Requirement not found');
            }

            if (!signal?.aborted) {
                setRequirement(reqData);

                // Load technology preset if exists (from requirement or list)
                const techPresetId = reqData.tech_preset_id || listData.tech_preset_id;
                if (techPresetId) {
                    const { data: presetData, error: presetError } = await supabase
                        .from('technology_presets')
                        .select('*')
                        .eq('id', techPresetId)
                        .abortSignal(signal as any)
                        .single();

                    if (presetError) {
                        console.warn('Failed to load preset:', presetError);
                    } else if (presetData) {
                        setPreset(presetData);
                    }
                }
            }
        } catch (err) {
            if (!signal?.aborted) {
                const error = err instanceof Error ? err : new Error('Failed to load requirement');
                setError(error);
                toast.error('Failed to load requirement', {
                    description: error.message,
                });

                // Navigate back to requirements list after a short delay
                setTimeout(() => {
                    navigate(`/lists/${listId}/requirements`);
                }, 2000);
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [userId, listId, reqId, navigate]);

    useEffect(() => {
        const abortController = new AbortController();
        loadRequirement(abortController.signal);

        return () => {
            abortController.abort();
        };
    }, [loadRequirement]);

    const refetch = useCallback(async () => {
        await loadRequirement();
    }, [loadRequirement]);

    return { requirement, list, preset, loading, error, refetch };
}
