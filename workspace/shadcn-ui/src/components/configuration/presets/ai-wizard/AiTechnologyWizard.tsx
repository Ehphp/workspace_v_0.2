/**
 * AI Technology Wizard - Main Orchestrator
 * 
 * Complete wizard flow for AI-powered technology preset creation.
 */

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useAiWizardState } from '@/hooks/useAiWizardState';
import { generateInterviewQuestions } from '@/lib/ai-interview-api';
import { generateTechnologyPreset } from '@/lib/ai-preset-api';
import { DescriptionInput } from './DescriptionInput';
import { InterviewStep } from './InterviewStep';
import { GenerationProgress } from './GenerationProgress';
import { ReviewStep } from './ReviewStep';
import { SaveSuccess } from './SaveSuccess';
import type { GeneratedPreset } from '@/types/ai-preset-generation';
import type { AiQuestion, UserAnswer } from '@/types/ai-interview';

interface AiTechnologyWizardProps {
    open: boolean;
    onClose: () => void;
    onPresetCreated?: (preset: GeneratedPreset) => void;
}

/**
 * Validate answers before preset generation
 * Checks types, required fields, and enum values
 */
function validateAnswers(
    answers: Map<string, UserAnswer>,
    questions: AiQuestion[]
): string[] {
    const errors: string[] = [];

    questions.forEach(q => {
        const answer = answers.get(q.id);

        // Check required questions
        if (q.required && !answer) {
            errors.push(`La domanda "${q.question}" è obbligatoria`);
            return;
        }

        if (answer) {
            // Validate based on question type
            switch (q.type) {
                case 'single-choice':
                    if (typeof answer.value !== 'string') {
                        errors.push(`Risposta "${q.question}" deve essere una scelta singola`);
                    } else if (q.options && !q.options.some(opt => opt.id === answer.value)) {
                        errors.push(`Valore non valido per "${q.question}"`);
                    }
                    break;

                case 'multiple-choice':
                    if (!Array.isArray(answer.value)) {
                        errors.push(`Risposta "${q.question}" deve essere un array di scelte`);
                    } else if (q.options) {
                        const validIds = q.options.map(opt => opt.id);
                        const invalidValues = (answer.value as string[]).filter(v => !validIds.includes(v));
                        if (invalidValues.length > 0) {
                            errors.push(`Valori non validi per "${q.question}": ${invalidValues.join(', ')}`);
                        }
                    }
                    break;

                case 'text':
                    if (typeof answer.value !== 'string') {
                        errors.push(`Risposta "${q.question}" deve essere testo`);
                    } else if (q.maxLength && answer.value.length > q.maxLength) {
                        errors.push(`Risposta "${q.question}" troppo lunga (max ${q.maxLength} caratteri)`);
                    }
                    break;

                case 'range':
                    if (typeof answer.value !== 'number') {
                        errors.push(`Risposta "${q.question}" deve essere un numero`);
                    } else {
                        const numValue = answer.value as number;
                        if (numValue < q.min || numValue > q.max) {
                            errors.push(`Risposta "${q.question}" deve essere tra ${q.min} e ${q.max}`);
                        }
                    }
                    break;
            }
        }
    });

    return errors;
}

