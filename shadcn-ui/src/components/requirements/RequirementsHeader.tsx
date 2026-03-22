import type React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Zap, Plus, Settings, Loader2 } from 'lucide-react';
import type { List } from '@/types/database';

interface RequirementsHeaderProps {
    list: List | null;
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
    errorMessage: string | null;
    filteredRequirementsCount: number;
    onBulkEstimate: () => void;
    isBulkRunning?: boolean;
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
    isBulkRunning,
    onCreateRequirement,
    onRetry,
    onEditList,
}: RequirementsHeaderProps) {
    const total = estimatedCount + notEstimatedCount;

    return (
        <div className="flex-shrink-0 relative border-b border-white/50 bg-white/60 backdrop-blur-xl z-10">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between gap-6">
                    {/* Left side: Project info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                            <FileText className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-900 truncate">
                                    {list?.name}
                                </h1>
                                <button
                                    onClick={onEditList}
                                    disabled={!list}
                                    className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
                                    title="Impostazioni Progetto"
                                >
                                    <Settings className="h-4 w-4" />
                                </button>
                            </div>
                            {/* Inline project summary */}
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                {list?.description ? (
                                    <>{list.description}</>
                                ) : total > 0 ? (
                                    <>{total} requisiti · {totalEstimation.toFixed(1)} gg stimati · {estimatedCount} stimati, {notEstimatedCount} in attesa</>
                                ) : null}
                            </p>
                        </div>
                    </div>

                    {/* Right side: Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            disabled={filteredRequirementsCount === 0 || isBulkRunning}
                            onClick={onBulkEstimate}
                            variant="outline"
                            size="sm"
                            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-xl h-9 px-3 text-sm"
                        >
                            {isBulkRunning ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {isBulkRunning ? 'Stimando...' : 'Stima Tutti'}
                        </Button>
                        <Button
                            onClick={onCreateRequirement}
                            size="sm"
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 rounded-xl h-9 px-4 text-sm"
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Nuovo Requisito
                        </Button>
                    </div>
                </div>
            </div>

            {/* Error Message Bar */}
            {errorMessage && (
                <div className="container mx-auto px-6 pb-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                            </svg>
                            <span>{errorMessage}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={onRetry} className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg h-7 text-xs">
                            Riprova
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
