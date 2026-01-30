/**
 * Estimation Result Step Component
 * 
 * Displays the estimation result after interview completion with:
 * - Total estimation
 * - Confidence score
 * - Activity breakdown with reasoning
 * - Suggested drivers and risks
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Calculator,
    Clock,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    ArrowRight,
    Sparkles,
    Info,
    ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import type {
    EstimationFromInterviewResponse,
    SelectedActivityWithReason,
    SuggestedDriver
} from '@/types/requirement-interview';

interface EstimationResultStepProps {
    result: EstimationFromInterviewResponse;
    onConfirm: () => void;
    onAdjust: () => void;
    onBack: () => void;
}

const CONFIDENCE_CONFIG = {
    high: {
        min: 0.8,
        label: 'Alta',
        color: 'text-green-700 bg-green-100',
        description: 'Stima affidabile basata su risposte complete'
    },
    medium: {
        min: 0.6,
        label: 'Media',
        color: 'text-yellow-700 bg-yellow-100',
        description: 'Stima ragionevole, alcune incertezze'
    },
    low: {
        min: 0,
        label: 'Bassa',
        color: 'text-red-700 bg-red-100',
        description: 'Stima approssimativa, consigliato approfondire'
    },
};

function getConfidenceLevel(score: number) {
    if (score >= CONFIDENCE_CONFIG.high.min) return CONFIDENCE_CONFIG.high;
    if (score >= CONFIDENCE_CONFIG.medium.min) return CONFIDENCE_CONFIG.medium;
    return CONFIDENCE_CONFIG.low;
}

export function EstimationResultStep({
    result,
    onConfirm,
    onAdjust,
    onBack,
}: EstimationResultStepProps) {
    const confidenceLevel = useMemo(() =>
        getConfidenceLevel(result.confidenceScore),
        [result.confidenceScore]
    );

    const totalHours = result.totalBaseDays * 8;

    // Group activities by whether they came from interview answers
    const { fromInterview, fromDescription } = useMemo(() => {
        const fromInterview: SelectedActivityWithReason[] = [];
        const fromDescription: SelectedActivityWithReason[] = [];

        result.activities.forEach(activity => {
            if (activity.fromQuestionId) {
                fromInterview.push(activity);
            } else {
                fromDescription.push(activity);
            }
        });

        return { fromInterview, fromDescription };
    }, [result.activities]);

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 pb-4 border-b border-slate-200">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25"
                >
                    <Calculator className="w-7 h-7 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900">
                    Stima Completata
                </h2>
                <p className="text-slate-500">
                    Basata sulle tue risposte all'interview tecnica
                </p>
            </div>

            {/* Main Estimate Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Stima Totale</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-4xl font-bold text-slate-900">
                                    {result.totalBaseDays.toFixed(1)}
                                </span>
                                <span className="text-xl text-slate-500">giorni</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                                = {totalHours.toFixed(0)} ore lavorative
                            </p>
                        </div>

                        <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                                <span className="text-sm text-slate-500">Confidenza:</span>
                                <Badge className={confidenceLevel.color}>
                                    {confidenceLevel.label} ({Math.round(result.confidenceScore * 100)}%)
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                                {confidenceLevel.description}
                            </p>
                        </div>
                    </div>

                    {/* Confidence Progress */}
                    <div className="mt-4">
                        <Progress
                            value={result.confidenceScore * 100}
                            className="h-2"
                        />
                    </div>
                </Card>
            </motion.div>

            {/* AI Reasoning */}
            {result.reasoning && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="p-4 bg-indigo-50 border-indigo-100">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-indigo-900 text-sm">Analisi AI</p>
                                <p className="text-indigo-700 text-sm mt-1">{result.reasoning}</p>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Activities Breakdown */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
            >
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400" />
                    Attività Selezionate ({result.activities.length})
                </h3>

                {/* Activities from Interview */}
                {fromInterview.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Dalle risposte all'interview
                        </p>
                        {fromInterview.map((activity, idx) => (
                            <ActivityCard key={activity.code} activity={activity} index={idx} />
                        ))}
                    </div>
                )}

                {/* Activities from Description */}
                {fromDescription.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Dalla descrizione del requisito
                        </p>
                        {fromDescription.map((activity, idx) => (
                            <ActivityCard key={activity.code} activity={activity} index={idx + fromInterview.length} />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Suggested Drivers */}
            {result.suggestedDrivers && result.suggestedDrivers.length > 0 && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                        Driver Suggeriti
                    </h3>
                    <Card className="p-4 bg-amber-50 border-amber-100">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="space-y-2">
                                <p className="text-sm text-amber-900">
                                    In base alle risposte, ti suggeriamo di considerare questi driver di complessità:
                                </p>
                                <ul className="space-y-1">
                                    {result.suggestedDrivers.map((driver) => (
                                        <li key={driver.code} className="text-sm text-amber-700 flex items-center gap-2">
                                            <ChevronRight className="w-4 h-4" />
                                            <span className="font-medium">{driver.code}</span>: {driver.suggestedValue}
                                            <span className="text-amber-600">— {driver.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Suggested Risks */}
            {result.suggestedRisks && result.suggestedRisks.length > 0 && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3"
                >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-slate-400" />
                        Rischi Identificati
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {result.suggestedRisks.map((risk) => (
                            <Badge key={risk} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {risk}
                            </Badge>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Actions */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-between pt-6 border-t border-slate-200"
            >
                <Button variant="outline" onClick={onBack}>
                    Modifica Risposte
                </Button>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={onAdjust}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Affina con Driver/Rischi
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Conferma Stima
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

/**
 * Activity Card subcomponent
 */
function ActivityCard({ activity, index }: { activity: SelectedActivityWithReason; index: number }) {
    return (
        <motion.div
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 * index }}
        >
            <Card className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">
                                {activity.code}
                            </Badge>
                            <span className="font-medium text-slate-900 text-sm truncate">
                                {activity.name}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {activity.reason}
                        </p>
                        {activity.fromAnswer && (
                            <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Dalla risposta: "{activity.fromAnswer}"
                            </p>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <p className="font-semibold text-slate-900">
                            {(activity.baseHours / 8).toFixed(1)}g
                        </p>
                        <p className="text-xs text-slate-400">
                            {activity.baseHours}h
                        </p>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
