import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusData {
    name: string;
    value: number;
    color: string;
}

interface StatusDistributionChartProps {
    statusData: StatusData[];
}

const COLORS = {
    PROPOSED: '#3b82f6',  // blue
    APPROVED: '#10b981',  // emerald
    ESTIMATED: '#8b5cf6', // purple
    ARCHIVED: '#64748b',  // slate
};

export function StatusDistributionChart({ statusData }: StatusDistributionChartProps) {
    if (!statusData || statusData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-500">No data available</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                >
                    {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    }}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-700">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
