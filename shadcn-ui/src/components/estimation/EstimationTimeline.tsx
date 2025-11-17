import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface EstimationTimelineProps {
    estimations: any[];
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
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Estimation Timeline
                </CardTitle>
                <CardDescription className="text-xs">
                    Evolution of estimates over time
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6 text-xs">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-muted-foreground mb-1">Minimum</div>
                        <div className="text-lg font-bold text-green-600">{minDays.toFixed(1)}</div>
                        <div className="text-muted-foreground">days</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-muted-foreground mb-1">Maximum</div>
                        <div className="text-lg font-bold text-red-600">{maxDays.toFixed(1)}</div>
                        <div className="text-muted-foreground">days</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-muted-foreground mb-1">Average</div>
                        <div className="text-lg font-bold text-blue-600">{avgDays.toFixed(1)}</div>
                        <div className="text-muted-foreground">days</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-muted-foreground mb-1">Trend</div>
                        <div className="text-lg font-bold flex items-center justify-center gap-1">
                            {trend > 0 ? (
                                <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="h-4 w-4 text-green-500" />
                            ) : null}
                            <span className={trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : ''}>
                                {trendPercent}%
                            </span>
                        </div>
                        <div className="text-muted-foreground">change</div>
                    </div>
                </div>

                {/* Visual Timeline */}
                <div className="relative space-y-4">
                    {sortedEstimations.map((est, index) => {
                        const isFirst = index === 0;
                        const isLast = index === sortedEstimations.length - 1;
                        const prevEst = index > 0 ? sortedEstimations[index - 1] : null;
                        const daysDiff = prevEst ? est.total_days - prevEst.total_days : 0;

                        // Calculate bar width percentage (relative to max)
                        const widthPercent = (est.total_days / maxDays) * 100;

                        return (
                            <div key={est.id} className="relative">
                                {/* Connecting line */}
                                {!isFirst && (
                                    <div className="absolute left-3 -top-4 w-0.5 h-4 bg-gray-300" />
                                )}

                                <div className="flex items-start gap-4">
                                    {/* Timeline dot */}
                                    <div className="relative flex-shrink-0">
                                        <div
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${isFirst
                                                    ? 'bg-green-100 border-green-500 text-green-700'
                                                    : isLast
                                                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                                                        : 'bg-gray-100 border-gray-400 text-gray-600'
                                                }`}
                                        >
                                            {index + 1}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-2">
                                            <div>
                                                <div className="font-semibold text-sm">{est.scenario_name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(est.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-bold">{est.total_days.toFixed(1)}</div>
                                                {!isFirst && daysDiff !== 0 && (
                                                    <div
                                                        className={`text-xs font-semibold flex items-center justify-end gap-1 ${daysDiff > 0 ? 'text-red-500' : 'text-green-500'
                                                            }`}
                                                    >
                                                        {daysDiff > 0 ? '+' : ''}
                                                        {daysDiff.toFixed(1)}
                                                        {daysDiff > 0 ? (
                                                            <TrendingUp className="h-3 w-3" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Visual bar */}
                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${isFirst
                                                        ? 'bg-green-500'
                                                        : isLast
                                                            ? 'bg-blue-500'
                                                            : 'bg-gray-400'
                                                    }`}
                                                style={{ width: `${widthPercent}%` }}
                                            />
                                        </div>

                                        {/* Details */}
                                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <span className="font-medium">Base:</span> {est.base_days.toFixed(1)}d
                                            </div>
                                            <div>
                                                <span className="font-medium">Mult:</span> {est.driver_multiplier.toFixed(2)}x
                                            </div>
                                            <div>
                                                <span className="font-medium">Risk:</span> {est.risk_score} ({est.contingency_percent}%)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t flex justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">First Estimate</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Latest Estimate</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        <span className="text-muted-foreground">Intermediate</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
