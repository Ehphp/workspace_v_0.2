import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Driver, RequirementDriverValue } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface RequirementDriversCardProps {
    requirementId: string;
    drivers: Driver[];
    driverValues: RequirementDriverValue[];
    onSaved?: () => Promise<void> | void;
    onApplyToEstimate?: (map: Record<string, string>) => void;
}

/**
 * Requirement-scoped driver defaults editor.
 * Persists baseline driver values for a requirement so they can be reused across estimations.
 */
export function RequirementDriversCard({
    requirementId,
    drivers,
    driverValues,
    onSaved,
    onApplyToEstimate,
}: RequirementDriversCardProps) {
    const { user } = useAuth();
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Prepare quick lookup for existing values
    const initialMap = useMemo(() => {
        const map: Record<string, string> = {};
        driverValues.forEach((dv) => { map[dv.driver_id] = dv.selected_value; });
        return map;
    }, [driverValues]);

    useEffect(() => {
        setValues(initialMap);
    }, [initialMap]);

    const handleSave = async () => {
        if (!user) {
            toast.error('Devi essere autenticato per salvare i driver del requisito');
            return;
        }
        setSaving(true);
        try {
            const upsertPayload = Object.entries(values)
                .filter(([, val]) => val)
                .map(([driverId, selected_value]) => ({
                    requirement_id: requirementId,
                    driver_id: driverId,
                    selected_value,
                    source: 'USER',
                }));

            if (upsertPayload.length > 0) {
                const { error } = await supabase
                    .from('requirement_driver_values')
                    .upsert(upsertPayload, { onConflict: 'requirement_id,driver_id' });
                if (error) throw error;
            }

            // Delete removed values
            const existingIds = new Set(driverValues.map((d) => d.driver_id));
            const selectedIds = new Set(Object.keys(values).filter((k) => values[k]));
            const toDelete = [...existingIds].filter((id) => !selectedIds.has(id));
            if (toDelete.length > 0) {
                const { error: delErr } = await supabase
                    .from('requirement_driver_values')
                    .delete()
                    .eq('requirement_id', requirementId)
                    .in('driver_id', toDelete);
                if (delErr) throw delErr;
            }

            toast.success('Driver del requisito salvati');
            onApplyToEstimate?.(values);
            await onSaved?.();
        } catch (error) {
            console.error('Error saving requirement driver values', error);
            toast.error('Salvataggio driver fallito');
        } finally {
            setSaving(false);
        }
    };

    const applyToEstimate = () => {
        onApplyToEstimate?.(values);
        toast.success('Driver applicati alla stima corrente');
    };

    const hasValues = Object.keys(values).length > 0;

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-800">Driver del requisito</CardTitle>
                <CardDescription className="text-xs text-slate-600">
                    Imposta complessità, riuso e altri driver come baseline per questo requisito.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Badge variant="outline" className="text-[11px]">Scope: requisito</Badge>
                    {hasValues && <span className="text-slate-500">Valori salvati disponibili</span>}
                </div>

                <div className="space-y-3">
                    {drivers.map((driver) => {
                        const selected = values[driver.id] || '';
                        return (
                            <div key={driver.id} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-900">{driver.name}</span>
                                    {selected && (
                                        <Badge variant="secondary" className="text-[11px]">
                                            {selected}
                                        </Badge>
                                    )}
                                </div>
                                <Select
                                    value={selected}
                                    onValueChange={(val) => {
                                        if (val === '__NONE__') {
                                            setValues((prev) => {
                                                const next = { ...prev };
                                                delete next[driver.id];
                                                return next;
                                            });
                                            return;
                                        }
                                        setValues((prev) => ({ ...prev, [driver.id]: val }));
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Seleziona valore" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">Nessuno</SelectItem>
                                        {driver.options.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label} ({opt.multiplier.toFixed(2)}x)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={applyToEstimate} disabled={!hasValues}>
                        Applica alla stima
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? 'Salvataggio...' : 'Salva driver'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
