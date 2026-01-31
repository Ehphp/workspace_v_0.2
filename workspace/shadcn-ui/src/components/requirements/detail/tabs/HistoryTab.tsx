import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HistorySection } from '../HistorySection';
import { MetricComparison } from '@/components/estimation/MetricComparison';
import { History, Calculator } from 'lucide-react';
import type { Activity, Driver, Risk } from '@/types/database';

interface HistoryTabProps {
    history: any[];
    loading: boolean;
    totalCount: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    activities: Activity[];
    drivers: Driver[];
    risks: Risk[];
    assignedEstimationId?: string | null;
    onAssign?: () => void;
    requirementId: string;
}

export function HistoryTab({
    history,
    loading,
    totalCount,
    page,
    pageSize,
    onPageChange,
    activities,
    drivers,
    risks,
    assignedEstimationId,
    onAssign,
    requirementId
}: HistoryTabProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Default selection logic: Active > Most Recent
    useEffect(() => {
        // Run if we have history and (no selection OR we haven't initialized yet) to ensure default on first load
        if (history.length > 0 && (selectedIds.length === 0 || !hasInitialized)) {
            // Check if we already have a valid selection that exists in history, if so, don't override unless forced
            // But requirement is "always default selected if available"

            if (selectedIds.length === 0) {
                const active = history.find(h => h.id === assignedEstimationId);
                if (active) {
                    setSelectedIds([active.id]);
                } else {
                    // Default to most recent (first item)
                    setSelectedIds([history[0].id]);
                }
                setHasInitialized(true);
            }
        }
    }, [history, assignedEstimationId, selectedIds.length, hasInitialized]);

    const selectedEstimations = useMemo(() => {
        if (selectedIds.length === 0) return null;

        // Single selection: show details
        if (selectedIds.length === 1) {
            const single = history.find(e => e.id === selectedIds[0]);
            return single ? { single } : null;
        }

        // Two selections: show comparison
        if (selectedIds.length === 2) {
            const first = history.find(e => e.id === selectedIds[0]);
            const second = history.find(e => e.id === selectedIds[1]);

            if (!first || !second) return null;

            // Ensure chronological order for comparison
            const [older, newer] = new Date(first.created_at).getTime() < new Date(second.created_at).getTime()
                ? [first, second]
                : [second, first];

            return { older, newer };
        }

        return null;
    }, [selectedIds, history]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 container mx-auto px-6 py-4">
                <div className="grid grid-cols-2 gap-5 h-full">
                    {/* Left: History List */}
                    <div className="flex flex-col min-h-0">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-3 mb-3 shrink-0">
                            <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-md">
                                <History className="w-4 h-4 text-white" />
                            </div>
                            Storico Stime
                        </h3>
                        <div className="flex-1 min-h-0 overflow-hidden pr-2">
                            <HistorySection
                                history={history}
                                loading={loading}
                                totalCount={totalCount}
                                page={page}
                                pageSize={pageSize}
                                onPageChange={onPageChange}
                                assignedEstimationId={assignedEstimationId}
                                onAssign={onAssign}
                                requirementId={requirementId}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </div>
                    </div>

                    {/* Right: Comparison Chart */}
                    <div className="flex flex-col min-h-0">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-3 mb-3 shrink-0">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                                <Calculator className="w-4 h-4 text-white" />
                            </div>
                            Confronta Scenari
                        </h3>
                        <div className="flex-1 min-h-0">
                            {selectedEstimations ? (
                                'single' in selectedEstimations ? (
                                    // Single estimation view
                                    <Card className="h-full rounded-2xl shadow-lg border-slate-200/50 bg-white/90 backdrop-blur-xl flex flex-col">
                                        {/* Estimation Details Header */}
                                        <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200/50 p-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
                                            <div className="text-sm font-bold text-slate-700">Dettagli Stima</div>
                                            <div className="flex items-center gap-1.5 font-bold px-3 py-1 bg-blue-100 rounded-full text-xs text-blue-700 shadow-sm">
                                                <Calculator className="w-3.5 h-3.5" />
                                                Selezionato
                                            </div>
                                        </div>

                                        {/* Single Column Layout (Full Width) */}
                                        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">
                                            <div className="flex flex-col min-h-0 h-full">
                                                {/* Header Info */}
                                                <div className="mb-3 pb-3 border-b border-slate-200">
                                                    <div className="text-xs text-slate-500 mb-1">Versione Corrente</div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-lg font-bold text-slate-900">{selectedEstimations.single.total_days.toFixed(1)} giorni</div>
                                                        <div className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                                            {new Date(selectedEstimations.single.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded-lg">{selectedEstimations.single.base_hours}h base</span>
                                                        <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-lg">Rischio {selectedEstimations.single.risk_score}</span>
                                                    </div>
                                                </div>

                                                {/* Activities */}
                                                <div className="flex-1 overflow-y-auto min-h-0">
                                                    <div className="text-xs font-bold text-slate-600 mb-2">
                                                        Attività ({selectedEstimations.single.estimation_activities?.length || 0})
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {selectedEstimations.single.estimation_activities?.map((estAct) => {
                                                            const activity = activities.find(a => a.id === estAct.activity_id);
                                                            if (!activity) return null;

                                                            return (
                                                                <div
                                                                    key={estAct.id}
                                                                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/50 text-sm hover:bg-slate-100 transition-colors"
                                                                >
                                                                    <span className="text-slate-700 truncate flex-1">{activity.name}</span>
                                                                    <span className="text-xs text-slate-500 ml-2 bg-white px-2 py-0.5 rounded-lg">{activity.base_hours}h</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Scenario Footer */}
                                                <div className="mt-3 pt-3 border-t border-slate-200">
                                                    <div className="text-xs text-slate-500">
                                                        Scenario: <span className="font-bold text-slate-700">{selectedEstimations.single.scenario_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    // Comparison view (2 estimations)
                                    <MetricComparison older={selectedEstimations.older} newer={selectedEstimations.newer} activities={activities} />
                                )
                            ) : (
                                <Card className="h-full rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl flex items-center justify-center">
                                    <CardContent>
                                        <div className="text-center text-slate-400 text-sm">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                <Calculator className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="font-medium">Seleziona una stima per vedere i dettagli</p>
                                            <p className="text-xs mt-1 text-slate-300">oppure due per confrontarle</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
