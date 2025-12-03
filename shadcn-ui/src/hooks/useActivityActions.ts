import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useActivityActions() {
    const [updating, setUpdating] = useState<string | null>(null);

    const toggleActivityStatus = async (
        activityId: string,
        currentStatus: boolean,
        onSuccess?: () => void
    ) => {
        setUpdating(activityId);
        try {
            const { error } = await supabase
                .from('estimation_activities')
                .update({ is_done: !currentStatus })
                .eq('id', activityId);

            if (error) throw error;

            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error updating activity status:', error);
            toast.error('Failed to update activity status');
        } finally {
            setUpdating(null);
        }
    };

    return {
        toggleActivityStatus,
        updating
    };
}
