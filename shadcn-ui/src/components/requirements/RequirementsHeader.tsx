import type React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Zap, Plus, Settings } from 'lucide-react';
import type { List } from '@/types/database';

interface RequirementsHeaderProps {
    list: List | null;
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
    errorMessage: string | null;
    filteredRequirementsCount: number;
    onBulkEstimate: () => void;
    onCreateRequirement: () => void;
    onRetry: () => void;
    onEditList: () => void;
}

export function RequirementsHeader({
    list,
    totalEstimation,
    estimatedCount,
    notEstimatedCount,
    errorMessage,
    filteredRequirementsCount,
    onBulkEstimate,
    onCreateRequirement,
    onRetry,
    onEditList,
}: RequirementsHeaderProps) {
    return (
        <div className="flex-shrink-0 relative border-b border-white/50 bg-white/40 backdrop-blur-md shadow-sm z-10">
            <div className="container mx-auto px-6 py-3">
                <div className="flex items-center justify-between gap-6">
                    {/* Left side: Project info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <FileText className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-3xl font-bold text-slate-900 truncate mb-1">
                                {list?.name}
                            </h1>
                            {list?.description && (
                                <p className="text-sm text-slate-600 truncate">{list.description}</p>
                            )}
                        </div>

                        {/* Summary Card removed and moved to body */}
                    </div>

                    {/* Right side: Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEditList}
                            disabled={!list}
                            className="text-slate-400 hover:text-slate-700"
                            title="Edit Project Settings"
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                        <div className="h-6 w-px bg-slate-200 mx-1" />
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
