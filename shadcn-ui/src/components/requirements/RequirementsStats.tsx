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
        <div className="flex items-center gap-5 mb-5">
            {/* Main KPI */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100 rounded-xl px-4 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">GG</span>
                </div>
                <div>
                    <p className="text-xl font-bold text-blue-700 leading-none">{totalEstimation.toFixed(1)}</p>
                    <p className="text-[10px] text-blue-500/80 font-medium">giorni totali</p>
                </div>
            </div>

            {/* Counts */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-700">{estimatedCount}</span>
                    <span className="text-slate-400 text-xs">stimati</span>
                </div>
                <span className="text-slate-200">·</span>
                <div className="flex items-center gap-1.5 text-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-bold text-slate-700">{notEstimatedCount}</span>
                    <span className="text-slate-400 text-xs">in attesa</span>
                </div>
            </div>

            {/* Progress pill */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <span className="text-xs font-bold text-slate-600">{progressPercent}%</span>
            </div>
        </div>
    );
}
