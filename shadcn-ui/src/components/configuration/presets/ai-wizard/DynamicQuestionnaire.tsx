/**
 * Dynamic Questionnaire Component
 * 
 * Orchestrates the rendering of different question types and manages navigation.
 */

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { AiQuestion, AnswerValue } from '@/types/ai-interview';
import { SingleChoiceQuestion } from './SingleChoiceQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { TextQuestion } from './TextQuestion';
import { RangeQuestion } from './RangeQuestion';

interface DynamicQuestionnaireProps {
    questions: AiQuestion[];
    currentIndex: number;
    answers: Map<string, { questionId: string; value: AnswerValue; timestamp: Date }>;
    onAnswer: (questionId: string, value: AnswerValue) => void;
    onNext: () => void;
    onPrevious: () => void;
    onComplete: () => void;
    canProceed: boolean;
    isLastQuestion: boolean;
    isFirstQuestion: boolean;
}

export function DynamicQuestionnaire({
    questions,
    currentIndex,
    answers,
    onAnswer,
    onNext,
    onPrevious,
    onComplete,
    canProceed,
    isLastQuestion,
    isFirstQuestion,
}: DynamicQuestionnaireProps) {
    const currentQuestion = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;
    const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : undefined;

    if (!currentQuestion) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Nessuna domanda disponibile</p>
            </div>
        );
    }

    const handleAnswerChange = (value: AnswerValue) => {
        onAnswer(currentQuestion.id, value);
    };

    const renderQuestion = () => {
        switch (currentQuestion.type) {
            case 'single-choice':
                return (
                    <SingleChoiceQuestion
                        question={currentQuestion}
                        value={currentAnswer?.value as string}
                        onChange={handleAnswerChange}
                    />
                );

            case 'multiple-choice':
                return (
                    <MultipleChoiceQuestion
                        question={currentQuestion}
                        value={currentAnswer?.value as string[]}
                        onChange={handleAnswerChange}
                    />
                );

            case 'text':
                return (
                    <TextQuestion
                        question={currentQuestion}
                        value={currentAnswer?.value as string}
                        onChange={handleAnswerChange}
                    />
                );

            case 'range':
                return (
                    <RangeQuestion
                        question={currentQuestion}
                        value={currentAnswer?.value as number}
                        onChange={handleAnswerChange}
                    />
                );

            default:
                return <div className="text-destructive">Tipo di domanda non supportato</div>;
        }
    };

    return (
        <div className="space-y-8">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">
                        Domanda {currentIndex + 1} di {questions.length}
                    </span>
                    <span className="text-slate-500">{Math.round(progress)}% completato</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Current Question */}
            <div className="min-h-[300px]">
                {renderQuestion()}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <Button
                    variant="outline"
                    onClick={onPrevious}
                    disabled={isFirstQuestion}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Indietro
                </Button>

                <div className="text-sm text-slate-500">
                    {!canProceed && currentQuestion.required && (
                        <span className="text-destructive font-medium">
                            Risposta obbligatoria
                        </span>
                    )}
                </div>

                {!isLastQuestion ? (
                    <Button
                        onClick={onNext}
                        disabled={!canProceed}
                        className="gap-2"
                    >
                        Avanti
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={onComplete}
                        disabled={!canProceed}
                        className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                        <Sparkles className="w-4 h-4" />
                        Genera Preset
                    </Button>
                )}
            </div>

            {/* Optional: Show answered count */}
            <div className="text-center text-xs text-slate-500">
                {answers.size} di {questions.length} domande risposte
                {questions.filter(q => q.required).length > 0 && (
                    <span className="ml-2">
                        ({questions.filter(q => q.required).length} obbligatorie)
                    </span>
                )}
            </div>
        </div>
    );
}
