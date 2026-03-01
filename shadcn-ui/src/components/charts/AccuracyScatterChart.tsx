/**
 * AccuracyScatterChart — Estimated vs Actual days scatter plot.
 *
 * Each dot is one estimation with actuals. A dashed y=x reference line
 * represents perfect estimation. Points above = under-estimated,
 * below = over-estimated.
 *
 * Sprint 2 — S2-3b
 */

import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts';
import type { ScatterDatum } from '@/hooks/useAccuracyData';

interface Props {
    data: ScatterDatum[];
}

export function AccuracyScatterChart({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-500">Nessun dato disponibile</p>
            </div>
        );
    }

    // Determine axis max for the reference line
    const maxVal = Math.max(
        ...data.map(d => Math.max(d.estimatedDays, d.actualDays)),
        1
    ) * 1.1;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                    type="number"
                    dataKey="estimatedDays"
                    name="Stimato (gg)"
                    domain={[0, maxVal]}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Stimato (giorni)', position: 'insideBottom', offset: -10, fontSize: 12 }}
                />
                <YAxis
                    type="number"
                    dataKey="actualDays"
                    name="Effettivo (gg)"
                    domain={[0, maxVal]}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Effettivo (giorni)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12 }}
                />
                <ZAxis range={[60, 200]} />
                <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(4px)',
                    }}
                    formatter={(value: number, name: string) => [
                        `${value.toFixed(1)} gg`,
                        name,
                    ]}
                    labelFormatter={(_label: any, payload: any[]) => {
                        const item = payload?.[0]?.payload as ScatterDatum | undefined;
                        return item ? `${item.title} (${item.technology})` : '';
                    }}
                />
                {/* Perfect estimation diagonal */}
                <ReferenceLine
                    segment={[{ x: 0, y: 0 }, { x: maxVal, y: maxVal }]}
                    stroke="#94a3b8"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: 'Stima perfetta', position: 'insideTopLeft', fontSize: 11, fill: '#94a3b8' }}
                />
                <Scatter
                    data={data}
                    fill="#6366f1"
                    fillOpacity={0.7}
                    stroke="#4f46e5"
                    strokeWidth={1}
                />
            </ScatterChart>
        </ResponsiveContainer>
    );
}
