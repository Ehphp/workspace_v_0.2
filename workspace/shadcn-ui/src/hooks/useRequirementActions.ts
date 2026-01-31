import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { showApiError, showSuccess } from '@/lib/toastHelpers';
import type { Requirement } from '@/types/database';

interface UseRequirementActionsProps {
    requirement: Requirement | null;
    user: { id: string } | null;
    refetchRequirement: () => Promise<void>;
}

export type EditSection = 'header' | 'description' | 'details';

export interface EditedData {
    title: string;
    description: string;
    priority: string;
    state: string;
    business_owner: string;
    labels: string[];
    tech_preset_id: string | null;
}

export function useRequirementActions({ requirement, user, refetchRequirement }: UseRequirementActionsProps) {
    const [savingSections, setSavingSections] = useState<Set<EditSection>>(new Set());

    const isSavingSection = useCallback((section: EditSection) => savingSections.has(section), [savingSections]);

    const saveHeader = useCallback(async (data: Pick<EditedData, 'title' | 'priority' | 'state' | 'business_owner' | 'tech_preset_id'>, stopEditing: () => void) => {
        if (!requirement || !user || isSavingSection('header')) return;

        // Validation
        if (!data.title.trim()) {
            showApiError('Title is required', 'validazione');
            return;
        }
        if (data.title.length > 200) {
            showApiError('Title is too long (max 200 characters)', 'validazione');
            return;
        }
        const validStates = ['PROPOSED', 'SELECTED', 'SCHEDULED', 'DONE'];
        if (!validStates.includes(data.state)) {
            showApiError('Invalid state selected', 'validazione');
            return;
        }
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
        if (!validPriorities.includes(data.priority)) {
            showApiError('Invalid priority selected', 'validazione');
            return;
        }

        setSavingSections(prev => new Set(prev).add('header'));

        try {
            const { error } = await supabase
                .from('requirements')
                .update({
                    title: data.title.trim(),
                    priority: data.priority,
                    state: data.state,
                    business_owner: data.business_owner?.trim() || null,
                    tech_preset_id: data.tech_preset_id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requirement.id)
                .select()
                .single();

            if (error) throw error;

            showSuccess('Header updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating header:', error);
            showApiError(error, 'aggiornamento header');
            // On error, trigger refetch to restore correct state
            await refetchRequirement();
        } finally {
            setSavingSections(prev => {
                const next = new Set(prev);
                next.delete('header');
                return next;
            });
        }
    }, [requirement, user, isSavingSection, refetchRequirement]);

    const saveDescription = useCallback(async (description: string, stopEditing: () => void) => {
        if (!requirement || !user || isSavingSection('description')) return;

        if (description && description.length > 5000) {
            showApiError('Description is too long (max 5000 characters)', 'validazione');
            return;
        }

        setSavingSections(prev => new Set(prev).add('description'));

        try {
            const { error } = await supabase
                .from('requirements')
                .update({
                    description: description?.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requirement.id)
                .select()
                .single();

            if (error) throw error;

            showSuccess('Description updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating description:', error);
            showApiError(error, 'aggiornamento descrizione');
        } finally {
            setSavingSections(prev => {
                const next = new Set(prev);
                next.delete('description');
                return next;
            });
        }
    }, [requirement, user, isSavingSection, refetchRequirement]);

    const saveDetails = useCallback(async (data: Pick<EditedData, 'business_owner' | 'labels' | 'tech_preset_id'>, stopEditing: () => void) => {
        if (!requirement || !user || isSavingSection('details')) return;

        setSavingSections(prev => new Set(prev).add('details'));

        try {
            const { error } = await supabase
                .from('requirements')
                .update({
                    business_owner: data.business_owner?.trim() || null,
                    labels: data.labels,
                    tech_preset_id: data.tech_preset_id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requirement.id)
                .select()
                .single();

            if (error) throw error;

            showSuccess('Details updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating details:', error);
            showApiError(error, 'aggiornamento dettagli');
        } finally {
            setSavingSections(prev => {
                const next = new Set(prev);
                next.delete('details');
                return next;
            });
        }
    }, [requirement, user, isSavingSection, refetchRequirement]);

    return {
        saveHeader,
        saveDescription,
        saveDetails,
        isSavingSection
    };
}
