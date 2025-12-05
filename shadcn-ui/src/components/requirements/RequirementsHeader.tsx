import type React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Cpu, Zap, Plus } from 'lucide-react';
import type { List } from '@/types/database';

interface RequirementsHeaderProps {
    list: List | null;
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
    errorMessage: string | null;
    filteredRequirementsCount: number;
    onSetTechnology: () => void;
    onBulkEstimate: () => void;
    onCreateRequirement: () => void;
    onRetry: () => void;
    statusControl?: React.ReactNode;
}

export function RequirementsHeader({
    list,
    totalEstimation,
    estimatedCount,
    notEstimatedCount,
    errorMessage,
    filteredRequirementsCount,
    onSetTechnology,
    onBulkEstimate,
    onCreateRequirement,
    onRetry,
    statusControl,
}: RequirementsHeaderProps) {
    return (
        <div className="flex-shrink-0 relative border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-sm z-10">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between gap-6">
                    {/* Left side: Project info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <FileText className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 truncate mb-1">
                                {list?.name}
                            </h1>
                            {list?.description && (
                                <p className="text-sm text-slate-600 truncate">{list.description}</p>
                            )}
                        </div>

                        {/* Summary Card - Modern Glass Pill */}
                        <div className="flex items-center gap-5 px-6 py-2 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-sm hover:bg-white/60 transition-colors">
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
                    </div>

                    {/* Right side: Actions */}
                    <div className="flex items-center gap-3">
                        {statusControl}
                        <Button
                            variant="outline"
                            onClick={onSetTechnology}
                            disabled={!list}
                            className="border-slate-300 text-slate-800 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/60 shadow-sm"
                        >
                            <Cpu className="mr-2 h-4 w-4" />
                            Set Technology
                        </Button>
                        <Button
                            onClick={onBulkEstimate}
                            disabled={filteredRequirementsCount === 0}
                            variant="outline"
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Estimate All
                        </Button>
                        <Button
                            onClick={onCreateRequirement}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Requirement
                        </Button>
                    </div>
                </div>
            </div>

            {/* Error Message Bar */}
            {errorMessage && (
                <div className="container mx-auto px-6 pb-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                            </svg>
                            <span>{errorMessage}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={onRetry} className="border-amber-300 text-amber-800 hover:bg-amber-100">
                            Retry
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
