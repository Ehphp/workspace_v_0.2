import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    CheckCircle,
    AlertCircle,
    Lightbulb,
    Target,
    Sparkles,
} from 'lucide-react';
import type { SeniorConsultantAnalysis } from '@/types/estimation';
import {
    getAssessmentColor,
    getAssessmentLabel,
    getSeverityColor,
} from '@/lib/consultant-api';
import ReactMarkdown from 'react-markdown';

interface ConsultantAnalysisCardProps {
    analysis: SeniorConsultantAnalysis;
    isCompact?: boolean;
}

// Loading indicator (simplified)
export function AnimatedConsultantIcon({ isLoading = false }: { isLoading?: boolean }) {
    return (
        <div className="relative">
            <div className={`p-1.5 bg-emerald-100 rounded-lg ${isLoading ? 'animate-pulse' : ''}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
        </div>
    );
}

function DiscrepancyIcon({ type }: { type: string }) {
    switch (type) {
        case 'missing_coverage':
            return <AlertTriangle className="w-3.5 h-3.5" />;
        case 'over_engineering':
            return <Target className="w-3.5 h-3.5" />;
        case 'activity_mismatch':
            return <AlertCircle className="w-3.5 h-3.5" />;
        case 'driver_issue':
            return <Lightbulb className="w-3.5 h-3.5" />;
        default:
            return <AlertTriangle className="w-3.5 h-3.5" />;
    }
}

function getDiscrepancyTypeLabel(type: string): string {
    switch (type) {
        case 'missing_coverage':
            return 'Copertura Mancante';
        case 'over_engineering':
            return 'Over-Engineering';
        case 'activity_mismatch':
            return 'Attività Non Allineata';
        case 'driver_issue':
            return 'Problema Driver';
        default:
            return type;
    }
}

function getRiskCategoryLabel(category: string): string {
    switch (category) {
        case 'technical':
            return 'Tecnico';
        case 'integration':
            return 'Integrazione';
        case 'resource':
            return 'Risorse';
        case 'timeline':
            return 'Timeline';
        case 'requirement_clarity':
            return 'Chiarezza Requisiti';
        default:
            return category;
    }
}

function getAssessmentIcon(assessment: string) {
    switch (assessment) {
        case 'approved':
            return <CheckCircle className="w-4 h-4 text-green-600" />;
        case 'needs_review':
            return <AlertCircle className="w-4 h-4 text-yellow-600" />;
        case 'concerns':
            return <AlertTriangle className="w-4 h-4 text-red-600" />;
        default:
            return <AlertCircle className="w-4 h-4" />;
    }
}

export function ConsultantAnalysisCard({ analysis, isCompact = false }: ConsultantAnalysisCardProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(isCompact ? [] : ['tips', 'discrepancies', 'risks'])
    );

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        setExpandedSections(newSet);
    };

    return (
        <div className="space-y-4">
            {/* Header — flat */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-800">Analisi Senior Consultant</span>
                    <span className="text-[11px] text-slate-400">
                        {new Date(analysis.generatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <Badge className={`${getAssessmentColor(analysis.overallAssessment)} border text-xs px-2 py-0.5`}>
                    {getAssessmentIcon(analysis.overallAssessment)}
                    <span className="ml-1">{getAssessmentLabel(analysis.overallAssessment)}</span>
                </Badge>
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Confidenza:</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${analysis.estimatedConfidence >= 80
                            ? 'bg-emerald-500'
                            : analysis.estimatedConfidence >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                        style={{ width: `${analysis.estimatedConfidence}%` }}
                    />
                </div>
                <span className="text-xs font-semibold text-slate-700">{analysis.estimatedConfidence}%</span>
            </div>

            {/* Sections */}
            <div className="space-y-2">
                {/* Implementation Tips */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('tips')}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-semibold text-slate-700">Consigli Implementativi</span>
                        </div>
                        {expandedSections.has('tips')
                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        }
                    </button>
                    {expandedSections.has('tips') && (
                        <div className="px-3 pb-3 prose prose-sm prose-slate max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <h3 className="text-sm font-bold text-slate-800 mt-3 mb-1.5">{children}</h3>,
                                    h2: ({ children }) => <h4 className="text-xs font-semibold text-slate-700 mt-2 mb-1">{children}</h4>,
                                    h3: ({ children }) => <h5 className="text-xs font-medium text-slate-600 mt-1.5 mb-1">{children}</h5>,
                                    p: ({ children }) => <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{children}</p>,
                                    ul: ({ children }) => <ul className="text-xs text-slate-600 space-y-0.5 ml-4 list-disc">{children}</ul>,
                                    li: ({ children }) => <li className="text-xs">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-slate-700">{children}</strong>,
                                }}
                            >
                                {analysis.implementationTips}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Discrepancies */}
                {analysis.discrepancies.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleSection('discrepancies')}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-semibold text-slate-700">
                                    Discrepanze ({analysis.discrepancies.length})
                                </span>
                            </div>
                            {expandedSections.has('discrepancies')
                                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            }
                        </button>
                        {expandedSections.has('discrepancies') && (
                            <div className="px-3 pb-3 space-y-2">
                                {analysis.discrepancies.map((disc, idx) => (
                                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                        <div className="flex items-start gap-2 mb-1.5">
                                            <Badge className={`${getSeverityColor(disc.severity)} text-[10px] px-1.5 py-0`}>
                                                <DiscrepancyIcon type={disc.type} />
                                                <span className="ml-1">{getDiscrepancyTypeLabel(disc.type)}</span>
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                                {disc.severity === 'high' ? 'Alta' : disc.severity === 'medium' ? 'Media' : 'Bassa'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-1.5">{disc.description}</p>
                                        <div className="flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
                                            <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{disc.recommendation}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Risk Analysis */}
                {analysis.riskAnalysis.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleSection('risks')}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Target className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-semibold text-slate-700">
                                    Analisi Rischi ({analysis.riskAnalysis.length})
                                </span>
                            </div>
                            {expandedSections.has('risks')
                                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            }
                        </button>
                        {expandedSections.has('risks') && (
                            <div className="px-3 pb-3 space-y-2">
                                {analysis.riskAnalysis.map((risk, idx) => (
                                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                        <div className="flex items-start gap-2 mb-1.5">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {getRiskCategoryLabel(risk.category)}
                                            </Badge>
                                            <Badge className={`${getSeverityColor(risk.level)} text-[10px] px-1.5 py-0 capitalize`}>
                                                {risk.level === 'high' ? 'Alto' : risk.level === 'medium' ? 'Medio' : 'Basso'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-1.5">{risk.description}</p>
                                        <div className="flex items-start gap-1.5 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                            <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{risk.mitigation}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {analysis.discrepancies.length === 0 && analysis.riskAnalysis.length === 0 && (
                    <div className="text-center py-3 text-slate-400 text-xs">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                        <p>Nessuna discrepanza o rischio significativo.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
