/**
 * Interview Loading Component
 * 
 * Animated loading state while AI generates interview questions.
 */

import { motion } from 'framer-motion';
import { Sparkles, MessageSquareCode, Brain, Lightbulb } from 'lucide-react';

interface InterviewLoadingProps {
    techCategory?: string;
}

const LOADING_STEPS = [
    { icon: Brain, text: 'Analisi del requisito...', delay: 0 },
    { icon: MessageSquareCode, text: 'Identificazione aree tecniche...', delay: 0.5 },
    { icon: Lightbulb, text: 'Generazione domande...', delay: 1 },
];

export function InterviewLoading({ techCategory }: InterviewLoadingProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 space-y-8">
            {/* Animated Icon */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative"
            >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Sparkles className="w-10 h-10 text-white" />
                </div>

                {/* Pulsing ring */}
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-indigo-400"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-purple-400"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
            </motion.div>

            {/* Title */}
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">
                    Preparazione Interview Tecnica
                </h3>
                {techCategory && (
                    <p className="text-slate-500">
                        Stack: <span className="font-medium text-indigo-600">{techCategory}</span>
                    </p>
                )}
            </div>

            {/* Loading Steps */}
            <div className="space-y-3 w-full max-w-xs">
                {LOADING_STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: step.delay }}
                            className="flex items-center gap-3 text-sm"
                        >
                            <motion.div
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: step.delay }}
                                className="text-indigo-500"
                            >
                                <StepIcon className="w-5 h-5" />
                            </motion.div>
                            <span className="text-slate-600">{step.text}</span>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: step.delay + 0.5 }}
                                className="ml-auto"
                            >
                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Tip */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="text-xs text-slate-400 text-center max-w-sm"
            >
                Le domande saranno specifiche per il tuo requisito e lo stack tecnologico selezionato.
            </motion.p>
        </div>
    );
}
