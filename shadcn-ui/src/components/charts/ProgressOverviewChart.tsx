import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectStat {
    id: string;
    name: string;
    status: string;
    totalRequirements: number;
    estimatedRequirements: number;
    totalDays: number;
    progress: number;
}

interface ProgressOverviewChartProps {
    projectStats: ProjectStat[];
    showArchived: boolean;
}

export function ProgressOverviewChart({ projectStats, showArchived }: ProgressOverviewChartProps) {
    const navigate = useNavigate();

    if (projectStats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No Data Available</h3>
                    <p className="text-sm text-slate-400/80">
                        {showArchived ? 'No archived projects to analyze' : 'Create projects to see estimation progress'}
                    </p>
                </div>
            </div>
        );
    }

    // Calculate max days for domain
    const maxDays = Math.max(...projectStats.map(p => p.totalDays), 10);

    return (
        <div className="h-full flex flex-col">
            {/* Minimal Legend */}
            <div className="flex items-center justify-center gap-4 pb-3 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <span className="text-slate-600">75-100%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                    <span className="text-slate-600">50-74%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                    <span className="text-slate-600">25-49%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                    <span className="text-slate-600">0-24%</span>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={projectStats}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                            type="number"
                            domain={[0, maxDays * 1.1]}
                            tickFormatter={(value) => `${Math.round(value)}d`}
                            stroke="#64748b"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={150}
                            stroke="#64748b"
                            style={{ fontSize: '13px', fontWeight: 500 }}
                            tick={{ fill: '#334155' }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload as ProjectStat;
                                    return (
                                        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-4 min-w-[280px]">
                                            <h4 className="font-bold text-slate-900 mb-3 text-sm">{data.name}</h4>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                                    <span className="text-slate-600">Total Days</span>
                                                    <span className="font-semibold text-blue-600">{data.totalDays.toFixed(1)}d</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Progress</span>
                                                    <span className="font-medium text-slate-900">{data.progress}%</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Requirements</span>
                                                    <span className="font-medium text-slate-900">
                                                        {data.estimatedRequirements} / {data.totalRequirements}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                                    <span className="text-slate-600">Status</span>
                                                    <Badge
                                                        className={`text-xs ${data.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                                            data.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-700'
                                                            }`}
                                                    >
                                                        {data.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar
                            dataKey="totalDays"
                            radius={[0, 8, 8, 0]}
                            cursor="pointer"
                            onClick={(data: ProjectStat) => navigate(`/lists/${data.id}/requirements`)}
                        >
                            {projectStats.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={
                                        entry.status === 'ARCHIVED' ? '#94a3b8' :
                                            entry.progress >= 75 ? '#10b981' :
                                                entry.progress >= 50 ? '#3b82f6' :
                                                    entry.progress >= 25 ? '#f59e0b' : '#ef4444'
                                    }
                                    opacity={0.9}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
