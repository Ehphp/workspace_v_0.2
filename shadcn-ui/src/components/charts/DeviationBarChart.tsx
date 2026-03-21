/**
 * DeviationBarChart — Top-N deviations (horizontal bar chart).
 *
 * Red bars = under-estimated (actual > estimated), green = over-estimated.
 * Sprint 2 — S2-3b
 */

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { ScatterDatum } from '@/hooks/useAccuracyData';
import { CHART_COLORS } from '@/lib/constants';

interface Props {
    data: ScatterDatum[];
    maxItems?: number;
}

export function DeviationBarChart({ data, maxItems = 10 }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-500">Nessun dato disponibile</p>
            </div>
        );
    }

    // Sort by absolute deviation descending, take top N
    const sorted = [...data]
        .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
        .slice(0, maxItems)
        .map(d => ({
            name: d.title.length > 30 ? `${d.title.slice(0, 28)}…` : d.title,
            deviation: d.deviationPercent,
            fullTitle: d.title,
            technology: d.technology,
        }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 30, bottom: 10, left: 10 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Scostamento %', position: 'insideBottom', offset: -5, fontSize: 12 }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={180}
                    tick={{ fontSize: 11 }}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(4px)',
                    }}
                    formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'Scostamento']}
                    labelFormatter={(_label: any, payload: any[]) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.fullTitle} · ${item.technology}` : '';
                    }}
                />
                <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
                    {sorted.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.deviation > 0 ? CHART_COLORS[4] : CHART_COLORS[2]}
                            fillOpacity={0.8}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
