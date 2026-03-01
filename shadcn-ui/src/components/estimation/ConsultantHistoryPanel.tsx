import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConsultantAnalysisCard } from '@/components/estimation/ConsultantAnalysisCard';
import {
    ShieldCheck,
    History,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    Activity,
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
} from 'lucide-react';
import type { ConsultantAnalysisRecord } from '@/hooks/useConsultantHistory';
import type { SeniorConsultantAnalysis } from '@/types/estimation';

interface ConsultantHistoryPanelProps {
    history: ConsultantAnalysisRecord[];
    loading: boolean;
    currentAnalysis?: SeniorConsultantAnalysis | null;
}

function AssessmentIcon({ assessment }: { assessment: string }) {
    switch (assessment) {
        case 'approved':
            return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
        case 'needs_review':
            return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
        case 'concerns':
            return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
        default:
            return <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />;
    }
}

function assessmentLabel(assessment: string): string {
    switch (assessment) {
        case 'approved': return 'Approvato';
        case 'needs_review': return 'Da Rivedere';
        case 'concerns': return 'Criticità';
        default: return assessment;
    }
}

function assessmentBadgeClass(assessment: string): string {
    switch (assessment) {
        case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
        case 'needs_review': return 'bg-amber-100 text-amber-700 border-amber-300';
        case 'concerns': return 'bg-red-100 text-red-700 border-red-300';
        default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
}

export function ConsultantHistoryPanel({
    history,
    loading,
    currentAnalysis,
}: ConsultantHistoryPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showSnapshot, setShowSnapshot] = useState<string | null>(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span className="ml-2 text-sm text-slate-500">Caricamento storico...</span>
            </div>
        );
    }

    if (history.length === 0 && !currentAnalysis) {
        return (
            <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Nessuna analisi effettuata</p>
                <p className="text-xs text-slate-400 mt-1">Richiedi un&apos;analisi Senior Consultant</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-sm">
                    <History className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Storico Analisi ({history.length})
                </span>
            </div>

            {/* Timeline */}
            <div className="relative space-y-2">
                {/* Timeline line */}
                {history.length > 1 && (
                    <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gradient-to-b from-emerald-300 via-slate-200 to-transparent" />
                )}

                {history.map((record, index) => {
                    const isExpanded = expandedId === record.id;
                    const isSnapshotVisible = showSnapshot === record.id;
                    const isLatest = index === 0;
                    const snap = record.estimation_snapshot;
                    const reqSnap = record.requirement_snapshot;

                    return (
                        <div key={record.id} className="relative">
                            {/* Timeline dot */}
                            <div className={`absolute left-[11px] top-3 w-2.5 h-2.5 rounded-full border-2 z-10 ${isLatest
                                    ? 'bg-emerald-500 border-emerald-300 shadow-md shadow-emerald-200'
                                    : 'bg-white border-slate-300'
                                }`} />

                            <div className={`ml-8 ${isLatest ? '' : 'opacity-90'}`}>
                                <Card className={`rounded-xl border transition-all duration-200 ${isLatest
                                        ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 shadow-sm'
                                        : 'border-slate-200/60 bg-white/80 hover:border-slate-300'
                                    }`}>
                                    <CardContent className="p-3">
                                        {/* Analysis Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {/* Date + Assessment */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(record.created_at).toLocaleDateString('it-IT', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                    <Badge variant="outline" className={`text-[10px] ${assessmentBadgeClass(record.analysis.overallAssessment)}`}>
                                                        <AssessmentIcon assessment={record.analysis.overallAssessment} />
                                                        <span className="ml-1">{assessmentLabel(record.analysis.overallAssessment)}</span>
                                                    </Badge>
                                                    {isLatest && (
                                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                            Ultima
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Estimation context summary */}
                                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" />
                                                        {snap.total_days.toFixed(1)} gg
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="w-3 h-3" />
                                                        {snap.activities?.length || 0} attività
                                                    </span>
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded">
                                                        Confidenza: {record.analysis.estimatedConfidence}%
                                                    </span>
                                                </div>

                                                {/* Requirement state at time of analysis */}
                                                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                                                    <span className="text-slate-400">Stato req.:</span>
                                                    <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                                                        {reqSnap.state}
                                                    </Badge>
                                                    {reqSnap.technology_name && (
                                                        <Badge variant="outline" className="text-[10px] bg-purple-50 border-purple-200 text-purple-600">
                                                            {reqSnap.technology_name}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expand button */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 shrink-0"
                                                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                                            >
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-slate-500" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                                )}
                                            </Button>
                                        </div>

                                        {/* Discrepancy + Risk summary (always visible) */}
                                        {(record.analysis.discrepancies.length > 0 || record.analysis.riskAnalysis.length > 0) && (
                                            <div className="flex items-center gap-2 mt-2 text-[11px]">
                                                {record.analysis.discrepancies.length > 0 && (
                                                    <span className="flex items-center gap-1 text-amber-600">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {record.analysis.discrepancies.length} discrepanze
                                                    </span>
                                                )}
                                                {record.analysis.riskAnalysis.length > 0 && (
                                                    <span className="flex items-center gap-1 text-red-500">
                                                        <AlertCircle className="w-3 h-3" />
                                                        {record.analysis.riskAnalysis.length} rischi
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Expanded: Full analysis + Snapshot */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-3">
                                                {/* Toggle to show snapshot */}
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-[11px] border-slate-200"
                                                        onClick={() => setShowSnapshot(isSnapshotVisible ? null : record.id)}
                                                    >
                                                        <FileText className="w-3 h-3 mr-1" />
                                                        {isSnapshotVisible ? 'Nascondi Contesto' : 'Mostra Contesto al Momento'}
                                                    </Button>
                                                </div>

                                                {/* Snapshot details */}
                                                {isSnapshotVisible && (
                                                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-[11px]">
                                                        <div className="font-semibold text-slate-700 text-xs mb-2 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                            Snapshot Requisito e Stima
                                                        </div>

                                                        {/* Requirement Snapshot */}
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-slate-600">Requisito:</div>
                                                            <div className="text-slate-500 pl-2">
                                                                <div><span className="text-slate-400">Titolo:</span> {reqSnap.title}</div>
                                                                <div><span className="text-slate-400">Priorità:</span> {reqSnap.priority}</div>
                                                                <div><span className="text-slate-400">Stato:</span> {reqSnap.state}</div>
                                                                {reqSnap.technology_name && (
                                                                    <div><span className="text-slate-400">Tecnologia:</span> {reqSnap.technology_name}</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Estimation Snapshot */}
                                                        <div className="space-y-1 pt-1 border-t border-slate-200">
                                                            <div className="font-medium text-slate-600">Stima associata:</div>
                                                            <div className="text-slate-500 pl-2">
                                                                <div><span className="text-slate-400">Totale:</span> {snap.total_days.toFixed(1)} gg</div>
                                                                <div><span className="text-slate-400">Base:</span> {snap.base_hours}h</div>
                                                                <div><span className="text-slate-400">Moltiplicatore:</span> {snap.driver_multiplier.toFixed(2)}x</div>
                                                                <div><span className="text-slate-400">Rischio:</span> {snap.risk_score}</div>
                                                                <div><span className="text-slate-400">Contingenza:</span> {snap.contingency_percent}%</div>
                                                                <div><span className="text-slate-400">Scenario:</span> {snap.scenario_name}</div>
                                                            </div>
                                                        </div>

                                                        {/* Activities snapshot */}
                                                        {snap.activities && snap.activities.length > 0 && (
                                                            <div className="space-y-1 pt-1 border-t border-slate-200">
                                                                <div className="font-medium text-slate-600">
                                                                    Attività scelte ({snap.activities.length}):
                                                                </div>
                                                                <div className="pl-2 space-y-0.5">
                                                                    {snap.activities.map((act, i) => (
                                                                        <div key={i} className="flex items-center justify-between text-slate-500">
                                                                            <span className="truncate flex-1">{act.name}</span>
                                                                            <span className="text-slate-400 ml-2">{act.base_hours}h</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Drivers snapshot */}
                                                        {snap.drivers && snap.drivers.length > 0 && (
                                                            <div className="space-y-1 pt-1 border-t border-slate-200">
                                                                <div className="font-medium text-slate-600">
                                                                    Driver ({snap.drivers.length}):
                                                                </div>
                                                                <div className="pl-2 space-y-0.5">
                                                                    {snap.drivers.map((drv, i) => (
                                                                        <div key={i} className="flex items-center justify-between text-slate-500">
                                                                            <span className="truncate flex-1">{drv.name}</span>
                                                                            <span className="text-slate-400 ml-2">
                                                                                {drv.selected_value} ({drv.multiplier.toFixed(2)}x)
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Full analysis card */}
                                                <ConsultantAnalysisCard
                                                    analysis={record.analysis}
                                                    isCompact={true}
                                                />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
