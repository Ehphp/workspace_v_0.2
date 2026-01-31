import type React from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Zap, Plus, Settings, ChevronDown, MessageSquareCode } from 'lucide-react';
import type { List } from '@/types/database';

interface RequirementsHeaderProps {
    list: List | null;
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;
    errorMessage: string | null;
    filteredRequirementsCount: number;
    onBulkEstimate: () => void;
    onBulkInterview: () => void;
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
    onBulkInterview,
    onCreateRequirement,
    onRetry,
    onEditList,
}: RequirementsHeaderProps) {
    return (
        <div className="flex-shrink-0 relative border-b border-white/50 bg-white/60 backdrop-blur-xl z-10">
            <div className="container mx-auto px-6 py-5">
                <div className="flex items-center justify-between gap-6">
                    {/* Left side: Project info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                            <FileText className="w-6 h-6 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold text-slate-900 truncate">
                                {list?.name}
                            </h1>
                            {list?.description && (
                                <p className="text-sm text-slate-500 truncate mt-0.5">{list.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Right side: Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEditList}
                            disabled={!list}
                            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                            title="Impostazioni Progetto"
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                        <div className="h-8 w-px bg-slate-200" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    disabled={filteredRequirementsCount === 0}
                                    variant="outline"
                                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl h-10 px-4"
                                >
                                    <Zap className="mr-2 h-4 w-4" />
                                    Stima Tutti
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={onBulkEstimate} className="cursor-pointer">
                                    <Zap className="mr-2 h-4 w-4 text-indigo-600" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">Stima Rapida</span>
                                        <span className="text-xs text-muted-foreground">Stima diretta senza domande</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onBulkInterview} className="cursor-pointer">
                                    <MessageSquareCode className="mr-2 h-4 w-4 text-purple-600" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">Stima con Interview</span>
                                        <span className="text-xs text-muted-foreground">Domande aggregate per stime precise</span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            onClick={onCreateRequirement}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 rounded-xl h-10 px-5"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nuovo Requisito
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
                        <Button variant="outline" size="sm" onClick={onRetry} className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg">
                            Riprova
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
