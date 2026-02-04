/**
 * Requirement Interview Step Component
 * 
 * Container for the technical interview with:
 * - Progress indicator
 * - Navigation between questions
 * - Summary of answers
 * - Complexity indicator
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    ArrowRight,
    Sparkles,
    MessageSquareCode,
    CheckCircle2,
    AlertCircle,
    Lightbulb,
    ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TechnicalQuestionCard } from './TechnicalQuestionCard';
import type { TechnicalQuestion, InterviewAnswer } from '@/types/requirement-interview';

interface RequirementInterviewStepProps {
    questions: TechnicalQuestion[];
    currentIndex: number;
    answers: Map<string, InterviewAnswer>;
    reasoning?: string;
    estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
    onAnswer: (questionId: string, value: string | string[] | number) => void;
    onNext: () => void;
    onPrevious: () => void;
    onComplete: () => void;
    onBack: () => void;
    canProceed: boolean;
    isFirstQuestion: boolean;
    isLastQuestion: boolean;
    isGenerating: boolean;
}

const COMPLEXITY_CONFIG = {
    LOW: {
        label: 'Bassa',
        color: 'bg-green-100 text-green-700 border-green-200',
        description: 'Requisito standard, poche complessità'
    },
    MEDIUM: {
        label: 'Media',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        description: 'Alcune complessità da considerare'
    },
    HIGH: {
        label: 'Alta',
        color: 'bg-red-100 text-red-700 border-red-200',
        description: 'Requisito complesso, molte variabili'
    },
};

export function RequirementInterviewStep({
    questions,
    currentIndex,
    answers,
    reasoning,
    estimatedComplexity,
    onAnswer,
    onNext,
    onPrevious,
    onComplete,
    onBack,
    canProceed,
    isFirstQuestion,
    isLastQuestion,
    isGenerating,
}: RequirementInterviewStepProps) {
    const [viewMode, setViewMode] = useState<'single' | 'list'>('single');

    const currentQuestion = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;
    const answeredCount = answers.size;

    const requiredCount = useMemo(() =>
        questions.filter(q => q.required).length,
        [questions]
    );

    const requiredAnsweredCount = useMemo(() =>
        questions.filter(q => q.required && answers.has(q.id)).length,
        [questions, answers]
    );

    const allRequiredAnswered = requiredAnsweredCount === requiredCount;

    // Get category summary for progress
    const categorySummary = useMemo(() => {
        const categories = new Map<string, { total: number; answered: number }>();
        questions.forEach(q => {
            const existing = categories.get(q.category) || { total: 0, answered: 0 };
            existing.total++;
            if (answers.has(q.id)) existing.answered++;
            categories.set(q.category, existing);
        });
        return categories;
    }, [questions, answers]);

    const handleAnswerChange = (value: string | string[] | number) => {
        if (currentQuestion) {
            onAnswer(currentQuestion.id, value);
        }
    };

    const handleSubmit = () => {
        if (isLastQuestion || viewMode === 'list') {
            onComplete();
        } else {
            onNext();
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-4 pb-4 border-b border-slate-200">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                    <MessageSquareCode className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        Interview Tecnica
                    </h2>
                    <p className="text-slate-500 mt-1 max-w-lg mx-auto">
                        Rispondi a queste domande tecniche per ottenere una stima accurata.
                        <span className="block text-sm mt-1 text-slate-400">
                            Se non conosci una risposta, chiedi al funzionale di riferimento.
                        </span>
                    </p>
                </div>

                {/* Complexity Badge */}
                {estimatedComplexity && (
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-slate-500">Complessità stimata:</span>
                        <Badge
                            variant="outline"
                            className={COMPLEXITY_CONFIG[estimatedComplexity].color}
                        >
                            {COMPLEXITY_CONFIG[estimatedComplexity].label}
                        </Badge>
                    </div>
                )}
            </div>

            {/* Progress Section */}
            <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">
                        {viewMode === 'single'
                            ? `Domanda ${currentIndex + 1} di ${questions.length}`
                            : `${answeredCount} di ${questions.length} risposte`
                        }
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500">
                            {requiredAnsweredCount}/{requiredCount} obbligatorie
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant={viewMode === 'single' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('single')}
                                className="h-7 px-2"
                            >
                                Singola
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className="h-7 px-2"
                            >
                                <ListChecks className="w-4 h-4 mr-1" />
                                Lista
                            </Button>
                        </div>
                    </div>
                </div>
                <Progress value={viewMode === 'single' ? progress : (answeredCount / questions.length) * 100} className="h-2" />
            </div>

            {/* Reasoning (AI Context) - Collapsed by default */}
            {reasoning && (
                <details className="group">
                    <summary className="flex items-center gap-2 text-sm text-indigo-600 cursor-pointer hover:text-indigo-700">
                        <Lightbulb className="w-4 h-4" />
                        <span>Perché queste domande?</span>
                    </summary>
                    <div className="mt-2 bg-indigo-50 rounded-lg p-4 text-sm text-indigo-700 border border-indigo-100">
                        {reasoning}
                    </div>
                </details>
            )}

            {/* Question Area */}
            {viewMode === 'single' ? (
                /* Single Question View */
                <AnimatePresence mode="wait">
                    {currentQuestion && (
                        <motion.div
                            key={currentQuestion.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <TechnicalQuestionCard
                                question={currentQuestion}
                                value={answers.get(currentQuestion.id)?.value}
                                onChange={handleAnswerChange}
                                showContext={true}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            ) : (
                /* List View - All Questions */
                <div className="space-y-4">
                    {questions.map((question, idx) => (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <TechnicalQuestionCard
                                question={question}
                                value={answers.get(question.id)?.value}
                                onChange={(value) => onAnswer(question.id, value)}
                                showContext={false}
                                compact={true}
                            />
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <Button
                    variant="outline"
                    onClick={viewMode === 'single' && !isFirstQuestion ? onPrevious : onBack}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {viewMode === 'single' && !isFirstQuestion ? 'Precedente' : 'Torna al Preset'}
                </Button>

                <div className="text-sm">
                    {!canProceed && currentQuestion?.required && viewMode === 'single' && (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Risposta obbligatoria
                        </span>
                    )}
                    {!allRequiredAnswered && viewMode === 'list' && (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Completa le domande obbligatorie
                        </span>
                    )}
                </div>

                {viewMode === 'single' && !isLastQuestion ? (
                    <Button
                        onClick={onNext}
                        disabled={!canProceed}
                        className="gap-2"
                    >
                        Prossima
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        disabled={!allRequiredAnswered || isGenerating}
                        className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                        {isGenerating ? (
                            <>
                                <Sparkles className="w-4 h-4 animate-spin" />
                                Generazione stima...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Genera Stima
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
