/**
 * Interview Step Component
 * 
 * Wrapper for the dynamic questionnaire with context and progress.
 */

import { MessageSquare } from 'lucide-react';
import { DynamicQuestionnaire } from './DynamicQuestionnaire';
import type { AiQuestion, AnswerValue } from '@/types/ai-interview';
import { WIZARD_DESIGN } from './wizard-design-system';

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
        <div className={`${WIZARD_DESIGN.spacing.section} ${WIZARD_DESIGN.containers.wide} mx-auto`}>
            {/* Header */}
            <div className={`text-center ${WIZARD_DESIGN.spacing.items} pb-4 border-b border-slate-200`}>
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${WIZARD_DESIGN.gradients.primary} shadow-lg`}>
                    <MessageSquare className={WIZARD_DESIGN.icons.large} />
                </div>
                <h2 className={WIZARD_DESIGN.typography.title}>
                    Rispondi alle domande
                </h2>
                {reasoning && (
                    <p className={`${WIZARD_DESIGN.typography.description} max-w-2xl mx-auto`}>
                        <span className="font-semibold">Perché queste domande?</span> {reasoning}
                    </p>
                )}
            </div>

            {/* Questionnaire */}
            <div className={`bg-white ${WIZARD_DESIGN.borders.card} p-8`}>
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
            <div className={`text-center ${WIZARD_DESIGN.typography.help}`}>
                Le tue risposte aiuteranno l'AI a selezionare le attività più appropriate per il tuo progetto
            </div>
        </div>
    );
}
