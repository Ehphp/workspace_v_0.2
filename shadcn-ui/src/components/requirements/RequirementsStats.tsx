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
        <div className="flex items-center gap-5 px-6 py-2 w-fit rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-sm hover:bg-white/60 transition-colors mb-4">
            <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-800 tracking-tight">
                    {totalEstimation.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</span>
            </div>

            <div className="h-6 w-px bg-slate-300/50"></div>

            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5" title="Estimated Requirements">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                    <span className="font-medium text-slate-700">
                        <span className="font-bold text-slate-900">{estimatedCount}</span> Done
                    </span>
                </div>
                <div className="flex items-center gap-1.5" title="Pending Requirements">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                    <span className="font-medium text-slate-700">
                        <span className="font-bold text-slate-900">{notEstimatedCount}</span> Pending
                    </span>
                </div>
            </div>
        </div>
    );
}
