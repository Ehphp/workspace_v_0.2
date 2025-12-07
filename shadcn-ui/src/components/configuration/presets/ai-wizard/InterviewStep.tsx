/**
 * Interview Step Component
 * 
 * Wrapper for the dynamic questionnaire with context and progress.
 */

import { MessageSquare } from 'lucide-react';
import { DynamicQuestionnaire } from './DynamicQuestionnaire';
import type { AiQuestion, AnswerValue } from '@/types/ai-interview';

interface InterviewStepProps {
    questions: AiQuestion[];
    currentIndex: number;
    answers: Map<string, { questionId: string; value: AnswerValue; timestamp: Date }>;
    reasoning?: string;
    onAnswer: (questionId: string, value: AnswerValue) => void;
    onNext: () => void;
    onPrevious: () => void;
    onComplete: () => void;
    canProceed: boolean;
    isLastQuestion: boolean;
    isFirstQuestion: boolean;
}

export function InterviewStep({
    questions,
    currentIndex,
    answers,
    reasoning,
    onAnswer,
    onNext,
    onPrevious,
    onComplete,
    canProceed,
    isLastQuestion,
    isFirstQuestion,
}: InterviewStepProps) {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 pb-4 border-b border-slate-200">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                    <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                    Rispondi alle domande
                </h2>
                {reasoning && (
                    <p className="text-sm text-slate-600 max-w-2xl mx-auto">
                        <span className="font-semibold">Perché queste domande?</span> {reasoning}
                    </p>
                )}
            </div>

            {/* Questionnaire */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <DynamicQuestionnaire
                    questions={questions}
                    currentIndex={currentIndex}
                    answers={answers}
                    onAnswer={onAnswer}
                    onNext={onNext}
                    onPrevious={onPrevious}
                    onComplete={onComplete}
                    canProceed={canProceed}
                    isLastQuestion={isLastQuestion}
                    isFirstQuestion={isFirstQuestion}
                />
            </div>

            {/* Help Text */}
            <div className="text-center text-xs text-slate-500">
                Le tue risposte aiuteranno l'AI a selezionare le attività più appropriate per il tuo progetto
            </div>
        </div>
    );
}
