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
    risks
}: HistoryTabProps) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
                <div className="container mx-auto px-6 py-3 h-full">
                    <div className="grid grid-cols-2 gap-4 h-full">
                        {/* Left: History List */}
                        <div className="flex flex-col overflow-hidden">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                                <History className="w-4 h-4 text-slate-500" />
                                Estimation History
                            </h3>
                            <div className="flex-1 overflow-y-auto">
                                <HistorySection
                                    history={history}
                                    loading={loading}
                                    totalCount={totalCount}
                                    page={page}
                                    pageSize={pageSize}
                                    onPageChange={onPageChange}
                                />
                            </div>
                        </div>

                        {/* Right: Comparison Chart */}
                        <div className="flex flex-col overflow-hidden">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                                <Calculator className="w-4 h-4 text-slate-500" />
                                Compare Scenarios
                            </h3>
                            <Card className="rounded-xl shadow-sm border-slate-200 bg-white flex-1 overflow-hidden">
                                <CardContent className="p-0 h-full overflow-y-auto">
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
