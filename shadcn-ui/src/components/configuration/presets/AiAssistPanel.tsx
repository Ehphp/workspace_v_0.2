/**
 * AI Assist Panel - Premium AI wizard for technology preset creation
 * 
 * Features:
 * - Compact trigger button in column
 * - Full wizard in popup dialog
 * - Visual stepper for progress tracking
 * - Glassmorphism cards for options
 * - Smooth framer-motion animations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Brain,
    Zap,
    ArrowRight,
    ArrowLeft,
    RotateCcw,
    Check,
    X,
} from 'lucide-react';
import { generateInterviewQuestions } from '@/lib/ai-interview-api';
import { generateTechnologyPreset } from '@/lib/ai-preset-api';
import type { AiQuestion, UserAnswer } from '@/types/ai-interview';
import type { GeneratedPreset, SuggestedActivity } from '@/types/ai-preset-generation';
import type { Activity } from '@/types/database';
import { cn } from '@/lib/utils';

type AiWizardStep = 'idle' | 'loading-questions' | 'interview' | 'generating' | 'complete' | 'error';

interface AiAssistPanelProps {
    onPresetGenerated: (preset: GeneratedPreset, resolvedActivities: Activity[]) => void;
    existingActivities: Activity[];
    disabled?: boolean;
    description: string;
    techCategory?: string;
}

// Animation variants
const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }
};

const optionVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
        opacity: 1, x: 0,
        transition: { delay: i * 0.05, duration: 0.2 }
    }),
    hover: { scale: 1.02, transition: { duration: 0.15 } },
    tap: { scale: 0.98 }
};

// Step indicator component
const StepIndicator = ({ step, currentStep, label }: { step: number; currentStep: number; label: string }) => {
    const isActive = step === currentStep;
    const isComplete = step < currentStep;

    return (
        <div className="flex flex-col items-center gap-1">
            <motion.div
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    isComplete && "bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/30",
                    isActive && "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/40 ring-4 ring-purple-500/20",
                    !isActive && !isComplete && "bg-slate-100 text-slate-400"
                )}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 2 }}
            >
                {isComplete ? <Check className="w-5 h-5" /> : step}
            </motion.div>
            <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-purple-600" : "text-slate-400"
            )}>
                {label}
            </span>
        </div>
    );
};

// Animated AI Icon
const AnimatedAiIcon = ({ isLoading = false, size = 'sm' }: { isLoading?: boolean; size?: 'sm' | 'lg' }) => {
    const iconSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    const containerSize = size === 'lg' ? 'p-3' : 'p-2';

    return (
        <motion.div
            className="relative"
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg blur-lg opacity-50"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <div className={cn("relative bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg", containerSize)}>
                <Sparkles className={cn(iconSize, "text-white")} />
            </div>
        </motion.div>
    );
};

// Loading skeleton
const LoadingSkeleton = ({ message, submessage }: { message: string; submessage?: string }) => (
    <motion.div
        className="flex flex-col items-center py-12 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
    >
        <div className="relative">
            <motion.div
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
                <Brain className="w-10 h-10 text-purple-500" />
            </motion.div>
        </div>
        <div className="text-center space-y-2">
            <p className="text-base font-medium text-slate-700">{message}</p>
            {submessage && (
                <motion.p
                    className="text-sm text-slate-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    {submessage}
                </motion.p>
            )}
        </div>
        <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-purple-500"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
            ))}
        </div>
    </motion.div>
);

export function AiAssistPanel({
    onPresetGenerated,
    existingActivities,
    disabled = false,
    description,
    techCategory: externalTechCategory,
}: AiAssistPanelProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [step, setStep] = useState<AiWizardStep>('idle');
    const [questions, setQuestions] = useState<AiQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
    const [suggestedTechCategory, setSuggestedTechCategory] = useState<string | undefined>(externalTechCategory);
    const [error, setError] = useState<string | null>(null);
    const [generatedPreset, setGeneratedPreset] = useState<GeneratedPreset | null>(null);

    const currentQuestion = questions[currentQuestionIndex];
    const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

    const getVisualStep = () => {
        if (step === 'idle' || step === 'loading-questions') return 1;
        if (step === 'interview') return 2;
        return 3;
    };

    const resetWizard = () => {
        setStep('idle');
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setAnswers(new Map());
        setSuggestedTechCategory(externalTechCategory);
        setError(null);
        setGeneratedPreset(null);
    };

    const handleStartWizard = async () => {
        if (description.trim().length < 20) {
            setError('La descrizione deve essere di almeno 20 caratteri');
            return;
        }

        setIsDialogOpen(true);
        setStep('loading-questions');
        setError(null);

        try {
            const response = await generateInterviewQuestions(description);

            if (response.success && response.questions && response.questions.length > 0) {
                setQuestions(response.questions);
                setSuggestedTechCategory(response.suggestedTechCategory);
                setStep('interview');
            } else {
                setError('Non è stato possibile generare le domande. Riprova con più dettagli.');
                setStep('error');
            }
        } catch (err) {
            console.error('Question generation error:', err);
            setError(err instanceof Error ? err.message : 'Errore di connessione');
            setStep('error');
        }
    };

    const handleAnswer = (questionId: string, value: string | string[] | number) => {
        setAnswers(prev => {
            const newAnswers = new Map(prev);
            newAnswers.set(questionId, { questionId, value, timestamp: new Date() });
            return newAnswers;
        });
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const prevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleGeneratePreset = async () => {
        setStep('generating');
        setError(null);

        try {
            const answersObject: Record<string, string | string[] | number> = {};
            answers.forEach((answer) => {
                answersObject[answer.questionId] = answer.value;
            });

            const response = await generateTechnologyPreset({
                description,
                answers: answersObject,
                suggestedTechCategory,
            });

            if (response.success && response.preset) {
                setGeneratedPreset(response.preset);
                const resolvedActivities = resolveActivities(response.preset.activities, existingActivities);
                onPresetGenerated(response.preset, resolvedActivities);
                setStep('complete');
                // Auto-close after success
                setTimeout(() => {
                    setIsDialogOpen(false);
                    resetWizard();
                }, 2000);
            } else {
                setError(response.error || 'Errore durante la generazione');
                setStep('error');
            }
        } catch (err) {
            console.error('Preset generation error:', err);
            setError(err instanceof Error ? err.message : 'Errore di connessione');
            setStep('error');
        }
    };

    const resolveActivities = (suggestedActivities: SuggestedActivity[], catalog: Activity[]): Activity[] => {
        return suggestedActivities.map((suggested, index) => {
            if (suggested.existingCode) {
                const existing = catalog.find(a => a.code === suggested.existingCode);
                if (existing) {
                    return { ...existing, base_hours: suggested.estimatedHours || existing.base_hours };
                }
            }

            return {
                id: `new-${index}-${Date.now()}`,
                code: `AI_${suggested.group}_${index}`,
                name: suggested.title,
                description: suggested.description,
                base_hours: suggested.estimatedHours,
                tech_category: suggestedTechCategory || 'MULTI',
                group: suggested.group,
                active: true,
                is_custom: true,
                _isNew: true,
                _aiSuggested: true,
            } as Activity & { _isNew?: boolean; _aiSuggested?: boolean };
        });
    };

    const renderQuestionInput = () => {
        if (!currentQuestion) return null;
        const currentAnswer = answers.get(currentQuestion.id)?.value;

        switch (currentQuestion.type) {
            case 'single-choice':
                return (
                    <div className="space-y-2">
                        {currentQuestion.options?.map((opt, i) => {
                            const isSelected = currentAnswer === opt.id;
                            return (
                                <motion.button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleAnswer(currentQuestion.id, opt.id)}
                                    custom={i}
                                    variants={optionVariants}
                                    initial="hidden"
                                    animate="visible"
                                    whileHover="hover"
                                    whileTap="tap"
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 backdrop-blur-sm",
                                        isSelected
                                            ? "border-purple-500 bg-purple-50/80 shadow-lg shadow-purple-500/10"
                                            : "border-slate-200 bg-white/50 hover:border-purple-300"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                                            isSelected ? "border-purple-500 bg-purple-500" : "border-slate-300"
                                        )}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "font-medium text-sm transition-colors",
                                                isSelected ? "text-purple-900" : "text-slate-700"
                                            )}>
                                                {opt.label}
                                            </div>
                                            {opt.description && (
                                                <div className="text-xs text-slate-500 mt-1">{opt.description}</div>
                                            )}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                );

            case 'multiple-choice':
                const selectedValues = (currentAnswer as string[]) || [];
                return (
                    <div className="space-y-2">
                        {currentQuestion.options?.map((opt, i) => {
                            const isSelected = selectedValues.includes(opt.id);
                            return (
                                <motion.button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        const newValues = isSelected
                                            ? selectedValues.filter(v => v !== opt.id)
                                            : [...selectedValues, opt.id];
                                        handleAnswer(currentQuestion.id, newValues);
                                    }}
                                    custom={i}
                                    variants={optionVariants}
                                    initial="hidden"
                                    animate="visible"
                                    whileHover="hover"
                                    whileTap="tap"
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 backdrop-blur-sm",
                                        isSelected
                                            ? "border-purple-500 bg-purple-50/80 shadow-lg shadow-purple-500/10"
                                            : "border-slate-200 bg-white/50 hover:border-purple-300"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                            isSelected ? "border-purple-500 bg-purple-500" : "border-slate-300"
                                        )}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={cn(
                                            "font-medium text-sm",
                                            isSelected ? "text-purple-900" : "text-slate-700"
                                        )}>
                                            {opt.label}
                                        </span>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                );

            case 'text':
                return (
                    <Textarea
                        value={(currentAnswer as string) || ''}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        placeholder="Scrivi la tua risposta..."
                        className="bg-white/50 border-slate-200 backdrop-blur-sm focus:border-purple-500"
                        rows={3}
                    />
                );

            default:
                return null;
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        if (step !== 'complete') {
            resetWizard();
        }
    };

    const isReady = description.trim().length >= 20;

    return (
        <>
            {/* Compact Trigger Button */}
            <motion.button
                type="button"
                onClick={handleStartWizard}
                disabled={disabled || !isReady}
                className={cn(
                    "w-full p-3 rounded-xl border-2 transition-all duration-300",
                    "flex items-center gap-3",
                    isReady && !disabled
                        ? "bg-gradient-to-r from-violet-50 to-purple-50 border-purple-200 hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/10"
                        : "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                )}
                whileHover={isReady && !disabled ? { scale: 1.01 } : {}}
                whileTap={isReady && !disabled ? { scale: 0.99 } : {}}
            >
                <AnimatedAiIcon isLoading={false} size="sm" />
                <div className="flex-1 text-left">
                    <div className="font-semibold text-xs text-slate-800">
                        Genera con AI
                    </div>
                    <div className="text-[10px] text-slate-500">
                        {isReady ? 'Avvia wizard intelligente' : 'Descrizione troppo breve'}
                    </div>
                </div>
                <Zap className={cn("w-4 h-4", isReady ? "text-purple-500" : "text-slate-300")} />
            </motion.button>

            {/* Interview Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-gradient-to-br from-white to-slate-50 border-slate-200">
                    <DialogHeader className="shrink-0 pb-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AnimatedAiIcon isLoading={step === 'loading-questions' || step === 'generating'} size="lg" />
                                <div>
                                    <DialogTitle className="text-lg font-bold text-slate-800">
                                        Assistente AI
                                    </DialogTitle>
                                    <p className="text-sm text-slate-500">
                                        {step === 'loading-questions' && 'Analisi in corso...'}
                                        {step === 'interview' && `Domanda ${currentQuestionIndex + 1} di ${questions.length}`}
                                        {step === 'generating' && 'Generazione preset...'}
                                        {step === 'complete' && 'Completato!'}
                                        {step === 'error' && 'Errore'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Step Indicator */}
                        {step !== 'error' && (
                            <div className="flex items-center justify-center gap-6 pt-6">
                                <StepIndicator step={1} currentStep={getVisualStep()} label="Analisi" />
                                <div className="w-12 h-0.5 bg-slate-200 rounded" />
                                <StepIndicator step={2} currentStep={getVisualStep()} label="Intervista" />
                                <div className="w-12 h-0.5 bg-slate-200 rounded" />
                                <StepIndicator step={3} currentStep={getVisualStep()} label="Genera" />
                            </div>
                        )}
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-6">
                        <AnimatePresence mode="wait">
                            {/* Loading Questions */}
                            {step === 'loading-questions' && (
                                <motion.div key="loading" variants={cardVariants} initial="hidden" animate="visible" exit="exit">
                                    <LoadingSkeleton message="Analisi della tecnologia..." submessage="Sto generando domande personalizzate" />
                                </motion.div>
                            )}

                            {/* Interview */}
                            {step === 'interview' && currentQuestion && (
                                <motion.div key={`q-${currentQuestionIndex}`} variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 px-2">
                                    {/* Progress bar */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Progresso</span>
                                            <span className="font-medium text-purple-600">{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Question card */}
                                    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 rounded-xl bg-purple-100 shrink-0">
                                                <Brain className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="secondary" className="text-xs bg-slate-100">
                                                        Domanda {currentQuestionIndex + 1}/{questions.length}
                                                    </Badge>
                                                    {currentQuestion.required && (
                                                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                                            Obbligatoria
                                                        </Badge>
                                                    )}
                                                </div>
                                                <h4 className="text-base font-semibold text-slate-800">
                                                    {currentQuestion.question}
                                                </h4>
                                                {currentQuestion.description && (
                                                    <p className="text-sm text-slate-500 mt-1">{currentQuestion.description}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            {renderQuestionInput()}
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex gap-3">
                                        <motion.button
                                            type="button"
                                            onClick={prevQuestion}
                                            disabled={currentQuestionIndex === 0}
                                            className={cn(
                                                "flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border-2",
                                                currentQuestionIndex === 0
                                                    ? "border-slate-200 text-slate-400 cursor-not-allowed"
                                                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                                            )}
                                            whileHover={currentQuestionIndex > 0 ? { scale: 1.02 } : {}}
                                            whileTap={currentQuestionIndex > 0 ? { scale: 0.98 } : {}}
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            Indietro
                                        </motion.button>

                                        {currentQuestionIndex < questions.length - 1 ? (
                                            <motion.button
                                                type="button"
                                                onClick={nextQuestion}
                                                disabled={currentQuestion.required && !answers.has(currentQuestion.id)}
                                                className={cn(
                                                    "flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2",
                                                    currentQuestion.required && !answers.has(currentQuestion.id)
                                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-purple-500/30"
                                                )}
                                                whileHover={!(currentQuestion.required && !answers.has(currentQuestion.id)) ? { scale: 1.02 } : {}}
                                                whileTap={!(currentQuestion.required && !answers.has(currentQuestion.id)) ? { scale: 0.98 } : {}}
                                            >
                                                Avanti
                                                <ArrowRight className="w-4 h-4" />
                                            </motion.button>
                                        ) : (
                                            <motion.button
                                                type="button"
                                                onClick={handleGeneratePreset}
                                                disabled={currentQuestion.required && !answers.has(currentQuestion.id)}
                                                className={cn(
                                                    "flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2",
                                                    currentQuestion.required && !answers.has(currentQuestion.id)
                                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30"
                                                )}
                                                whileHover={!(currentQuestion.required && !answers.has(currentQuestion.id)) ? { scale: 1.02 } : {}}
                                                whileTap={!(currentQuestion.required && !answers.has(currentQuestion.id)) ? { scale: 0.98 } : {}}
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                Genera Preset
                                            </motion.button>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Generating */}
                            {step === 'generating' && (
                                <motion.div key="generating" variants={cardVariants} initial="hidden" animate="visible" exit="exit">
                                    <LoadingSkeleton message="Generazione preset in corso..." submessage="Sto creando attività, driver e rischi personalizzati" />
                                </motion.div>
                            )}

                            {/* Complete */}
                            {step === 'complete' && generatedPreset && (
                                <motion.div key="complete" variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="text-center py-8 space-y-6">
                                    <motion.div
                                        className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/30"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', duration: 0.5 }}
                                    >
                                        <CheckCircle2 className="w-10 h-10 text-white" />
                                    </motion.div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Preset Generato!</h3>
                                        <p className="text-slate-500 mt-1">Il form è stato popolato con i dati generati</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                                        <div className="text-center p-4 rounded-xl bg-purple-50 border border-purple-100">
                                            <div className="text-2xl font-bold text-purple-700">{generatedPreset.activities.length}</div>
                                            <div className="text-xs text-purple-600">Attività</div>
                                        </div>
                                        <div className="text-center p-4 rounded-xl bg-orange-50 border border-orange-100">
                                            <div className="text-2xl font-bold text-orange-700">{Object.keys(generatedPreset.driverValues || {}).length}</div>
                                            <div className="text-xs text-orange-600">Driver</div>
                                        </div>
                                        <div className="text-center p-4 rounded-xl bg-green-50 border border-green-100">
                                            <div className="text-2xl font-bold text-green-700">{Math.round(generatedPreset.confidence * 100)}%</div>
                                            <div className="text-xs text-green-600">Confidenza</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Error */}
                            {step === 'error' && (
                                <motion.div key="error" variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 px-2">
                                    <div className="rounded-2xl bg-red-50 border border-red-200 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-full bg-red-100">
                                                <AlertCircle className="w-6 h-6 text-red-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-semibold text-red-800">Si è verificato un errore</h4>
                                                <p className="text-sm text-red-600 mt-1">{error}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <motion.button
                                            type="button"
                                            onClick={handleCloseDialog}
                                            className="flex-1 py-3 px-4 rounded-xl font-medium text-sm border-2 border-slate-200 text-slate-700 hover:border-slate-300 flex items-center justify-center gap-2"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <X className="w-4 h-4" />
                                            Chiudi
                                        </motion.button>
                                        <motion.button
                                            type="button"
                                            onClick={() => {
                                                resetWizard();
                                                handleStartWizard();
                                            }}
                                            className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Riprova
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
