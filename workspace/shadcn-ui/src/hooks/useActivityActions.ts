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
        console.log('🔄 [toggleActivityStatus] Starting toggle...', { activityId, currentStatus });
        setUpdating(activityId);
        try {
            const { data, error } = await supabase
                .from('estimation_activities')
                .update({ is_done: !currentStatus })
                .eq('id', activityId)
                .select();

            console.log('📊 [toggleActivityStatus] Supabase response:', { data, error });

            if (error) {
                console.error('❌ [toggleActivityStatus] Supabase error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn('⚠️ [toggleActivityStatus] No rows updated! Check RLS policies.');
                toast.error('Failed to update: No rows affected. Check permissions.');
                return;
            }

            console.log('✅ [toggleActivityStatus] Successfully updated!', data);
            toast.success(`Activity marked as ${!currentStatus ? 'done' : 'not done'}`);

            if (onSuccess) {
                console.log('🔁 [toggleActivityStatus] Calling onSuccess callback');
                await onSuccess();
            }
        } catch (error) {
            console.error('💥 [toggleActivityStatus] Caught error:', error);
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
