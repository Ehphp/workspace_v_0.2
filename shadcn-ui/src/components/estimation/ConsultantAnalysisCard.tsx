import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

// Animated AI Icon for loading state
export function AnimatedConsultantIcon({ isLoading = false }: { isLoading?: boolean }) {
    return (
        <motion.div
            className="relative"
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg blur-lg opacity-50"
                animate={isLoading ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-2">
                <ShieldCheck className="w-4 h-4 text-white" />
            </div>
        </motion.div>
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
        <Card className="rounded-2xl shadow-lg border-slate-200/50 bg-white/90 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold text-slate-800">
                                Analisi Senior Consultant
                            </CardTitle>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {new Date(analysis.generatedAt).toLocaleString('it-IT')}
                            </p>
                        </div>
                    </div>

                    {/* Assessment Badge */}
                    <div className="flex items-center gap-2">
                        <Badge className={`${getAssessmentColor(analysis.overallAssessment)} border px-3 py-1 font-semibold`}>
                            {getAssessmentIcon(analysis.overallAssessment)}
                            <span className="ml-1.5">{getAssessmentLabel(analysis.overallAssessment)}</span>
                        </Badge>
                    </div>
                </div>

                {/* Confidence Score */}
                <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-slate-600 font-medium">Confidenza:</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.estimatedConfidence}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className={`h-full rounded-full ${analysis.estimatedConfidence >= 80
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : analysis.estimatedConfidence >= 60
                                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
                                    : 'bg-gradient-to-r from-red-500 to-orange-500'
                                }`}
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{analysis.estimatedConfidence}%</span>
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Implementation Tips Section */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => toggleSection('tips')}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <span className="heading-4">Consigli Implementativi</span>
                        </div>
                        {expandedSections.has('tips') ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </button>
                    <AnimatePresence>
                        {expandedSections.has('tips') && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="p-4 prose prose-sm prose-slate max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ children }) => <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">{children}</h3>,
                                            h2: ({ children }) => <h4 className="heading-4 mt-3 mb-2">{children}</h4>,
                                            h3: ({ children }) => <h5 className="text-sm font-medium text-slate-600 mt-2 mb-1">{children}</h5>,
                                            p: ({ children }) => <p className="text-xs text-slate-600 leading-relaxed mb-2">{children}</p>,
                                            ul: ({ children }) => <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">{children}</ul>,
                                            li: ({ children }) => <li className="text-xs">{children}</li>,
                                            strong: ({ children }) => <strong className="font-semibold text-slate-700">{children}</strong>,
                                        }}
                                    >
                                        {analysis.implementationTips}
                                    </ReactMarkdown>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Discrepancies Section */}
                {analysis.discrepancies.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                            onClick={() => toggleSection('discrepancies')}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <span className="heading-4">
                                    Discrepanze ({analysis.discrepancies.length})
                                </span>
                            </div>
                            {expandedSections.has('discrepancies') ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </button>
                        <AnimatePresence>
                            {expandedSections.has('discrepancies') && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 space-y-2">
                                        {analysis.discrepancies.map((disc, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 bg-white border border-slate-200 rounded-lg"
                                            >
                                                <div className="flex items-start gap-2 mb-2">
                                                    <Badge className={`${getSeverityColor(disc.severity)} text-[10px] px-2 py-0.5`}>
                                                        <DiscrepancyIcon type={disc.type} />
                                                        <span className="ml-1">{getDiscrepancyTypeLabel(disc.type)}</span>
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 capitalize">
                                                        {disc.severity === 'high' ? 'Alta' : disc.severity === 'medium' ? 'Media' : 'Bassa'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-700 mb-2">{disc.description}</p>
                                                <div className="flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
                                                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    <span>{disc.recommendation}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Risk Analysis Section */}
                {analysis.riskAnalysis.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                            onClick={() => toggleSection('risks')}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-red-600" />
                                <span className="heading-4">
                                    Analisi Rischi ({analysis.riskAnalysis.length})
                                </span>
                            </div>
                            {expandedSections.has('risks') ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </button>
                        <AnimatePresence>
                            {expandedSections.has('risks') && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 space-y-2">
                                        {analysis.riskAnalysis.map((risk, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 bg-white border border-slate-200 rounded-lg"
                                            >
                                                <div className="flex items-start gap-2 mb-2">
                                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                                        {getRiskCategoryLabel(risk.category)}
                                                    </Badge>
                                                    <Badge className={`${getSeverityColor(risk.level)} text-[10px] px-2 py-0.5 capitalize`}>
                                                        {risk.level === 'high' ? 'Alto' : risk.level === 'medium' ? 'Medio' : 'Basso'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-700 mb-2">{risk.description}</p>
                                                <div className="flex items-start gap-1.5 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    <span>{risk.mitigation}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Empty state for discrepancies and risks */}
                {analysis.discrepancies.length === 0 && analysis.riskAnalysis.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-xs">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p>Nessuna discrepanza o rischio significativo identificato.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
