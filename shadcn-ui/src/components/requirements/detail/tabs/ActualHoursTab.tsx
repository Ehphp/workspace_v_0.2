/**
 * ActualHoursTab — "Consuntivo" tab for recording actual hours on an estimation.
 *
 * Shows estimation summary (read-only), a form for actual hours/dates/notes,
 * a live deviation badge, and a save button.
 *
 * Sprint 2 — S2-2b
 */

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, Save, Clock, CalendarDays, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useActualHours, type ActualHoursData } from '@/hooks/useActualHours';
import type { EstimationWithDetails } from '@/types/database';

interface ActualHoursTabProps {
    assignedEstimation: EstimationWithDetails | null;
    estimationHistory: EstimationWithDetails[];
    userId: string | undefined;
    onRefetch: () => Promise<void>;
}

export function ActualHoursTab({
    assignedEstimation,
    estimationHistory,
    userId,
    onRefetch,
}: ActualHoursTabProps) {
    // ── Selected estimation ──────────────────────────────────────
    const [selectedEstimationId, setSelectedEstimationId] = useState<string | null>(
        assignedEstimation?.id || null
    );

    const selectedEstimation = useMemo(() => {
        if (!selectedEstimationId) return null;
        if (assignedEstimation?.id === selectedEstimationId) return assignedEstimation;
        return estimationHistory.find(e => e.id === selectedEstimationId) || null;
    }, [selectedEstimationId, assignedEstimation, estimationHistory]);

    // ── Form state ──────────────────────────────────────────────
    const [actualHours, setActualHours] = useState<string>('');
    const [actualStartDate, setActualStartDate] = useState<string>('');
    const [actualEndDate, setActualEndDate] = useState<string>('');
    const [actualNotes, setActualNotes] = useState<string>('');

    const { saving, saveActuals } = useActualHours(selectedEstimationId, userId);

    // Pre-fill form when estimation changes (if actuals already exist)
    useEffect(() => {
        if (selectedEstimation) {
            setActualHours(selectedEstimation.actual_hours != null ? String(selectedEstimation.actual_hours) : '');
            setActualStartDate(selectedEstimation.actual_start_date || '');
            setActualEndDate(selectedEstimation.actual_end_date || '');
            setActualNotes(selectedEstimation.actual_notes || '');
        } else {
            setActualHours('');
            setActualStartDate('');
            setActualEndDate('');
            setActualNotes('');
        }
    }, [selectedEstimation]);

    // Default to assigned estimation on mount
    useEffect(() => {
        if (!selectedEstimationId && assignedEstimation) {
            setSelectedEstimationId(assignedEstimation.id);
        }
    }, [assignedEstimation, selectedEstimationId]);

    // ── Deviation calculation ───────────────────────────────────
    const deviation = useMemo(() => {
        const hours = parseFloat(actualHours);
        if (isNaN(hours) || !selectedEstimation || selectedEstimation.total_days <= 0) return null;
        const actualDays = hours / 8;
        const pct = ((actualDays - selectedEstimation.total_days) / selectedEstimation.total_days) * 100;
        return Math.round(pct * 10) / 10;
    }, [actualHours, selectedEstimation]);

    const deviationColor = useMemo(() => {
        if (deviation === null) return 'secondary';
        const abs = Math.abs(deviation);
        if (abs <= 10) return 'default';     // green-ish
        if (abs <= 25) return 'outline';     // yellow-ish — we'll apply custom styles
        return 'destructive';                // red
    }, [deviation]);

    const deviationBadgeClass = useMemo(() => {
        if (deviation === null) return '';
        const abs = Math.abs(deviation);
        if (abs <= 10) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (abs <= 25) return 'bg-amber-100 text-amber-800 border-amber-300';
        return ''; // destructive variant handles red
    }, [deviation]);

    // ── Handlers ────────────────────────────────────────────────
    const handleSave = async () => {
        const data: ActualHoursData = {
            actual_hours: actualHours ? parseFloat(actualHours) : null,
            actual_start_date: actualStartDate || null,
            actual_end_date: actualEndDate || null,
            actual_notes: actualNotes.trim() || null,
        };
        const ok = await saveActuals(data);
        if (ok) {
            await onRefetch();
        }
    };

    // ── Available estimations list ──────────────────────────────
    const availableEstimations = useMemo(() => {
        const map = new Map<string, EstimationWithDetails>();
        if (assignedEstimation) map.set(assignedEstimation.id, assignedEstimation);
        for (const e of estimationHistory) {
            if (!map.has(e.id)) map.set(e.id, e);
        }
        return Array.from(map.values());
    }, [assignedEstimation, estimationHistory]);

    // ── Empty state ─────────────────────────────────────────────
    if (availableEstimations.length === 0) {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="container mx-auto px-6 py-5">
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <ClipboardCheck className="w-8 h-8 text-slate-300 mb-3" />
                            <p className="text-sm font-medium text-slate-500 mb-1">
                                Nessuna stima disponibile
                            </p>
                            <p className="text-xs text-slate-400 max-w-md">
                                Crea prima una stima nella tab "Stima" per poter registrare il consuntivo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="container mx-auto px-6 py-5 space-y-6">
                    {/* Estimation selector (if multiple) */}
                    {availableEstimations.length > 1 && (
                        <section>
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardCheck className="w-4 h-4 text-slate-400" />
                                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seleziona Stima</h2>
                            </div>
                            <Select
                                value={selectedEstimationId || ''}
                                onValueChange={setSelectedEstimationId}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Scegli una stima..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableEstimations.map(est => (
                                        <SelectItem key={est.id} value={est.id}>
                                            {est.scenario_name} — {est.total_days.toFixed(1)} giorni
                                            {' · '}
                                            {new Date(est.created_at).toLocaleDateString('it-IT')}
                                            {est.id === assignedEstimation?.id ? ' ★' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </section>
                    )}

                    {selectedEstimation && (
                        <>
                            {/* Summary (read-only) */}
                            <section className="border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Info className="w-4 h-4 text-slate-400" />
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Riepilogo Stima</h2>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider">Giorni totali</p>
                                            <p className="text-2xl font-bold text-blue-700">
                                                {selectedEstimation.total_days.toFixed(1)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider">Ore base</p>
                                            <p className="text-2xl font-bold text-blue-700">
                                                {selectedEstimation.base_hours.toFixed(1)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider">Scenario</p>
                                            <p className="text-lg font-semibold text-slate-800">
                                                {selectedEstimation.scenario_name}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider">Data stima</p>
                                            <p className="text-lg font-semibold text-slate-800">
                                                {new Date(selectedEstimation.created_at).toLocaleDateString('it-IT')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Actual hours form */}
                            <section className="border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dati Consuntivo</h2>
                                </div>
                                <div className="space-y-5">
                                    {/* Actual hours (required) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="actual-hours" className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            Ore Effettive *
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                id="actual-hours"
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={actualHours}
                                                onChange={e => setActualHours(e.target.value)}
                                                placeholder="es. 40"
                                                className="max-w-[200px]"
                                            />
                                            {deviation !== null && (
                                                <Badge
                                                    variant={deviationColor as any}
                                                    className={`text-sm px-3 py-1 ${deviationBadgeClass}`}
                                                >
                                                    {deviation > 0 ? '+' : ''}{deviation}% scostamento
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Il numero totale di ore realmente impiegate per completare il requisito.
                                        </p>
                                    </div>

                                    {/* Dates (optional) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="actual-start" className="flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4 text-slate-400" />
                                                Data Inizio Reale
                                            </Label>
                                            <Input
                                                id="actual-start"
                                                type="date"
                                                value={actualStartDate}
                                                onChange={e => setActualStartDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="actual-end" className="flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4 text-slate-400" />
                                                Data Fine Reale
                                            </Label>
                                            <Input
                                                id="actual-end"
                                                type="date"
                                                value={actualEndDate}
                                                onChange={e => setActualEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="space-y-2">
                                        <Label htmlFor="actual-notes">Note Consuntivo</Label>
                                        <Textarea
                                            id="actual-notes"
                                            value={actualNotes}
                                            onChange={e => setActualNotes(e.target.value)}
                                            placeholder="Eventuali note sulla lavorazione reale..."
                                            rows={3}
                                        />
                                    </div>

                                    {/* Last update info */}
                                    {selectedEstimation.actual_recorded_at && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            Ultimo aggiornamento:{' '}
                                            {new Date(selectedEstimation.actual_recorded_at).toLocaleString('it-IT')}
                                        </div>
                                    )}

                                    {/* Save button */}
                                    <div className="flex justify-end pt-2">
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || !actualHours}
                                            className="min-w-[160px]"
                                        >
                                            {saving ? (
                                                <>
                                                    <span className="animate-spin mr-2">⏳</span>
                                                    Salvataggio...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Salva Consuntivo
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </section>

                            {/* Deviation summary */}
                            {deviation !== null && (
                                <div className={`border-l-4 rounded-lg p-4 ${Math.abs(deviation) <= 10
                                    ? 'border-l-emerald-500 bg-emerald-50/50'
                                    : Math.abs(deviation) <= 25
                                        ? 'border-l-amber-500 bg-amber-50/50'
                                        : 'border-l-red-500 bg-red-50/50'
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        {Math.abs(deviation) <= 10 ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                                        ) : (
                                            <AlertTriangle className={`w-5 h-5 mt-0.5 ${Math.abs(deviation) <= 25 ? 'text-amber-600' : 'text-red-600'
                                                }`} />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">
                                                {Math.abs(deviation) <= 10
                                                    ? 'Stima accurata'
                                                    : Math.abs(deviation) <= 25
                                                        ? 'Scostamento moderato'
                                                        : 'Scostamento significativo'}
                                            </p>
                                            <p className="text-xs text-slate-600 mt-1">
                                                {deviation > 0
                                                    ? `Il lavoro effettivo ha richiesto ${deviation.toFixed(1)}% in più rispetto alla stima.`
                                                    : `Il lavoro effettivo ha richiesto ${Math.abs(deviation).toFixed(1)}% in meno rispetto alla stima.`}
                                                {' '}
                                                (Stimato: {selectedEstimation.total_days.toFixed(1)} gg, Effettivo: {(parseFloat(actualHours) / 8).toFixed(1)} gg)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
