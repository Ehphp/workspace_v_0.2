import { useState } from 'react';
import { Calculator, FileText, ChevronDown, ChevronUp, Sparkles, ShieldCheck, Brain, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Requirement, Technology, EstimationWithDetails, Activity } from '@/types/database';
import type { SeniorConsultantAnalysis } from '@/types/estimation';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';
import { RequirementProgress } from '../RequirementProgress';
import { ConsultantAnalysisCard } from '@/components/estimation/ConsultantAnalysisCard';
import { ConsultantHistoryPanel } from '@/components/estimation/ConsultantHistoryPanel';
import { RequirementUnderstandingCard } from '@/components/requirements/wizard/RequirementUnderstandingCard';
import type { ConsultantAnalysisRecord } from '@/hooks/useConsultantHistory';

interface OverviewTabProps {
    requirement: Requirement;
    presets: Technology[];
    refetchRequirement: () => Promise<void>;
    latestEstimation?: EstimationWithDetails | null;
    activities?: Activity[];
    onRequestConsultant?: () => void;
    isConsultantLoading?: boolean;
    consultantAnalysis?: SeniorConsultantAnalysis | null;
    consultantHistory?: ConsultantAnalysisRecord[];
    consultantHistoryLoading?: boolean;
    requirementUnderstanding?: RequirementUnderstanding | null;
    onNavigateToTab?: (tab: string) => void;
}

