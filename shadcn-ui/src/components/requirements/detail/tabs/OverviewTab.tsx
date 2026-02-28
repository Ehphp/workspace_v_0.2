import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, FileText, User, Tag, Zap, Settings, ChevronDown, ChevronUp, Sparkles, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Requirement, TechnologyPreset, EstimationWithDetails, Activity } from '@/types/database';
import type { SeniorConsultantAnalysis } from '@/types/estimation';
import { RequirementProgress } from '../RequirementProgress';
import { ConsultantAnalysisCard } from '@/components/estimation/ConsultantAnalysisCard';

interface OverviewTabProps {
    requirement: Requirement;
    presets: TechnologyPreset[];
    refetchRequirement: () => Promise<void>;
    latestEstimation?: EstimationWithDetails | null;
    activities?: Activity[];
    onRequestConsultant?: () => void;
    isConsultantLoading?: boolean;
    consultantAnalysis?: SeniorConsultantAnalysis | null;
}

const priorityColors = {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    LOW: 'bg-green-100 text-green-700 border-green-200',
};

const stateColors = {
    CREATED: 'bg-slate-100 text-slate-700 border-slate-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    DONE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function OverviewTab({ requirement, presets, refetchRequirement, latestEstimation, activities = [], onRequestConsultant, isConsultantLoading, consultantAnalysis }: OverviewTabProps) {
    const preset = presets.find(p => p.id === requirement.tech_preset_id);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isAiAnalysisExpanded, setIsAiAnalysisExpanded] = useState(true);
    const [isConsultantExpanded, setIsConsultantExpanded] = useState(true);

    // Check if estimation has AI analysis
    const hasAiAnalysis = latestEstimation?.ai_reasoning && latestEstimation.ai_reasoning.trim().length > 0;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="container mx-auto px-6 py-4 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:h-full">
                        {/* Left: Compact Info Grid (3/5) */}
                        <div className="lg:col-span-3 space-y-4 overflow-y-auto lg:pr-2 lg:h-full flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                            {/* Description Card */}
                            <Card className={`rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl ${latestEstimation ? 'shrink-0' : 'flex-1 min-h-0 flex flex-col'}`}>
                                <CardContent className={`p-5 ${latestEstimation ? '' : 'flex-1 flex flex-col min-h-0'}`}>
                                    {/* Description Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl shadow-md">
                                                <FileText className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Descrizione</span>
                                        </div>
                                        {latestEstimation && (
                                            <button
                                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                                className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                                                title={isDescriptionExpanded ? "Comprimi" : "Espandi"}
                                            >
                                                {isDescriptionExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-slate-600" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Description Content */}
                                    <div className={`${latestEstimation ? (isDescriptionExpanded ? 'max-h-[30vh]' : 'max-h-[15vh]') : 'flex-1'} overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent transition-all duration-300`}>
                                        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                            {requirement.description || 'Nessuna descrizione fornita'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* AI Analysis Card - Only show if estimation has AI reasoning */}
                            {hasAiAnalysis && (
                                <Card className="rounded-2xl shadow-lg border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-xl shrink-0">
                                    <CardContent className="p-5">
                                        {/* AI Analysis Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                                                    <Sparkles className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Analisi AI</span>
                                                <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-100/50">
                                                    Generato
                                                </Badge>
                                            </div>
                                            <button
                                                onClick={() => setIsAiAnalysisExpanded(!isAiAnalysisExpanded)}
                                                className="p-2 hover:bg-blue-100 rounded-xl transition-all duration-200"
                                                title={isAiAnalysisExpanded ? "Comprimi" : "Espandi"}
                                            >
                                                {isAiAnalysisExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                                )}
                                            </button>
                                        </div>

                                        {/* AI Analysis Content */}
                                        <div className={`${isAiAnalysisExpanded ? 'max-h-[25vh]' : 'max-h-0'} overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent transition-all duration-300`}>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                {latestEstimation.ai_reasoning}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Consultant Analysis Card */}
                            {consultantAnalysis && (
                                <Card className="rounded-2xl shadow-lg border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 backdrop-blur-xl shrink-0">
                                    <CardContent className="p-5">
                                        {/* Consultant Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                                                    <ShieldCheck className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Senior Consultant</span>
                                                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-100/50">
                                                    Analisi
                                                </Badge>
                                            </div>
                                            <button
                                                onClick={() => setIsConsultantExpanded(!isConsultantExpanded)}
                                                className="p-2 hover:bg-emerald-100 rounded-xl transition-all duration-200"
                                                title={isConsultantExpanded ? "Comprimi" : "Espandi"}
                                            >
                                                {isConsultantExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-emerald-600" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-emerald-600" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Consultant Content */}
                                        <div className={`${isConsultantExpanded ? '' : 'max-h-0 overflow-hidden'} transition-all duration-300`}>
                                            <ConsultantAnalysisCard analysis={consultantAnalysis} />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Progress Section */}
                            {latestEstimation && (
                                <Card className="rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl shrink-0 transition-all duration-300">
                                    <CardContent className="p-5">
                                        <RequirementProgress
                                            estimation={latestEstimation}
                                            activities={activities}
                                            onUpdate={refetchRequirement}
                                        />
                                    </CardContent>
                                </Card>
                            )}


                        </div>

                        {/* Right: Estimation Summary (2/5) */}
                        <div className="lg:col-span-2 lg:h-full lg:overflow-hidden">
                            <Card className="rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl h-full min-h-min">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                                            <Calculator className="w-4 h-4 text-white" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">Ultima Stima</h3>
                                    </div>

                                    {latestEstimation ? (
                                        <div className="space-y-4">
                                            {/* Total Days - Compact */}
                                            <div className="text-center py-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl border border-blue-200/50">
                                                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                    {latestEstimation.total_days.toFixed(1)}
                                                </div>
                                                <div className="text-xs text-slate-600 font-semibold uppercase tracking-wider mt-1">
                                                    Giorni Totali
                                                </div>
                                            </div>

                                            {/* Compact Breakdown */}
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl">
                                                    <span className="text-slate-600">Base:</span>
                                                    <span className="font-bold text-slate-900">{(latestEstimation.base_hours / 8).toFixed(1)} gg</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl">
                                                    <span className="text-slate-600">Moltiplicatore:</span>
                                                    <span className="font-bold text-slate-900">{latestEstimation.driver_multiplier.toFixed(2)}x</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded-xl border-t border-slate-200">
                                                    <span className="text-slate-600">Subtotale:</span>
                                                    <span className="font-bold text-slate-900">
                                                        {((latestEstimation.base_hours / 8) * latestEstimation.driver_multiplier).toFixed(1)} gg
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200/50">
                                                    <span className="text-slate-600">Contingenza:</span>
                                                    <span className="font-bold text-orange-700">{latestEstimation.contingency_percent}%</span>
                                                </div>
                                            </div>

                                            {/* Senior Consultant Button */}
                                            {onRequestConsultant && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={onRequestConsultant}
                                                        disabled={isConsultantLoading}
                                                        className={`w-full h-9 text-xs ${consultantAnalysis
                                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                                                            } transition-colors`}
                                                    >
                                                        {isConsultantLoading ? (
                                                            <>
                                                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                                Analisi in corso...
                                                            </>
                                                        ) : consultantAnalysis ? (
                                                            <>
                                                                <ShieldCheck className="h-4 w-4 mr-2" />
                                                                Aggiorna Analisi Consultant
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShieldCheck className="h-4 w-4 mr-2" />
                                                                Richiedi Senior Consultant
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                <FileText className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Nessuna stima</p>
                                            <p className="text-xs text-slate-400 mt-1">Vai alla tab Stima</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
