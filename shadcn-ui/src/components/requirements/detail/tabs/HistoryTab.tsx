import { useState, useMemo } from 'react';
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

    const selectedEstimations = useMemo(() => {
        if (selectedIds.length !== 2) return null;
        const first = history.find(e => e.id === selectedIds[0]);
        const second = history.find(e => e.id === selectedIds[1]);

        if (!first || !second) return null;

        // Ensure chronological order for comparison
        const [older, newer] = new Date(first.created_at).getTime() < new Date(second.created_at).getTime()
            ? [first, second]
            : [second, first];

        return { older, newer };
    }, [selectedIds, history]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 p-3">
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
                                <MetricComparison older={selectedEstimations.older} newer={selectedEstimations.newer} />
                            ) : (
                                <Card className="h-full rounded-xl shadow-sm border-slate-200 bg-white flex items-center justify-center">
                                    <CardContent>
                                        <div className="text-center text-slate-400 text-sm">
                                            Select two estimations from the history to compare
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
