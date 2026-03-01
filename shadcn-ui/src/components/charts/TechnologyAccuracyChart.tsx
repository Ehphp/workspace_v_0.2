/**
 * TechnologyAccuracyChart — Avg deviation by technology (grouped bar chart).
 *
 * Each bar = one technology preset, height = average absolute deviation %.
 * Sprint 2 — S2-3b
 */

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { TechnologyAccuracy } from '@/hooks/useAccuracyData';

interface Props {
    data: TechnologyAccuracy[];
}

const PALETTE = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#f97316', '#eab308',
    '#22c55e', '#14b8a6',
];

export function TechnologyAccuracyChart({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-500">Nessun dato disponibile</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                margin={{ top: 10, right: 20, bottom: 30, left: 10 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                    dataKey="technology"
                    tick={{ fontSize: 11 }}
                    height={60}
                    angle={-25}
                />
                <YAxis
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Scostamento medio %', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12 }}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(4px)',
                    }}
                    formatter={(value: number, _name: string, props: any) => [
                        `${value.toFixed(1)}% (${props.payload.count} stime)`,
                        'Scostamento medio',
                    ]}
                />
                <Bar dataKey="avgDeviation" radius={[4, 4, 0, 0]}>
                    {data.map((_entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={PALETTE[index % PALETTE.length]}
                            fillOpacity={0.85}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
