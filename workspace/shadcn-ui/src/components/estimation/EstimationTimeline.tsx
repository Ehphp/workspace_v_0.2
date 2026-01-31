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
    assignedId?: string | null;
    onAssign?: (id: string) => void;
    assigning?: string | null;
}

export function EstimationTimeline({ estimations, selectedIds, onSelectionChange, assignedId, onAssign, assigning }: EstimationTimelineProps) {
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

    const CustomDotWithChip = (props: any) => {
        const { cx, cy, payload } = props;
        const isSelected = selectedIds.includes(payload.id);
        const isAssigned = payload.id === assignedId;
        const isAssigning = assigning === payload.id;

        return (
            <g onClick={() => handleDotClick(payload)} style={{ cursor: 'pointer' }}>
                {/* Punto del grafico */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 8 : 5}
                    fill={isAssigned ? '#10b981' : isSelected ? "hsl(var(--primary))" : "white"}
                    stroke={isAssigned ? '#10b981' : "hsl(var(--primary))"}
                    strokeWidth={2}
                    className="transition-all duration-300 ease-in-out"
                />
                {isSelected && (
                    <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill={isAssigned ? '#10b981' : "hsl(var(--primary))"}
                        opacity={0.2}
                        className="animate-pulse"
                    />
                )}

                {/* Chip Button usando foreignObject */}
                <foreignObject
                    x={cx - 30}
                    y={cy - 42}
                    width={60}
                    height={24}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            pointerEvents: 'auto'
                        }}
                    >
                        {isAssigned ? (
                            <div
                                className="
                                    px-2 py-0.5 
                                    rounded-full 
                                    bg-green-100 
                                    border border-green-300
                                    text-green-700
                                    text-[10px] 
                                    font-semibold
                                    flex items-center gap-1
                                    shadow-sm
                                    pointer-events-none
                                "
                            >
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>Active</span>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAssign?.(payload.id);
                                }}
                                disabled={isAssigning}
                                className="
                                    px-2.5 py-0.5
                                    rounded-full
                                    bg-blue-50
                                    hover:bg-blue-100
                                    border border-blue-300
                                    text-blue-700
                                    text-[10px]
                                    font-semibold
                                    transition-all
                                    hover:scale-105
                                    active:scale-95
                                    shadow-sm
                                    hover:shadow-md
                                    disabled:opacity-50
                                    disabled:cursor-not-allowed
                                "
                            >
                                {isAssigning ? (
                                    <span className="flex items-center gap-1">
                                        <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        ...
                                    </span>
                                ) : (
                                    'Use'
                                )}
                            </button>
                        )}
                    </div>
                </foreignObject>
            </g>
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
                        Click on two points to compare versions • Use chips to assign estimation
                    </p>
                </CardHeader>
                <CardContent className="px-0">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={sortedData}
                                margin={{ top: 50, right: 30, left: 0, bottom: 0 }}
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
                                    dot={<CustomDotWithChip />}
                                    activeDot={<CustomDotWithChip />}
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
