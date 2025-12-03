import React, { useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    TooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { EstimationHistoryItem } from '@/hooks/useEstimationHistory';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EstimationTimelineProps {
    estimations: EstimationHistoryItem[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function EstimationTimeline({ estimations, selectedIds, onSelectionChange }: EstimationTimelineProps) {
    // Sort by date ascending for the chart
    const sortedData = useMemo(() => {
        return [...estimations].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }, [estimations]);

    const handleDotClick = (payload: any) => {
        const id = payload.id;
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(item => item !== id));
        } else if (selectedIds.length >= 2) {
            onSelectionChange([selectedIds[1], id]); // Keep the last one and add new one
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        const isSelected = selectedIds.includes(payload.id);

        return (
            <g onClick={() => handleDotClick(payload)} style={{ cursor: 'pointer' }}>
                <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 8 : 5}
                    fill={isSelected ? "hsl(var(--primary))" : "white"}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    className="transition-all duration-300 ease-in-out"
                />
                {isSelected && (
                    <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="hsl(var(--primary))"
                        opacity={0.2}
                        className="animate-pulse"
                    />
                )}
            </g>
        );
    };

    const CustomActiveDot = (props: any) => {
        const { cx, cy, payload } = props;
        return (
            <circle
                cx={cx}
                cy={cy}
                r={8}
                fill="hsl(var(--primary))"
                stroke="white"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    e.stopPropagation();
                    handleDotClick(payload);
                }}
            />
        );
    };

    const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as EstimationHistoryItem;
            return (
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 p-3 rounded-lg shadow-xl text-xs">
                    <p className="font-bold text-slate-900 mb-1">{format(new Date(data.created_at), 'PP p')}</p>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Total Days:</span>
                            <span className="font-bold text-primary">{data.total_days.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Scenario:</span>
                            <span className="font-medium text-slate-700">{data.scenario_name}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Risk Score:</span>
                            <span className="font-medium text-amber-600">{data.risk_score}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (estimations.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-lg font-medium text-slate-800">Estimation Evolution</CardTitle>
                    <p className="text-sm text-slate-500">
                        Click on two points to compare versions
                    </p>
                </CardHeader>
                <CardContent className="px-0">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={sortedData}
                                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="created_at"
                                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}d`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="total_days"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={<CustomDot />}
                                    activeDot={<CustomActiveDot />}
                                    animationDuration={1000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
