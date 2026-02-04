/**
 * Generation Progress Component
 * 
 * Loading state with animation while AI generates the preset.
 */

import { useEffect, useState } from 'react';
import { Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface GenerationProgressProps {
    stage?: 'analyzing' | 'selecting' | 'validating' | 'finalizing';
}

const STAGES = [
    { key: 'analyzing', label: 'Analisi del contesto', icon: Sparkles, duration: 2000 },
    { key: 'selecting', label: 'Selezione attività', icon: Zap, duration: 3000 },
    { key: 'validating', label: 'Validazione preset', icon: CheckCircle2, duration: 2000 },
    { key: 'finalizing', label: 'Finalizzazione', icon: CheckCircle2, duration: 1000 },
] as const;

export function GenerationProgress({ stage = 'analyzing' }: GenerationProgressProps) {
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Auto-advance through stages
    useEffect(() => {
        const stageIndex = STAGES.findIndex(s => s.key === stage);
        if (stageIndex >= 0) {
            setCurrentStageIndex(stageIndex);
            setProgress((stageIndex / STAGES.length) * 100);
        }

        // Simulate smooth progress within stage
        const interval = setInterval(() => {
            setProgress(prev => {
                const targetProgress = ((stageIndex + 1) / STAGES.length) * 100;
                if (prev >= targetProgress) return prev;
                return Math.min(prev + 2, targetProgress);
            });
        }, 50);

        return () => clearInterval(interval);
    }, [stage]);

    return (
        <div className="space-y-8 max-w-2xl mx-auto py-12">
            {/* Animation */}
            <div className="flex justify-center">
                <div className="relative">
                    {/* Outer ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-20 animate-pulse" />

                    {/* Middle ring */}
                    <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 opacity-30 animate-pulse animation-delay-150" />

                    {/* Inner circle */}
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl flex items-center justify-center">
                        <Sparkles className="w-16 h-16 text-white animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">
                    Generazione in corso...
                </h2>
                <p className="text-slate-600">
                    L'AI sta analizzando le tue risposte per creare il preset perfetto
                </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="text-center text-sm text-slate-500">
                    {Math.round(progress)}% completato
                </div>
            </div>

            {/* Stages */}
            <div className="space-y-3">
                {STAGES.map((stageItem, index) => {
                    const Icon = stageItem.icon;
                    const isActive = index === currentStageIndex;
                    const isCompleted = index < currentStageIndex;

                    return (
                        <div
                            key={stageItem.key}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isActive
                                    ? 'bg-blue-50 border-2 border-blue-300'
                                    : isCompleted
                                        ? 'bg-emerald-50 border border-emerald-200'
                                        : 'bg-slate-50 border border-slate-200'
                                }`}
                        >
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isActive
                                    ? 'bg-blue-500'
                                    : isCompleted
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-300'
                                }`}>
                                <Icon className={`w-5 h-5 text-white ${isActive ? 'animate-pulse' : ''}`} />
                            </div>
                            <span className={`font-medium ${isActive
                                    ? 'text-blue-900'
                                    : isCompleted
                                        ? 'text-emerald-900'
                                        : 'text-slate-500'
                                }`}>
                                {stageItem.label}
                            </span>
                            {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Estimated Time */}
            <div className="text-center text-xs text-slate-500">
                Tempo stimato: 10-15 secondi
            </div>
        </div>
    );
}
