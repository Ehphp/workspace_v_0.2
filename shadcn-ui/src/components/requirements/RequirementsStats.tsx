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
    const total = estimatedCount + notEstimatedCount;
    const progressPercent = total > 0 ? Math.round((estimatedCount / total) * 100) : 0;

    return (
        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 w-fit mb-4">
            <div className="flex items-center gap-4">
                {/* Main KPI */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-blue-600">{totalEstimation.toFixed(1)}</p>
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Giorni</p>
                </div>

                <div className="h-10 w-px bg-slate-200"></div>

                {/* Status counts */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-bold text-slate-800">{estimatedCount}</span>
                        <span className="text-[10px] text-slate-500">Stimati</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-bold text-slate-800">{notEstimatedCount}</span>
                        <span className="text-[10px] text-slate-500">In attesa</span>
                    </div>
                </div>

                <div className="h-10 w-px bg-slate-200"></div>

                {/* Progress indicator */}
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-800">{progressPercent}%</p>
                    <p className="text-[9px] text-slate-500">Completato</p>
                </div>
            </div>
        </div>
    );
}