export function AiTechnologyWizard({
    open,
    onClose,
    onPresetCreated
}: AiTechnologyWizardProps) {
    const {
        state,
        data,
        canProceed,
        canGenerate,
        isFirstQuestion,
        isLastQuestion,
        progress,
        start,
        loadQuestions,
        setQuestionsError,
        answerQuestion,
        nextQuestion,
        previousQuestion,
        startGeneration,
        setGeneratedPreset,
        setGenerationError,
        editPreset,
        startSaving,
        setSaveSuccess,
        setSaveError,
        reset
    } = useAiWizardState();

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            // Small delay to allow animation to complete
            setTimeout(reset, 300);
        }
    }, [open, reset]);

    // Step 1: Generate questions
    const handleDescriptionSubmit = async (description: string) => {
        start(description);

        try {
            const response = await generateInterviewQuestions(description);

            if (response.success && response.questions && response.questions.length > 0) {
                loadQuestions(
                    response.questions,
                    response.reasoning,
                    response.suggestedTechCategory
                );
            } else {
                setQuestionsError('Non è stato possibile generare le domande. Riprova con una descrizione più dettagliata.');
            }
        } catch (error) {
            console.error('Question generation error:', error);
            setQuestionsError(
                error instanceof Error
                    ? error.message
                    : 'Errore durante la generazione delle domande. Verifica la tua connessione e riprova.'
            );
        }
    };

    // Step 2: Complete interview and generate preset
    const handleInterviewComplete = async () => {
        if (!data.description || data.answers.size === 0) {
            setGenerationError('Descrizione o risposte mancanti.');
            return;
        }

        // Validate answers before proceeding
        const validationErrors = validateAnswers(data.answers, data.questions);
        if (validationErrors.length > 0) {
            setGenerationError(validationErrors.join('. '));
            console.warn('[AiTechnologyWizard] Validation errors:', validationErrors);
            return;
        }

        startGeneration();

        try {
            // Convert Map to plain object for API - extract only the value
            const answersObject: Record<string, any> = {};
            data.answers.forEach((answer) => {
                answersObject[answer.questionId] = answer.value;
            });

            console.log('Sending preset generation request:', {
                description: data.description,
                answersCount: data.answers.size,
                suggestedTechCategory: data.suggestedTechCategory
            });

            const response = await generateTechnologyPreset({
                description: data.description,
                answers: answersObject,
                suggestedTechCategory: data.suggestedTechCategory
            });

            if (response.success && response.preset) {
                setGeneratedPreset(response.preset);
            } else {
                // Use specific error message from response if available
                const errorMessage = response.error ||
                    'Non è stato possibile generare il preset. Riprova.';
                setGenerationError(errorMessage);

                // Additional logging for debugging
                console.error('[AiTechnologyWizard] Preset generation failed:', {
                    error: response.error,
                    metadata: response.metadata
                });
            }
        } catch (error) {
            console.error('Preset generation error:', error);
            setGenerationError(
                error instanceof Error
                    ? error.message
                    : 'Errore durante la generazione del preset. Verifica la tua connessione e riprova.'
            );
        }
    };

    // Step 3: Save preset
    const handleSavePreset = async () => {
        if (!data.generatedPreset) return;

        startSaving();

        try {
            // Call parent callback with preset
            if (onPresetCreated) {
                await onPresetCreated(data.generatedPreset);
            }

            setSaveSuccess();
        } catch (error) {
            console.error('Preset save error:', error);
            setSaveError(
                error instanceof Error
                    ? error.message
                    : 'Errore durante il salvataggio del preset.'
            );
        }
    };

    // Handle close from success screen
    const handleSuccessClose = () => {
        reset();
        onClose();
    };

    // Handle create another preset
    const handleCreateAnother = () => {
        reset();
    };

    // Render current step based on state
    const renderStep = () => {
        switch (state) {
            case 'idle':
            case 'loading-questions':
                return (
                    <DescriptionInput
                        initialValue={data.description}
                        onSubmit={handleDescriptionSubmit}
                        loading={state === 'loading-questions'}
                    />
                );

            case 'interview':
                return (
                    <InterviewStep
                        questions={data.questions}
                        currentIndex={data.currentQuestionIndex}
                        answers={data.answers}
                        reasoning={data.reasoning}
                        onAnswer={answerQuestion}
                        onNext={nextQuestion}
                        onPrevious={previousQuestion}
                        onComplete={handleInterviewComplete}
                        canProceed={canProceed}
                        isLastQuestion={isLastQuestion}
                        isFirstQuestion={isFirstQuestion}
                    />
                );

            case 'generating-preset':
                return <GenerationProgress stage="selecting" />;

            case 'review':
                return data.generatedPreset ? (
                    <ReviewStep
                        preset={data.generatedPreset}
                        onSave={handleSavePreset}
                        onEdit={editPreset}
                        saving={false}
                    />
                ) : null;

            case 'saving':
                return <GenerationProgress stage="finalizing" />;

            case 'complete':
                return data.generatedPreset ? (
                    <SaveSuccess
                        presetName={data.generatedPreset.name}
                        onClose={handleSuccessClose}
                        onCreateAnother={handleCreateAnother}
                    />
                ) : null;

            case 'error':
                return (
                    <div className="space-y-6 max-w-2xl mx-auto py-12">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="ml-2">
                                {data.error || 'Si è verificato un errore imprevisto.'}
                            </AlertDescription>
                        </Alert>
                        <div className="flex justify-center gap-3">
                            <Button onClick={reset} variant="outline" className="gap-2">
                                <RotateCcw className="w-4 h-4" />
                                Ricomincia
                            </Button>
                            <Button onClick={onClose}>
                                Chiudi
                            </Button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-none !w-screen !h-screen !max-h-none !rounded-none !border-0 sm:rounded-none !p-0 overflow-y-auto bg-background/95 backdrop-blur-sm">
                <VisuallyHidden>
                    <DialogTitle>AI Technology Wizard</DialogTitle>
                </VisuallyHidden>

                <div className="max-w-5xl mx-auto min-h-full w-full relative flex flex-col p-6 md:p-12">
                    {/* Close button is automatically rendered by DialogContent but we want to ensure content doesn't overlap */}
                    <div className="flex-1 py-4">
                        {renderStep()}
                    </div>

                    {/* Progress Indicator (bottom fixed or sticky) */}
                    {state === 'interview' && (
                        <div className="fixed bottom-0 left-0 right-0 h-1 bg-slate-100 z-50">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
