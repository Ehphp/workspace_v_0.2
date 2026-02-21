import type React from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import {
    Clock,
    Target,
    Zap,
    ArrowUpRight,
    Layers
} from 'lucide-react';
import type { RequirementWithEstimation } from '@/types/database';
import { StateBadge } from '@/components/shared/RequirementBadges';

interface RequirementsDashboardViewProps {
    requirements: RequirementWithEstimation[];
    listId: string;
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
}

const STATUS_COLORS: Record<string, string> = {
    PROPOSED: '#3b82f6',
    SELECTED: '#f59e0b',
    SCHEDULED: '#8b5cf6',
    DONE: '#10b981',
};

const PRIORITY_COLORS: Record<string, string> = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#10b981',
};

export function RequirementsDashboardView({
    requirements,
    listId,
    totalEstimation,
    estimatedCount,
    notEstimatedCount
}: RequirementsDashboardViewProps) {
    const navigate = useNavigate();

    // Calculate stats
    const stats = useMemo(() => {
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byOwner: Record<string, number> = {};
        let totalHigh = 0;
        let estimatedHigh = 0;

        requirements.forEach(req => {
            byStatus[req.state] = (byStatus[req.state] || 0) + 1;
            byPriority[req.priority] = (byPriority[req.priority] || 0) + 1;
            if (req.business_owner) {
                byOwner[req.business_owner] = (byOwner[req.business_owner] || 0) + 1;
            }
            if (req.priority === 'HIGH') {
                totalHigh++;
                if (req.latest_estimation) estimatedHigh++;
            }
        });

        return { byStatus, byPriority, byOwner, totalHigh, estimatedHigh };
    }, [requirements]);

    // Chart data
    const statusChartData = useMemo(() =>
        Object.entries(stats.byStatus).map(([name, value]) => ({
            name,
            value,
            color: STATUS_COLORS[name] || '#64748b'
        })),
        [stats.byStatus]
    );

    const priorityChartData = useMemo(() =>
        Object.entries(stats.byPriority).map(([name, value]) => ({
            name: name === 'HIGH' ? 'Alta' : name === 'MEDIUM' ? 'Media' : 'Bassa',
            value,
            fill: PRIORITY_COLORS[name] || '#64748b'
        })),
        [stats.byPriority]
    );

    // Top estimated requirements
    const topEstimated = useMemo(() =>
        requirements
            .filter(r => r.latest_estimation)
            .sort((a, b) => (b.latest_estimation?.total_days || 0) - (a.latest_estimation?.total_days || 0))
            .slice(0, 5),
        [requirements]
    );

    // Recent requirements
    const recentRequirements = useMemo(() =>
        [...requirements]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 5),
        [requirements]
    );

    const progressPercent = requirements.length > 0
        ? Math.round((estimatedCount / requirements.length) * 100)
        : 0;

    const avgEstimation = estimatedCount > 0
        ? (totalEstimation / estimatedCount).toFixed(1)
        : '0';

    return (
        <div className="grid grid-cols-12 gap-4 h-full">
            {/* Column 1: KPI Summary (3 cols) */}
            <div className="col-span-3 flex flex-col gap-3">
                {/* KPI Card */}
                <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">1</span>
                        Riepilogo Stime
                    </h3>

                    {/* Main KPI */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-center">
                        <p className="text-3xl font-bold text-blue-600">{totalEstimation.toFixed(1)}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Giorni Totali</p>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">Completamento</span>
                            <span className="font-semibold text-slate-700">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-1.5" />
                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span>{estimatedCount} stimati</span>
                            <span>{notEstimatedCount} in attesa</span>
                        </div>
                    </div>

                    {/* Mini Stats */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/80 border border-slate-200 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-slate-800">{avgEstimation}</p>
                            <p className="text-[9px] text-slate-500">gg/req</p>
                        </div>
                        <div className="bg-white/80 border border-slate-200 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-red-500">{stats.totalHigh}</p>
                            <p className="text-[9px] text-slate-500">Alta Priorità</p>
                        </div>
                    </div>
                </div>

                {/* Status Overview */}
                <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 space-y-2">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">2</span>
                        Stati
                    </h3>
                    <div className="space-y-1">
                        {[
                            { state: 'PROPOSED', label: 'Proposti', colorClass: 'bg-blue-500' },
                            { state: 'SELECTED', label: 'Selezionati', colorClass: 'bg-amber-500' },
                            { state: 'SCHEDULED', label: 'Pianificati', colorClass: 'bg-purple-500' },
                            { state: 'DONE', label: 'Completati', colorClass: 'bg-emerald-500' },
                        ].map(({ state, label, colorClass }) => {
                            const count = stats.byStatus[state] || 0;
                            const percent = requirements.length > 0 ? Math.round((count / requirements.length) * 100) : 0;
                            return (
                                <div key={state} className="flex items-center justify-between bg-white/80 border border-slate-200 rounded-lg p-2 hover:border-slate-300 transition-all">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                                        <span className="text-[10px] font-medium text-slate-600">{label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-800">{count}</span>
                                        <span className="text-[9px] text-slate-400">({percent}%)</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Column 2: Charts (5 cols) */}
            <div className="col-span-5 flex flex-col gap-3 border-l border-r border-slate-100 px-4">
                {/* Status Distribution Chart */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between shrink-0 mb-2">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">3</span>
                            Distribuzione Stato
                        </h3>
                    </div>
                    <div className="flex-1 rounded-lg border-2 border-dashed border-orange-200 bg-orange-50/30 p-2 min-h-[180px]">
                        {statusChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="50%"
                                        outerRadius="75%"
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '11px',
                                        }}
                                        formatter={(value: number) => [`${value}`, 'Requisiti']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Layers className="w-6 h-6 opacity-20 mb-1" />
                                <p className="text-xs">Nessun dato</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Priority Distribution Chart */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between shrink-0 mb-2">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">4</span>
                            Distribuzione Priorità
                        </h3>
                    </div>
                    <div className="flex-1 rounded-lg border-2 border-dashed border-red-200 bg-red-50/30 p-2 min-h-[150px]">
                        {priorityChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityChartData} layout="vertical">
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '11px',
                                        }}
                                        formatter={(value: number) => [`${value}`, 'Requisiti']}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Target className="w-6 h-6 opacity-20 mb-1" />
                                <p className="text-xs">Nessun dato</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Column 3: Lists (4 cols) */}
            <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
                {/* Top by Effort */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between shrink-0 mb-2">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">5</span>
                            Top per Effort
                        </h3>
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] font-medium px-1.5 py-0">
                            {topEstimated.length}
                        </Badge>
                    </div>
                    <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                        <div className="space-y-1">
                            {topEstimated.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-4">
                                    <Zap className="w-6 h-6 opacity-20 mb-1" />
                                    <p className="text-xs">Nessuna stima</p>
                                </div>
                            ) : (
                                topEstimated.map((req, idx) => (
                                    <div
                                        key={req.id}
                                        onClick={() => navigate(`/dashboard/${listId}/requirements/${req.id}`)}
                                        className="group flex items-center justify-between bg-white/80 p-2 rounded-lg border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-[9px] font-semibold group-hover:bg-emerald-100 group-hover:text-emerald-600 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-medium text-slate-800 leading-tight truncate group-hover:text-emerald-700">
                                                    {req.title}
                                                </div>
                                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                    <span className="font-mono">{req.req_id}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                {req.latest_estimation?.total_days.toFixed(1)}gg
                                            </span>
                                            <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Recent Updates */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between shrink-0 mb-2">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">6</span>
                            Aggiornamenti Recenti
                        </h3>
                        <Badge className="bg-cyan-100 text-cyan-700 border-0 text-[10px] font-medium px-1.5 py-0">
                            {recentRequirements.length}
                        </Badge>
                    </div>
                    <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                        <div className="space-y-1">
                            {recentRequirements.map((req) => (
                                <div
                                    key={req.id}
                                    onClick={() => navigate(`/dashboard/${listId}/requirements/${req.id}`)}
                                    className="group flex items-center justify-between bg-white/80 p-2 rounded-lg border border-slate-200 hover:border-cyan-200 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-medium text-slate-800 leading-tight truncate group-hover:text-cyan-700">
                                                {req.title}
                                            </div>
                                            <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                <span className="font-mono">{req.req_id}</span>
                                                <span>•</span>
                                                <StateBadge state={req.state} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-slate-500">
                                            {new Date(req.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Business Owners (if any) */}
                {Object.keys(stats.byOwner).length > 0 && (
                    <div className="shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">7</span>
                                Business Owners
                            </h3>
                        </div>
                        <div className="rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(stats.byOwner)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 6)
                                    .map(([owner, count]) => (
                                        <div
                                            key={owner}
                                            className="flex items-center gap-1.5 bg-white/80 border border-slate-200 rounded px-2 py-1"
                                        >
                                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold">
                                                {owner.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-700 truncate max-w-[80px]">{owner}</span>
                                            <span className="text-[9px] text-slate-400">{count}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
