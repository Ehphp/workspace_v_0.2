import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Loader2, CheckCircle2, Clock, ShieldAlert, Brain, Sparkles, XCircle } from 'lucide-react';
import type { RequirementWithEstimation } from '@/types/database';
import type { BulkItemState } from '@/hooks/useBulkEstimation';
import { PRIORITY_CONFIGS } from '@/components/shared/RequirementBadges';
import { STATE_LABELS, PRIORITY_LABELS } from '@/types/export';

interface RequirementRowProps {
    req: RequirementWithEstimation;
    listId: string;
    onDelete: (req: RequirementWithEstimation) => void;
    bulkStatus?: BulkItemState;
}

const stateColors: Record<string, { bg: string; text: string; dot: string }> = {
    PROPOSED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    SELECTED: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    SCHEDULED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    DONE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const priorityAccents: Record<string, string> = {
    HIGH: 'bg-red-500',
    MEDIUM: 'bg-amber-400',
    LOW: 'bg-emerald-400',
};

export function RequirementRow({ req, listId, onDelete, bulkStatus }: RequirementRowProps) {
    const navigate = useNavigate();
    const estimation = req.latest_estimation;
    const hasEstimation = !!estimation;
    const priorityConfig = PRIORITY_CONFIGS[req.priority as keyof typeof PRIORITY_CONFIGS] || PRIORITY_CONFIGS.MEDIUM;
    const isGeneratingTitle = req.labels?.includes('AI_TITLE_PENDING');
    const stateStyle = stateColors[req.state] || stateColors.PROPOSED;
    const priorityAccent = priorityAccents[req.priority] || 'bg-slate-300';

    // Flash green briefly when estimation completes successfully
    const [showFlash, setShowFlash] = useState(false);
    useEffect(() => {
        if (bulkStatus?.status === 'success') {
            setShowFlash(true);
            const timer = setTimeout(() => setShowFlash(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [bulkStatus?.status]);

    const isProcessing = bulkStatus?.status === 'processing';
    const isPending = bulkStatus?.status === 'pending';
    const isBulkError = bulkStatus?.status === 'error';

    // AI signals derived from estimation data
    const isHighRisk = estimation && estimation.risk_score > 0.6;
    const hasBlueprintId = estimation && estimation.blueprint_id;

    return (
        <div
            className={`group flex items-center gap-0 transition-all duration-500 cursor-pointer
                ${showFlash ? 'bg-emerald-50/80 ring-1 ring-emerald-200' : 'hover:bg-slate-50/80'}
                ${isProcessing ? 'bg-indigo-50/40' : ''}
                ${isPending ? 'opacity-60' : ''}
            `}
            onClick={() => navigate(`/dashboard/${listId}/requirements/${req.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/dashboard/${listId}/requirements/${req.id}`);
                }
            }}
        >
            {/* Priority accent bar */}
            <div className={`w-1 self-stretch ${priorityAccent} shrink-0`} />

            <div className="flex-1 flex items-center gap-4 px-4 py-3 min-w-0">
                {/* Left: ID + State */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] font-semibold text-slate-400 w-[72px]">
                        {req.req_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${stateStyle.bg} ${stateStyle.text} whitespace-nowrap`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stateStyle.dot}`} />
                        {STATE_LABELS[req.state] || req.state}
                    </span>
                </div>

                {/* Center: Title + metadata */}
                <div className="flex-1 min-w-0">
                    {isGeneratingTitle ? (
                        <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                            <span className="text-xs">Generazione titolo...</span>
                        </div>
                    ) : (
                        <h3 className="text-sm font-medium text-slate-800 leading-snug group-hover:text-blue-700 transition-colors truncate">
                            {req.title}
                        </h3>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                            <span className="text-xs">{priorityConfig.icon}</span>
                            <span>{PRIORITY_LABELS[req.priority] || req.priority}</span>
                        </span>
                        {req.business_owner && (
                            <>
                                <span className="text-slate-200">&middot;</span>
                                <span className="truncate max-w-[120px]">{req.business_owner}</span>
                            </>
                        )}
                        <span className="text-slate-200">&middot;</span>
                        <span>{new Date(req.updated_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                {/* AI signal badges */}
                <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                    {isHighRisk && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded"
                            title={`Rischio: ${(estimation.risk_score * 100).toFixed(0)}%`}
                        >
                            <ShieldAlert className="h-3 w-3" />
                            Rischio
                        </span>
                    )}
                    {hasBlueprintId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded"
                            title="Stima basata su blueprint AI"
                        >
                            <Brain className="h-3 w-3" />
                            Blueprint
                        </span>
                    )}
                </div>

                {/* Right: Estimation + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {isProcessing ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                            <span className="inline-block h-3 w-12 rounded bg-gradient-to-r from-indigo-100 via-indigo-200 to-indigo-100 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
                        </span>
                    ) : isBulkError ? (
                        <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg"
                            title={bulkStatus?.error}
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Errore
                        </span>
                    ) : showFlash && bulkStatus?.totalDays != null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg animate-[pop_0.3s_ease-out]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {bulkStatus.totalDays.toFixed(1)} gg
                        </span>
                    ) : hasEstimation ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50/80 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {estimation.total_days.toFixed(1)} gg
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                            <Clock className="h-3 w-3" />
                            In attesa
                        </span>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-lg">
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(req);
                                }}
                            >
                                Elimina
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
