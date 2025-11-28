import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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

    const parseError = (err: unknown) => {
        const message =
            err instanceof Error
                ? err.message
                : (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
                    ? (err as { message: string }).message
                    : 'An unexpected error occurred');
        const code =
            err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
                ? (err as { code: string }).code
                : undefined;
        return { message, code };
    };

    const saveHeader = useCallback(async (data: Pick<EditedData, 'title' | 'priority' | 'state'>, stopEditing: () => void) => {
        if (!requirement || !user || isSavingSection('header')) return;

        // Validation
        if (!data.title.trim()) {
            toast.error('Validation failed', { description: 'Title is required' });
            return;
        }
        if (data.title.length > 200) {
            toast.error('Validation failed', { description: 'Title is too long (max 200 characters)' });
            return;
        }
        const validStates = ['PROPOSED', 'SELECTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'REJECTED'];
        if (!validStates.includes(data.state)) {
            toast.error('Validation failed', { description: 'Invalid state selected' });
            return;
        }
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
        if (!validPriorities.includes(data.priority)) {
            toast.error('Validation failed', { description: 'Invalid priority selected' });
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
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requirement.id)
                .select()
                .single();

            if (error) throw error;

            toast.success('Header updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating header:', error);
            const { message, code } = parseError(error);
            let errorMessage = message;
            if (code === '23505') errorMessage = 'A requirement with this title already exists';
            else if (message.includes('JWT')) errorMessage = 'Session expired. Please log in again';

            toast.error('Failed to update header', { description: errorMessage });
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
            toast.error('Validation failed', { description: 'Description is too long (max 5000 characters)' });
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

            toast.success('Description updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating description:', error);
            const { message } = parseError(error);
            toast.error('Failed to update description', { description: message });
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

            toast.success('Details updated successfully');
            stopEditing();
            await refetchRequirement();
        } catch (error) {
            console.error('Error updating details:', error);
            const { message, code } = parseError(error);
            let errorMessage = message;
            if (code === '23503') errorMessage = 'Invalid technology preset or foreign key constraint';
            else if (message.includes('JWT')) errorMessage = 'Session expired. Please log in again';

            toast.error('Failed to update details', { description: errorMessage });
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