export function OverviewTab({ requirement, presets, refetchRequirement, latestEstimation, activities = [], onRequestConsultant, isConsultantLoading, consultantAnalysis, consultantHistory = [], consultantHistoryLoading = false, requirementUnderstanding, onNavigateToTab }: OverviewTabProps) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
    const [isUnderstandingExpanded, setIsUnderstandingExpanded] = useState(true);
    const [isAiAnalysisExpanded, setIsAiAnalysisExpanded] = useState(true);
    const [isConsultantExpanded, setIsConsultantExpanded] = useState(true);

    const hasAiAnalysis = latestEstimation?.ai_reasoning && latestEstimation.ai_reasoning.trim().length > 0;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="container mx-auto px-6 py-5 space-y-6">

                    {/* ═══ Hero: Description (left 70%) + Estimation (right 30%) ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">

                        {/* Left column — Description */}
                        <div className="lg:col-span-7 space-y-5">

                            {/* Description section */}
                            <section>
                                <button
                                    className="flex items-center gap-2 mb-2 group"
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                >
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrizione</h2>
                                    {isDescriptionExpanded
                                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    }
                                </button>
                                <div className={`${isDescriptionExpanded ? 'max-h-[40vh]' : 'max-h-16'} overflow-y-auto transition-all duration-300 pr-1`}>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {requirement.description || 'Nessuna descrizione fornita'}
                                    </p>
                                </div>
                            </section>

                            {/* AI Understanding — structured 2x2 grid layout */}
                            {requirementUnderstanding && (
                                <section className="border-t border-slate-100 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <button
                                            className="flex items-center gap-2 group"
                                            onClick={() => setIsUnderstandingExpanded(!isUnderstandingExpanded)}
                                        >
                                            <Brain className="w-4 h-4 text-blue-500" />
                                            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Analisi AI</h2>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50">
                                                Confermata
                                            </Badge>
                                            {isUnderstandingExpanded
                                                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                            }
                                        </button>
                                    </div>
                                    {isUnderstandingExpanded && (
                                        <RequirementUnderstandingCard understanding={requirementUnderstanding} />
                                    )}
                                </section>
                            )}

                            {/* AI Reasoning from estimation */}
                            {hasAiAnalysis && (
                                <section className="border-t border-slate-100 pt-4">
                                    <button
                                        className="flex items-center gap-2 mb-2"
                                        onClick={() => setIsAiAnalysisExpanded(!isAiAnalysisExpanded)}
                                    >
                                        <Sparkles className="w-4 h-4 text-blue-500" />
                                        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ragionamento AI</h2>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500">
                                            Generato
                                        </Badge>
                                        {isAiAnalysisExpanded
                                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                        }
                                    </button>
                                    {isAiAnalysisExpanded && (
                                        <div className="max-h-[25vh] overflow-y-auto pr-1">
                                            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                {latestEstimation!.ai_reasoning}
                                            </p>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Consultant Analysis */}
                            {consultantAnalysis && (
                                <section className="border-t border-slate-100 pt-4">
                                    <button
                                        className="flex items-center gap-2 mb-2"
                                        onClick={() => setIsConsultantExpanded(!isConsultantExpanded)}
                                    >
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senior Consultant</h2>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-600 bg-emerald-50">
                                            Analisi
                                        </Badge>
                                        {isConsultantExpanded
                                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                        }
                                    </button>
                                    {isConsultantExpanded && (
                                        <ConsultantAnalysisCard analysis={consultantAnalysis} />
                                    )}
                                </section>
                            )}

                            {/* Consultant History */}
                            {(consultantHistory.length > 0 || consultantHistoryLoading) && (
                                <section className="border-t border-slate-100 pt-4">
                                    <ConsultantHistoryPanel
                                        history={consultantHistory}
                                        loading={consultantHistoryLoading}
                                        currentAnalysis={consultantAnalysis}
                                    />
                                </section>
                            )}

                            {/* Progress */}
                            {latestEstimation && (
                                <section className="border-t border-slate-100 pt-4">
                                    <RequirementProgress
                                        estimation={latestEstimation}
                                        activities={activities}
                                        onUpdate={refetchRequirement}
                                    />
                                </section>
                            )}
                        </div>

                        {/* ═══ Right column — Estimation Summary Panel ═══ */}
                        <div className="lg:col-span-3">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-0">
                                <div className="px-4 py-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Calculator className="w-4 h-4 text-blue-600" />
                                        <h3 className="text-sm font-semibold text-slate-900">Stima corrente</h3>
                                    </div>
                                </div>

                                {latestEstimation ? (
                                    <div className="p-4 space-y-4">
                                        {/* Hero number */}
                                        <div className="text-center py-3 bg-slate-50 rounded-lg">
                                            <div className="text-4xl font-bold text-blue-700">
                                                {latestEstimation.total_days.toFixed(1)}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                                                giorni totali
                                            </div>
                                        </div>

                                        {/* Breakdown table */}
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between py-1.5 px-2">
                                                <span className="text-slate-500">Base</span>
                                                <span className="font-medium text-slate-800">{(latestEstimation.base_hours / 8).toFixed(1)} gg</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 px-2">
                                                <span className="text-slate-500">Moltiplicatore</span>
                                                <span className="font-medium text-slate-800">{latestEstimation.driver_multiplier.toFixed(2)}x</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 px-2 bg-slate-50 rounded">
                                                <span className="text-slate-600 font-medium">Subtotale</span>
                                                <span className="font-semibold text-slate-900">
                                                    {((latestEstimation.base_hours / 8) * latestEstimation.driver_multiplier).toFixed(1)} gg
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-1.5 px-2">
                                                <span className="text-slate-500">Contingenza</span>
                                                <span className="font-medium text-orange-600">{latestEstimation.contingency_percent}%</span>
                                            </div>
                                            {latestEstimation.risk_score > 0 && (
                                                <div className="flex justify-between py-1.5 px-2">
                                                    <span className="text-slate-500">Rischio</span>
                                                    <span className="font-medium text-slate-800">{latestEstimation.risk_score}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Last update */}
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2">
                                            <Clock className="w-3 h-3" />
                                            Aggiornata {new Date(latestEstimation.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <Button
                                                size="sm"
                                                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                                onClick={() => onNavigateToTab?.('estimation')}
                                            >
                                                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                                                Rivedi stima
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full h-8 text-xs"
                                                onClick={() => onNavigateToTab?.('history')}
                                            >
                                                Timeline
                                            </Button>

                                            {/* Consultant CTA */}
                                            {onRequestConsultant && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={onRequestConsultant}
                                                    disabled={isConsultantLoading}
                                                    className={`w-full h-8 text-xs ${consultantAnalysis
                                                        ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                                        : 'hover:border-emerald-200 hover:text-emerald-700 hover:bg-emerald-50'
                                                        } transition-colors`}
                                                >
                                                    {isConsultantLoading ? (
                                                        <>
                                                            <div className="h-3 w-3 mr-1.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                            Analisi...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                                            {consultantAnalysis ? 'Aggiorna Consultant' : 'Richiedi Consultant'}
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 text-center">
                                        <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 font-medium">Nessuna stima</p>
                                        <p className="text-xs text-slate-400 mt-1 mb-3">Avvia una stima per questo requisito</p>
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                            onClick={() => onNavigateToTab?.('estimation')}
                                        >
                                            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                                            Vai alla Stima
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
