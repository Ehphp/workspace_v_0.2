export interface RequirementsStatsProps {
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
}

export function RequirementsStats({
    totalEstimation,
    estimatedCount,
    notEstimatedCount
}: RequirementsStatsProps) {
    return (
        <div className="flex items-center gap-6 px-6 py-3 w-fit rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 mb-6">
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">
                    {totalEstimation.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Giorni</span>
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            <div className="flex items-center gap-5 text-sm">
                <div className="flex items-center gap-2" title="Requisiti Stimati">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="font-medium text-slate-600">
                        <span className="font-bold text-slate-900">{estimatedCount}</span> Stimati
                    </span>
                </div>
                <div className="flex items-center gap-2" title="Requisiti da Stimare">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    <span className="font-medium text-slate-600">
                        <span className="font-bold text-slate-900">{notEstimatedCount}</span> In attesa
                    </span>
                </div>
            </div>
        </div>
    );
}
