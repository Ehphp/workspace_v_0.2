import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { generateActivityCode } from '@/lib/codeGeneration';
import type { Activity } from '@/types/database';
import { toast } from 'sonner';

export interface ActivityForm {
    name: string;
    description: string;
    baseHours: string;
    techCategory: string;
    group: string;
    active: boolean;
    baseActivityId: string | null;
}

export const initialActivityForm: ActivityForm = {
    name: '',
    description: '',
    baseHours: '1.0',
    techCategory: 'MULTI',
    group: 'DEV',
    active: true,
    baseActivityId: null,
};

export function useActivityManagement(userId: string | undefined) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technologies, setTechnologies] = useState<{ value: string; label: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [fetching, setFetching] = useState(true);

    const loadTechnologies = async () => {
        const { data } = await supabase
            .from('technology_presets')
            .select('tech_category, name')
            .order('sort_order');

        if (data && data.length > 0) {
            const uniqueTechs = Array.from(
                new Map(data.map(t => [t.tech_category, t.name])).entries()
            ).map(([value, label]) => ({ value, label }));
            setTechnologies(uniqueTechs);
        } else {
            setTechnologies([
                { value: 'POWER_PLATFORM', label: 'Power Platform' },
                { value: 'BACKEND', label: 'Backend API' },
                { value: 'FRONTEND', label: 'Frontend' },
                { value: 'USU', label: 'USU' },
                { value: 'MULTI', label: 'Multi-stack' },
            ]);
        }
    };

    const loadActivities = async () => {
        setFetching(true);
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading activities', error);
            toast.error('Impossibile caricare le attivita');
        } else {
            setActivities(data || []);
        }
        setFetching(false);
    };

    useEffect(() => {
        if (userId) {
            loadActivities();
            loadTechnologies();
        }
    }, [userId]);

    const customActivities = useMemo(
        () => activities.filter((a) => a.is_custom),
        [activities]
    );

    const canEdit = (activity: Activity) => {
        if (!userId) return false;
        if (!activity.created_by) return false;
        return activity.created_by === userId;
    };

    const saveActivity = async (form: ActivityForm, editActivity: Activity | null) => {
        const baseHours = Number(form.baseHours);

        if (!form.name.trim()) {
            toast.error('Nome obbligatorio');
            return false;
        }

        if (!Number.isFinite(baseHours) || baseHours <= 0) {
            toast.error('Peso non valido', {
                description: 'Inserisci un numero di ore maggiore di zero',
            });
            return false;
        }

        setSaving(true);
        try {
            if (editActivity) {
                if (!canEdit(editActivity)) {
                    throw new Error('Non hai i permessi per modificare questa attivita');
                }

                const { error } = await supabase
                    .from('activities')
                    .update({
                        name: form.name,
                        description: form.description,
                        base_hours: baseHours,
                        tech_category: form.techCategory,
                        group: form.group,
                        active: form.active,
                    })
                    .eq('id', editActivity.id);

                if (error) throw error;

                toast.success('Attivita aggiornata', {
                    description: `${form.name} - ${baseHours.toFixed(2)} ore`,
                });
            } else {
                const code = generateActivityCode({
                    name: form.name,
                    techCategory: form.techCategory,
                    group: form.group,
                });

                const { error } = await supabase.from('activities').insert({
                    code,
                    name: form.name,
                    description: form.description,
                    base_hours: baseHours,
                    tech_category: form.techCategory,
                    group: form.group,
                    active: form.active,
                    is_custom: true,
                    created_by: userId,
                    base_activity_id: form.baseActivityId,
                });

                if (error) throw error;

                toast.success('Attivita creata', {
                    description: `${form.name} con codice ${code}`,
                });
            }

            await loadActivities();
            return true;
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
            toast.error('Errore durante il salvataggio', { description: errorMessage });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteActivity = async (activity: Activity) => {
        if (!canEdit(activity)) {
            toast.error('Non hai i permessi per eliminare questa attivita');
            return false;
        }

        if (!confirm(`Eliminare l'attivita "${activity.name}"?`)) {
            return false;
        }

        try {
            const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', activity.id);

            if (error) throw error;

            toast.success('Attivita eliminata');
            await loadActivities();
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Errore durante l\'eliminazione');
            return false;
        }
    };

    return {
        activities,
        technologies,
        customActivities,
        saving,
        fetching,
        canEdit,
        saveActivity,
        deleteActivity,
        loadActivities,
    };
}
