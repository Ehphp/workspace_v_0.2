import { Card, CardContent } from '@/components/ui/card';
import { HistorySection } from '../HistorySection';
import { EstimationComparison } from '@/components/estimation/EstimationComparison';
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
    return (
        <div className="flex flex-col">
            <div className="flex-1">
                <div className="container mx-auto px-6 py-3">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Left: History List */}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                                <History className="w-4 h-4 text-slate-500" />
                                Estimation History
                            </h3>
                            <div className="flex-1">
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
                                />
                            </div>
                        </div>

                        {/* Right: Comparison Chart */}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                                <Calculator className="w-4 h-4 text-slate-500" />
                                Compare Scenarios
                            </h3>
                            <Card className="rounded-xl shadow-sm border-slate-200 bg-white flex-1">
                                <CardContent className="p-0">
                                    <EstimationComparison
                                        estimations={history}
                                        activities={activities}
                                        drivers={drivers}
                                        risks={risks}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
