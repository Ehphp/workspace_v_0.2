/**
 * useActualHours — Hook for saving consuntivo (actual) data on an estimation.
 *
 * Calls the `update_estimation_actuals` RPC created in S2-1b.
 * Sprint 2 — S2-2a
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ActualHoursData {
    actual_hours: number | null;
    actual_start_date: string | null;  // ISO date
    actual_end_date: string | null;    // ISO date
    actual_notes: string | null;
}

export function useActualHours(estimationId: string | null, userId: string | undefined) {
    const [saving, setSaving] = useState(false);

    const saveActuals = useCallback(async (data: ActualHoursData): Promise<boolean> => {
        if (!estimationId || !userId) {
            toast.error('Seleziona prima una stima');
            return false;
        }

        if (data.actual_hours == null || data.actual_hours < 0) {
            toast.error('Inserisci un valore di ore valido');
            return false;
        }

        setSaving(true);
        try {
            const { error } = await supabase.rpc('update_estimation_actuals', {
                p_estimation_id: estimationId,
                p_user_id: userId,
                p_actual_hours: data.actual_hours,
                p_actual_start_date: data.actual_start_date,
                p_actual_end_date: data.actual_end_date,
                p_actual_notes: data.actual_notes,
            });

            if (error) throw error;

            toast.success('Consuntivo salvato');
            return true;
        } catch (err: any) {
            console.error('Error saving actuals:', err);
            const message = err?.message?.includes('Unauthorized')
                ? 'Non hai i permessi per modificare questa stima'
                : 'Errore nel salvataggio del consuntivo';
            toast.error(message);
            return false;
        } finally {
            setSaving(false);
        }
    }, [estimationId, userId]);

    return { saving, saveActuals };
}
