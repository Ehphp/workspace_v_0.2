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
            <div className="flex-1 min-h-0 container mx-auto px-6 py-3">
                <div className="grid grid-cols-2 gap-4 h-full">
                    {/* Left: History List */}
                    <div className="flex flex-col min-h-0">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2 shrink-0">
                            <History className="w-4 h-4 text-slate-500" />
                            Estimation History
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
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2 shrink-0">
                            <Calculator className="w-4 h-4 text-slate-500" />
                            Compare Scenarios
                        </h3>
                        <div className="flex-1 min-h-0">
                            {selectedEstimations ? (
                                'single' in selectedEstimations ? (
                                    // Single estimation view
                                    <Card className="h-full rounded-xl shadow-sm border-slate-200 bg-white flex flex-col">
                                        {/* Estimation Details Header */}
                                        <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 p-2 flex items-center justify-between flex-shrink-0">
                                            <div className="text-xs font-bold text-slate-700">Estimation Details</div>
                                            <div className="flex items-center gap-1 font-bold px-2 py-0.5 bg-blue-50 rounded-full text-[10px] text-blue-700">
                                                <Calculator className="w-3 h-3" />
                                                Selected
                                            </div>
                                        </div>

                                        {/* Single Column Layout (Full Width) */}
                                        <CardContent className="p-3 flex-1 overflow-hidden flex flex-col min-h-0">
                                            <div className="flex flex-col min-h-0 h-full">
                                                {/* Header Info */}
                                                <div className="mb-2 pb-2 border-b border-slate-200">
                                                    <div className="text-[10px] text-slate-500 mb-1">Current Version</div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs font-bold text-slate-700">{selectedEstimations.single.total_days.toFixed(1)} days</div>
                                                        <div className="text-[9px] text-slate-400">
                                                            {new Date(selectedEstimations.single.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                                                        <span>{selectedEstimations.single.base_hours}h</span>
                                                        <span>•</span>
                                                        <span>Risk {selectedEstimations.single.risk_score}</span>
                                                    </div>
                                                </div>

                                                {/* Activities */}
                                                <div className="flex-1 overflow-y-auto min-h-0">
                                                    <div className="text-[10px] font-semibold text-slate-600 mb-1.5">
                                                        Activities ({selectedEstimations.single.estimation_activities?.length || 0})
                                                    </div>
                                                    <div className="space-y-1">
                                                        {selectedEstimations.single.estimation_activities?.map((estAct) => {
                                                            const activity = activities.find(a => a.id === estAct.activity_id);
                                                            if (!activity) return null;

                                                            return (
                                                                <div
                                                                    key={estAct.id}
                                                                    className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-xs"
                                                                >
                                                                    <span className="text-slate-700 truncate flex-1">{activity.name}</span>
                                                                    <span className="text-[9px] text-slate-500 ml-2">{activity.base_hours}h</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Scenario Footer */}
                                                <div className="mt-2 pt-2 border-t border-slate-200">
                                                    <div className="text-[9px] text-slate-500">
                                                        <span className="font-semibold text-slate-600">{selectedEstimations.single.scenario_name}</span>
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
                                <Card className="h-full rounded-xl shadow-sm border-slate-200 bg-white flex items-center justify-center">
                                    <CardContent>
                                        <div className="text-center text-slate-400 text-sm">
                                            Select one estimation to view details or two to compare
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
