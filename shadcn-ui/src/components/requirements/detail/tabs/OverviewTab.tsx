import { useState } from 'react';
import { Calculator, FileText, ChevronDown, ChevronUp, Brain, ArrowRight, Clock, ShieldCheck, Target, Lightbulb, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Requirement, Technology, EstimationWithDetails, Activity } from '@/types/database';
import type { SeniorConsultantAnalysis } from '@/types/estimation';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';
import { RequirementProgress } from '../RequirementProgress';

interface OverviewTabProps {
    requirement: Requirement;
    presets: Technology[];
    refetchRequirement: () => Promise<void>;
    latestEstimation?: EstimationWithDetails | null;
    activities?: Activity[];
    onRequestConsultant?: () => void;
    isConsultantLoading?: boolean;
    consultantAnalysis?: SeniorConsultantAnalysis | null;
    requirementUnderstanding?: RequirementUnderstanding | null;
    onNavigateToTab?: (tab: string) => void;
}

export function OverviewTab({ requirement, presets, refetchRequirement, latestEstimation, activities = [], onRequestConsultant, isConsultantLoading, consultantAnalysis, requirementUnderstanding, onNavigateToTab }: OverviewTabProps) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isUnderstandingExpanded, setIsUnderstandingExpanded] = useState(true);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
                <div className="container mx-auto px-6 py-4 h-full">

                    {/* ═══ 3-column layout: Desc+AI | Stima | Progresso ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 h-full">

                        {/* ─── Left column (4/10) — Description + AI ─── */}
                        <div className="lg:col-span-4 overflow-y-auto min-h-0 space-y-4 pr-1 custom-scrollbar">

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
                                <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed transition-all duration-300 ${isDescriptionExpanded ? '' : 'line-clamp-4'}`}>
                                    {requirement.description || 'Nessuna descrizione fornita'}
                                </p>
                            </section>

                            {/* AI Understanding — compact vertical list */}
                            {requirementUnderstanding && (
                                <section className="border-t border-slate-100 pt-3">
                                    <button
                                        className="flex items-center gap-2 mb-2 group"
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
                                    {isUnderstandingExpanded && (
                                        <div className="space-y-2.5">
                                            {/* Obiettivo di business */}
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Target className="w-3 h-3 text-blue-500 shrink-0" />
                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Obiettivo</span>
                                                </div>
                                                <p className="text-xs text-slate-700 leading-relaxed pl-[18px]">
                                                    {requirementUnderstanding.businessObjective || '—'}
                                                </p>
                                            </div>

                                            {/* Output atteso */}
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Output atteso</span>
                                                </div>
                                                <p className="text-xs text-slate-700 leading-relaxed pl-[18px]">
                                                    {requirementUnderstanding.expectedOutput || '—'}
                                                </p>
                                            </div>

                                            {/* Perimetro funzionale */}
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <FileText className="w-3 h-3 text-violet-500 shrink-0" />
                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Perimetro</span>
                                                </div>
                                                <div className="pl-[18px]">
                                                    {requirementUnderstanding.functionalPerimeter?.length > 0 ? (
                                                        <ul className="space-y-0.5">
                                                            {requirementUnderstanding.functionalPerimeter.map((item, i) => (
                                                                <li key={i} className="text-xs text-slate-700 leading-relaxed flex items-start gap-1">
                                                                    <span className="text-slate-400 mt-0.5">›</span>
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-xs text-slate-400">—</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Assunzioni */}
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assunzioni</span>
                                                </div>
                                                <div className="pl-[18px]">
                                                    {requirementUnderstanding.assumptions?.length > 0 ? (
                                                        <ul className="space-y-0.5">
                                                            {requirementUnderstanding.assumptions.map((item, i) => (
                                                                <li key={i} className="text-xs text-slate-700 leading-relaxed flex items-start gap-1">
                                                                    <span className="text-slate-400 mt-0.5">›</span>
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-xs text-slate-400">—</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>

                        {/* ─── Center column (3/10) — Progress ─── */}
                        <div className="lg:col-span-3 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                            {latestEstimation ? (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-full">
                                    <RequirementProgress
                                        estimation={latestEstimation}
                                        activities={activities}
                                        onUpdate={refetchRequirement}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-center min-h-full flex items-center justify-center">
                                    <p className="text-xs text-slate-400">Nessun progresso da mostrare</p>
                                </div>
                            )}
                        </div>

                        {/* ─── Right column (3/10) — Estimation card ─── */}
                        <div className="lg:col-span-3 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col min-h-full">
                                <h3 className="heading-5 flex items-center gap-2 shrink-0">
                                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-bold">{latestEstimation?.estimation_activities?.length ?? 0}</span>
                                    Riepilogo
                                </h3>

                                {latestEstimation ? (
                                    <>
                                        {/* Calculation Breakdown */}
                                        <div className="mt-3 space-y-1.5 bg-slate-50 rounded-lg border border-slate-200 p-2 shrink-0">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Giorni Base</span>
                                                <span className="font-mono font-medium text-slate-700">{(latestEstimation.base_hours / 8).toFixed(1)}g</span>
                                            </div>

                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Molt. Driver</span>
                                                <span className="font-mono font-medium text-orange-600">{latestEstimation.driver_multiplier.toFixed(2)}x</span>
                                            </div>

                                            <Separator className="my-1" />

                                            <div className="flex justify-between text-[10px] font-medium">
                                                <span className="text-slate-700">Subtotale</span>
                                                <span className="font-mono">{((latestEstimation.base_hours / 8) * latestEstimation.driver_multiplier).toFixed(1)}g</span>
                                            </div>

                                            <Separator className="my-1" />

                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Rischio</span>
                                                <span className="font-mono font-medium text-red-600">{latestEstimation.risk_score}</span>
                                            </div>

                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Contingenza</span>
                                                <span className="font-mono text-slate-600">
                                                    {(latestEstimation.contingency_percent * 100).toFixed(0)}% (+{(latestEstimation.total_days - ((latestEstimation.base_hours / 8) * latestEstimation.driver_multiplier)).toFixed(1)}g)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* Total */}
                                        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 shrink-0">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-semibold text-green-800">STIMA TOTALE</span>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-green-700">
                                                        {latestEstimation.total_days.toFixed(1)}
                                                    </div>
                                                    <div className="text-[9px] text-green-600">giorni</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Last update */}
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2 mt-2 shrink-0">
                                            <Clock className="w-3 h-3" />
                                            Aggiornata {new Date(latestEstimation.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="space-y-2 pt-2 border-t border-slate-100 mt-2 shrink-0">
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
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                                        <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
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
