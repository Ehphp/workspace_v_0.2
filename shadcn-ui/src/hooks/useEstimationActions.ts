import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useEstimationActions() {
    const [assigning, setAssigning] = useState<string | null>(null);

    const assignEstimation = async (
        requirementId: string,
        estimationId: string,
        onSuccess?: () => void
    ) => {
        setAssigning(estimationId);
        try {
            const { error } = await supabase
                .from('requirements')
                .update({ assigned_estimation_id: estimationId })
                .eq('id', requirementId);

            if (error) throw error;

            toast.success('Estimation assigned successfully');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error assigning estimation:', error);
            toast.error('Failed to assign estimation');
        } finally {
            setAssigning(null);
        }
    };

    return {
        assignEstimation,
        assigning
    };
}
