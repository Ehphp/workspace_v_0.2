import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EstimationHistoryItem } from '@/hooks/useEstimationHistory';

interface MetricComparisonProps {
    older: EstimationHistoryItem;
    newer: EstimationHistoryItem;
}

export function MetricComparison({ older, newer }: MetricComparisonProps) {
    const diffDays = newer.total_days - older.total_days;
    const diffPercent = older.total_days !== 0 ? ((diffDays / older.total_days) * 100).toFixed(1) : '0';

    const MetricDiff = ({ label, oldVal, newVal, format = (v: number) => v.toFixed(1) }: any) => {
        const diff = newVal - oldVal;
        const isPositive = diff > 0;
        const isZero = diff === 0;

        return (
            <div className="flex items-center justify-between py-1 px-2 bg-slate-50/50 rounded text-xs">
                <span className="text-slate-600">{label}</span>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] text-slate-400 line-through">{format(oldVal)}</div>
                    <ArrowRight className="w-2 h-2 text-slate-400" />
                    <div className={cn("font-bold",
                        isZero ? "text-slate-700" :
                            isPositive ? "text-red-600" : "text-green-600"
                    )}>
                        {format(newVal)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-white overflow-hidden">
            {/* Header - Compact */}
            <div className="bg-slate-50/80 border-b border-slate-100 p-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-white text-[10px] px-1.5 h-5">
                        {format(new Date(older.created_at), 'MMM d, HH:mm')}
                    </Badge>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <Badge variant="outline" className="bg-white text-[10px] px-1.5 h-5">
                        {format(new Date(newer.created_at), 'MMM d, HH:mm')}
                    </Badge>
                </div>
                <div className={cn("flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px]",
                    diffDays > 0 ? "bg-red-50 text-red-700" : diffDays < 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"
                )}>
                    {diffDays > 0 ? <TrendingUp className="w-3 h-3" /> : diffDays < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {diffDays > 0 ? '+' : ''}{diffDays.toFixed(1)}d ({diffDays > 0 ? '+' : ''}{diffPercent}%)
                </div>
            </div>

            <CardContent className="p-3 flex-1 overflow-y-auto min-h-0 space-y-3">
                {/* Metrics Section */}
                <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-0.5 h-3 bg-primary rounded-full"></span>
                        Metrics
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                        <MetricDiff label="Base Days" oldVal={older.base_days} newVal={newer.base_days} />
                        <MetricDiff label="Driver Multiplier" oldVal={older.driver_multiplier} newVal={newer.driver_multiplier} format={(v: number) => v.toFixed(2) + 'x'} />
                        <MetricDiff label="Risk Score" oldVal={older.risk_score} newVal={newer.risk_score} format={(v: number) => v.toFixed(0)} />
                        <MetricDiff label="Contingency" oldVal={older.contingency_percent} newVal={newer.contingency_percent} format={(v: number) => v.toFixed(0) + '%'} />
                    </div>
                </div>

                {/* Content Changes Section */}
                <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-0.5 h-3 bg-blue-500 rounded-full"></span>
                        Content
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-blue-50/50 rounded border border-blue-100 text-center">
                            <div className="text-[10px] text-blue-600 font-medium mb-0.5">Activities</div>
                            <div className="text-sm font-bold text-blue-700 leading-none">
                                {newer.estimation_activities?.length || 0}
                            </div>
                            <div className="text-[9px] text-blue-400 mt-0.5">
                                was {older.estimation_activities?.length || 0}
                            </div>
                        </div>
                        <div className="p-2 bg-purple-50/50 rounded border border-purple-100 text-center">
                            <div className="text-[10px] text-purple-600 font-medium mb-0.5">Drivers</div>
                            <div className="text-sm font-bold text-purple-700 leading-none">
                                {newer.estimation_drivers?.length || 0}
                            </div>
                            <div className="text-[9px] text-purple-400 mt-0.5">
                                was {older.estimation_drivers?.length || 0}
                            </div>
                        </div>
                        <div className="p-2 bg-amber-50/50 rounded border border-amber-100 text-center">
                            <div className="text-[10px] text-amber-600 font-medium mb-0.5">Risks</div>
                            <div className="text-sm font-bold text-amber-700 leading-none">
                                {newer.estimation_risks?.length || 0}
                            </div>
                            <div className="text-[9px] text-amber-400 mt-0.5">
                                was {older.estimation_risks?.length || 0}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
