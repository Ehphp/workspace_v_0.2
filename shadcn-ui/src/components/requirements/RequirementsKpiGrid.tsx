import { Calendar, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

interface RequirementsKpiGridProps {
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
    highPriorityCount: number;
    highPriorityUnestimated: number;
    avgRiskScore: number | null;
}

interface KpiCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    accent: string;
}

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
    return (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-white/80 ${accent}`}>
            <div className="shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide leading-none">{label}</p>
                <p className="text-lg font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[11px] text-slate-400 leading-none mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

export function RequirementsKpiGrid({
    totalEstimation,
    estimatedCount,
    notEstimatedCount,
    highPriorityCount,
    highPriorityUnestimated,
    avgRiskScore,
}: RequirementsKpiGridProps) {
    const total = estimatedCount + notEstimatedCount;
    const progressPercent = total > 0 ? Math.round((estimatedCount / total) * 100) : 0;

    const riskLabel = avgRiskScore != null
        ? avgRiskScore <= 0.3 ? 'Basso' : avgRiskScore <= 0.6 ? 'Medio' : 'Alto'
        : '—';

    const riskAccent = avgRiskScore != null
        ? avgRiskScore <= 0.3 ? 'border-emerald-200' : avgRiskScore <= 0.6 ? 'border-amber-200' : 'border-red-200'
        : 'border-slate-200';

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard
                icon={<Calendar className="h-5 w-5 text-blue-500" />}
                label="Effort Totale"
                value={`${totalEstimation.toFixed(1)} gg`}
                sub={total > 0 ? `${total} requisiti` : undefined}
                accent="border-blue-200"
            />
            <KpiCard
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                label="Copertura Stime"
                value={`${estimatedCount} / ${total}`}
                sub={`${progressPercent}% completato`}
                accent="border-emerald-200"
            />
            <KpiCard
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                label="Alta Priorità"
                value={`${highPriorityCount}`}
                sub={highPriorityUnestimated > 0 ? `${highPriorityUnestimated} senza stima` : 'tutte stimate'}
                accent={highPriorityUnestimated > 0 ? 'border-amber-200' : 'border-slate-200'}
            />
            <KpiCard
                icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
                label="Rischio Medio"
                value={riskLabel}
                sub={avgRiskScore != null ? `score ${(avgRiskScore * 100).toFixed(0)}%` : 'nessuna stima'}
                accent={riskAccent}
            />
        </div>
    );
}
