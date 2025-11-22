import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { EstimationHistoryItem } from '@/hooks/useEstimationHistory';

interface EstimationTimelineProps {
    estimations: EstimationHistoryItem[];
}

export function EstimationTimeline({ estimations }: EstimationTimelineProps) {
    if (estimations.length === 0) {
        return null;
    }

    // Sort by date ascending for timeline
    const sortedEstimations = [...estimations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const minDays = Math.min(...sortedEstimations.map((e) => e.total_days));
    const maxDays = Math.max(...sortedEstimations.map((e) => e.total_days));
    const avgDays = sortedEstimations.reduce((sum, e) => sum + e.total_days, 0) / sortedEstimations.length;

    // Calculate trend
    const firstDays = sortedEstimations[0].total_days;
    const lastDays = sortedEstimations[sortedEstimations.length - 1].total_days;
    const trend = lastDays - firstDays;
    const trendPercent = ((trend / firstDays) * 100).toFixed(1);

    return (
        <Card className="rounded-xl shadow-lg border-white/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 backdrop-blur-sm">
            <CardContent className="p-3">
                {/* Compact Stats in a Single Row */}
                <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="text-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg flex-1">
                        <div className="text-[10px] text-slate-600 mb-0.5">Min</div>
                        <div className="text-lg font-bold text-green-600">{minDays.toFixed(1)}</div>
                    </div>
                    <div className="text-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg flex-1">
                        <div className="text-[10px] text-slate-600 mb-0.5">Max</div>
                        <div className="text-lg font-bold text-red-600">{maxDays.toFixed(1)}</div>
                    </div>
                    <div className="text-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg flex-1">
                        <div className="text-[10px] text-slate-600 mb-0.5">Avg</div>
                        <div className="text-lg font-bold text-blue-600">{avgDays.toFixed(1)}</div>
                    </div>
                    <div className="text-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg flex-1">
                        <div className="text-[10px] text-slate-600 mb-0.5">Trend</div>
                        <div className="text-lg font-bold flex items-center justify-center gap-1">
                            {trend > 0 ? (
                                <>
                                    <TrendingUp className="h-3 w-3 text-red-500" />
                                    <span className="text-red-500">{trendPercent}%</span>
                                </>
                            ) : trend < 0 ? (
                                <>
                                    <TrendingDown className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500">{trendPercent}%</span>
                                </>
                            ) : (
                                <span className="text-slate-600">0%</span>
                            )}
                        </div>
                    </div>
                    <div className="text-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg flex-1">
                        <div className="text-[10px] text-slate-600 mb-0.5">Total</div>
                        <div className="text-lg font-bold text-purple-600">{estimations.length}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
