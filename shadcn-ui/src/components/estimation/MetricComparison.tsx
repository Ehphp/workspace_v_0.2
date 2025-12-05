import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EstimationHistoryItem } from '@/hooks/useEstimationHistory';
import type { Activity } from '@/types/database';

interface MetricComparisonProps {
    older: EstimationHistoryItem;
    newer: EstimationHistoryItem;
    activities: Activity[];
}

export function MetricComparison({ older, newer, activities }: MetricComparisonProps) {
    const diffDays = newer.total_days - older.total_days;
    const diffPercent = older.total_days !== 0 ? ((diffDays / older.total_days) * 100).toFixed(1) : '0';

    // Activity differences
    const olderActivityIds = new Set(older.estimation_activities?.map(a => a.activity_id) || []);
    const newerActivityIds = new Set(newer.estimation_activities?.map(a => a.activity_id) || []);

    const addedActivities = newer.estimation_activities?.filter(a => !olderActivityIds.has(a.activity_id)) || [];
    const removedActivities = older.estimation_activities?.filter(a => !newerActivityIds.has(a.activity_id)) || [];
    const unchangedActivities = newer.estimation_activities?.filter(a => olderActivityIds.has(a.activity_id)) || [];

    return (
        <Card className="h-full rounded-xl shadow-sm border-slate-200 bg-white flex flex-col">
            {/* Compact Header with Diff Badge */}
            <div className="bg-gradient-to-r from-slate-50 to-orange-50 border-b border-slate-200 p-2 flex items-center justify-between flex-shrink-0">
                <div className="text-xs font-bold text-slate-700">Version Comparison</div>
                <div className={cn("flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px]",
                    diffDays > 0 ? "bg-red-50 text-red-700" : diffDays < 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"
                )}>
                    {diffDays > 0 ? <TrendingUp className="w-3 h-3" /> : diffDays < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {diffDays > 0 ? '+' : ''}{diffDays.toFixed(1)}d
                </div>
            </div>

            {/* Dual Column Layout */}
            <CardContent className="p-3 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                    {/* LEFT COLUMN - Older Estimation */}
                    <div className="flex flex-col min-h-0 border-r border-slate-200 pr-3">
                        {/* Old Header */}
                        <div className="mb-2 pb-2 border-b border-slate-200">
                            <div className="text-[10px] text-slate-500 mb-1">Previous Version</div>
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-700">{older.total_days.toFixed(1)} days</div>
                                <div className="text-[9px] text-slate-400">
                                    {format(new Date(older.created_at), 'MMM d, HH:mm')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                                <span>{older.base_hours}h</span>
                                <span>•</span>
                                <span>Risk {older.risk_score}</span>
                            </div>
                        </div>

                        {/* Old Activities */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="text-[10px] font-semibold text-slate-600 mb-1.5">
                                Activities ({older.estimation_activities?.length || 0})
                            </div>
                            <div className="space-y-1">
                                {older.estimation_activities?.map((estAct) => {
                                    const activity = activities.find(a => a.id === estAct.activity_id);
                                    if (!activity) return null;

                                    const isRemoved = !newerActivityIds.has(estAct.activity_id);

                                    return (
                                        <div
                                            key={estAct.id}
                                            className={cn(
                                                "flex items-center justify-between p-1.5 rounded text-xs",
                                                isRemoved
                                                    ? "bg-red-50 border border-red-200 line-through opacity-60"
                                                    : "bg-slate-50 border border-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "truncate flex-1",
                                                isRemoved ? "text-red-700" : "text-slate-700"
                                            )}>
                                                {activity.name}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] ml-2",
                                                isRemoved ? "text-red-600" : "text-slate-500"
                                            )}>
                                                {activity.base_hours}h
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Old Scenario */}
                        <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="text-[9px] text-slate-500">
                                <span className="font-semibold text-slate-600">{older.scenario_name}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Newer Estimation */}
                    <div className="flex flex-col min-h-0">
                        {/* New Header */}
                        <div className="mb-2 pb-2 border-b border-slate-200">
                            <div className="text-[10px] text-slate-500 mb-1">Current Version</div>
                            <div className="flex items-center justify-between">
                                <div className={cn(
                                    "text-xs font-bold",
                                    diffDays > 0 ? "text-red-700" : diffDays < 0 ? "text-green-700" : "text-blue-700"
                                )}>
                                    {newer.total_days.toFixed(1)} days
                                </div>
                                <div className="text-[9px] text-slate-400">
                                    {format(new Date(newer.created_at), 'MMM d, HH:mm')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                                <span>{newer.base_hours}h</span>
                                <span>•</span>
                                <span>Risk {newer.risk_score}</span>
                            </div>
                        </div>

                        {/* New Activities */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="text-[10px] font-semibold text-slate-600 mb-1.5">
                                Activities ({newer.estimation_activities?.length || 0})
                            </div>
                            <div className="space-y-1">
                                {newer.estimation_activities?.map((estAct) => {
                                    const activity = activities.find(a => a.id === estAct.activity_id);
                                    if (!activity) return null;

                                    const isAdded = !olderActivityIds.has(estAct.activity_id);

                                    return (
                                        <div
                                            key={estAct.id}
                                            className={cn(
                                                "flex items-center justify-between p-1.5 rounded text-xs",
                                                isAdded
                                                    ? "bg-green-50 border border-green-200"
                                                    : "bg-slate-50 border border-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "truncate flex-1",
                                                isAdded ? "text-green-800 font-medium" : "text-slate-700"
                                            )}>
                                                {activity.name}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] ml-2",
                                                isAdded ? "text-green-600" : "text-slate-500"
                                            )}>
                                                {activity.base_hours}h
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* New Scenario */}
                        <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="text-[9px] text-slate-500">
                                <span className="font-semibold text-slate-600">{newer.scenario_name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

