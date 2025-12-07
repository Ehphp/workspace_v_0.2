import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import { toast } from 'sonner';

export interface PresetView extends TechnologyPreset {
    defaultActivities: Activity[];
    defaultRisks: Risk[];
    driverDefaults: { code: string; value: string }[];
}

export interface PresetForm {
    name: string;
    description: string;
    techCategory: string;
    activities: Activity[];
    driverValues: Record<string, string>;
    riskCodes: string[];
}

export const initialPresetForm: PresetForm = {
    name: '',
    description: '',
    techCategory: 'MULTI',
    activities: [],
    driverValues: {},
    riskCodes: [],
};

export function usePresetManagement(userId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [presets, setPresets] = useState<PresetView[]>([]);
    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
    const [allRisks, setAllRisks] = useState<Risk[]>([]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [presetsRes, activitiesRes, driversRes, risksRes, pivotRes] = await Promise.all([
                supabase.from('technology_presets').select('*').order('name'),
                supabase.from('activities').select('*').eq('active', true).order('name'),
                supabase.from('drivers').select('*'),
                supabase.from('risks').select('*'),
                supabase.from('technology_preset_activities').select('tech_preset_id, activity_id, position'),
            ]);

            if (presetsRes.error) throw presetsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;
            if (driversRes.error) throw driversRes.error;
            if (risksRes.error) throw risksRes.error;
            if (pivotRes.error) throw pivotRes.error;

            const activities = activitiesRes.data || [];
            const risks = risksRes.data || [];
            const drivers = driversRes.data || [];

            setAllActivities(activities);
            setAllDrivers(drivers);
            setAllRisks(risks);

            const activityById = new Map<string, Activity>();
            activities.forEach((a) => activityById.set(a.id, a));

            const pivotByPreset = new Map<string, { activity_id: string; position: number | null }[]>();
            ((pivotRes.data as { tech_preset_id: string; activity_id: string; position: number | null }[] | null) || []).forEach((row) => {
                if (!pivotByPreset.has(row.tech_preset_id)) {
                    pivotByPreset.set(row.tech_preset_id, []);
                }
                pivotByPreset.get(row.tech_preset_id)!.push({
                    activity_id: row.activity_id,
                    position: row.position ?? null,
                });
            });

            const presetViews: PresetView[] = (presetsRes.data || []).map((p) => {
                const pivots = pivotByPreset.get(p.id) || [];
                const defaultActivities = pivots
                    .sort((a, b) => {
                        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                        return pa - pb;
                    })
                    .map((row) => activityById.get(row.activity_id))
                    .filter((a): a is Activity => Boolean(a));

                const driverDefaults = Object.entries(p.default_driver_values || {}).map(([code, value]) => ({ code, value }));
                const defaultRisks = risks.filter((r) => p.default_risks?.includes(r.code));

                return {
                    ...p,
                    defaultActivities,
                    driverDefaults,
                    defaultRisks,
                    default_activity_codes: defaultActivities.map((a) => a.code),
                };
            });

            setPresets(presetViews);
        } catch (err) {
            console.error('Failed to load presets', err);
            const message = err instanceof Error ? err.message : 'Failed to load presets';
            setError(message);
            toast.error('Errore caricamento dati', { description: message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) loadData();
    }, [userId]);

    const techCategories = useMemo(() => {
        const categories = new Set(presets.map(p => p.tech_category));
        return Array.from(categories).sort();
    }, [presets]);

    const generateCode = (name: string) => {
        return name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    };

    const savePreset = async (form: PresetForm, editingId: string | null) => {
        if (!form.name.trim()) {
            toast.error('Il nome è obbligatorio');
            return false;
        }

        setSaving(true);
        try {
            let presetId = editingId;

            const presetData = {
                name: form.name,
                description: form.description,
                tech_category: form.techCategory,
                default_driver_values: form.driverValues,
                default_risks: form.riskCodes,
                default_activity_codes: form.activities.map(a => a.code),
                is_custom: true,
                created_by: userId
            };

            if (editingId) {
                const { error } = await supabase
                    .from('technology_presets')
                    .update(presetData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const code = generateCode(form.name);
                const { data, error } = await supabase
                    .from('technology_presets')
                    .insert({ ...presetData, code })
                    .select('id')
                    .single();
                if (error) throw error;
                presetId = data.id;
            }

            if (presetId) {
                if (editingId) {
                    await supabase
                        .from('technology_preset_activities')
                        .delete()
                        .eq('tech_preset_id', presetId);
                }

                if (form.activities.length > 0) {
                    const rows = form.activities.map((a, idx) => ({
                        tech_preset_id: presetId,
                        activity_id: a.id,
                        position: idx + 1
                    }));
                    const { error } = await supabase
                        .from('technology_preset_activities')
                        .insert(rows);
                    if (error) throw error;
                }
            }

            toast.success(editingId ? 'Tecnologia aggiornata' : 'Tecnologia creata');
            loadData();
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Errore salvataggio', { description: err instanceof Error ? err.message : 'Errore sconosciuto' });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deletePreset = async (preset: PresetView) => {
        if (!confirm('Sei sicuro di voler eliminare questa tecnologia?')) return false;

        try {
            const { error } = await supabase
                .from('technology_presets')
                .delete()
                .eq('id', preset.id)
                .eq('created_by', userId || '');

            if (error) throw error;

            toast.success('Tecnologia eliminata');
            loadData();
            return true;
        } catch (err) {
            toast.error('Errore eliminazione', { description: err instanceof Error ? err.message : 'Errore sconosciuto' });
            return false;
        }
    };

    return {
        loading,
        saving,
        error,
        presets,
        allActivities,
        allDrivers,
        allRisks,
        techCategories,
        loadData,
        savePreset,
        deletePreset,
    };
}
