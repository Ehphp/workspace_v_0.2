import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuickEstimationV2 } from '@/hooks/useQuickEstimationV2';
import { QuickEstimateInput } from '@/components/estimation/quick-estimate/QuickEstimateInput';
import { QuickEstimateResultV2 } from '@/components/estimation/quick-estimate/QuickEstimateResultV2';
import { QuickEstimateProgress } from '@/components/estimation/quick-estimate/QuickEstimateProgress';
import { TechnicalQuestionCard } from '@/components/estimation/interview';
import { Zap, Sparkles, ArrowLeft, MessageCircleQuestion, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

interface QuickEstimateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectTechnicalBlueprint?: ProjectTechnicalBlueprint;
}

type ViewState = 'input' | 'running' | 'micro-interview' | 'result';

export function QuickEstimate({ open, onOpenChange, projectTechnicalBlueprint }: QuickEstimateProps) {
    const [view, setView] = useState<ViewState>('input');
    const [description, setDescription] = useState('');
    const [technologyId, setTechnologyId] = useState('');
    const [microAnswers, setMicroAnswers] = useState<Record<string, string | string[] | number>>({});

    const {
        currentStep,
        stepLabel,
        isRunning,
        result,
        error,
        liveInsights,
        pendingQuestions,
        technologies: presets,
        loadMasterData,
        calculate,
        reset,
        abort,
        submitMicroInterview,
        skipMicroInterview,
    } = useQuickEstimationV2();

    useEffect(() => {
        if (open) {
            loadMasterData();
            if (!result) {
                setView('input');
                setDescription('');
                setTechnologyId('');
                setMicroAnswers({});
            }
        }
    }, [open]);

    // Switch to micro-interview view when questions arrive
    useEffect(() => {
        if (pendingQuestions && pendingQuestions.length > 0) {
            setMicroAnswers({});
            setView('micro-interview');
        }
    }, [pendingQuestions]);

    const handleCalculate = async () => {
        setView('running');
        const success = await calculate(description, technologyId, undefined, projectTechnicalBlueprint);
        if (success) {
            setView('result');
        } else if (currentStep !== 'micro-interview') {
            // Only go back to input if we're not paused on micro-interview
            setView('input');
        }
    };

    const handleMicroAnswer = useCallback((questionId: string, value: string | string[] | number) => {
        setMicroAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);

    const handleMicroSubmit = useCallback(async () => {
        setView('running');
        submitMicroInterview(microAnswers);
    }, [microAnswers, submitMicroInterview]);

    const handleMicroSkip = useCallback(async () => {
        setView('running');
        skipMicroInterview();
    }, [skipMicroInterview]);

    const handleReset = () => {
        setDescription('');
        setTechnologyId('');
        abort();
        reset();
        setView('input');
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    const canCalculate = description.trim().length > 0 && technologyId !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden backdrop-blur-2xl border-white/40 shadow-2xl ring-1 ring-white/50"
                onInteractOutside={(e) => e.preventDefault()}
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl -z-10 pointer-events-none" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100/60 flex items-center gap-5 relative z-10 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/40">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/50">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                            Quick Estimate
                        </h2>
                        <p className="text-slate-500 font-medium flex items-center gap-2 text-sm">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            AI-powered estimation engine
                        </p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 relative z-10">
                    <AnimatePresence mode="wait">
                        {view === 'input' ? (
                            <motion.div
                                key="input"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <QuickEstimateInput
                                    description={description}
                                    onDescriptionChange={setDescription}
                                    technologyId={technologyId}
                                    onPresetChange={setTechnologyId}
                                    presets={presets}
                                    calculating={isRunning}
                                    error={error}
                                />
                            </motion.div>
                        ) : view === 'running' ? (
                            <motion.div
                                key="running"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <QuickEstimateProgress
                                    currentStep={currentStep}
                                    stepLabel={stepLabel}
                                    liveInsights={liveInsights}
                                />
                            </motion.div>
                        ) : view === 'micro-interview' && pendingQuestions ? (
                            <motion.div
                                key="micro-interview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <MessageCircleQuestion className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-800">Domande di chiarimento</h3>
                                        <p className="text-xs text-slate-500">Rispondi per migliorare la precisione della stima, oppure salta.</p>
                                    </div>
                                </div>
                                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                                    {pendingQuestions.map((q) => (
                                        <TechnicalQuestionCard
                                            key={q.id}
                                            question={q}
                                            value={microAnswers[q.id]}
                                            onChange={(value) => handleMicroAnswer(q.id, value)}
                                            compact
                                            showContext={false}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {result && (
                                    <QuickEstimateResultV2 result={result} />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100/60 bg-white/80 backdrop-blur-md flex justify-between items-center relative z-10">
                    {view === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={handleClose} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">Cancel</Button>
                            <Button
                                onClick={handleCalculate}
                                disabled={!canCalculate || isRunning}
                                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-700 hover:via-indigo-700 hover:to-fuchsia-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all px-8 h-11 rounded-lg font-medium"
                            >
                                Calculate Estimate
                                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                            </Button>
                        </>
                    ) : view === 'micro-interview' ? (
                        <div className="flex gap-3 w-full justify-between">
                            <Button variant="ghost" onClick={handleMicroSkip} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
                                <SkipForward className="w-4 h-4 mr-2" />
                                Salta
                            </Button>
                            <Button
                                onClick={handleMicroSubmit}
                                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-700 hover:via-indigo-700 hover:to-fuchsia-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all px-8 h-11 rounded-lg font-medium"
                            >
                                Conferma e stima
                                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                            </Button>
                        </div>
                    ) : view === 'running' ? (
                        <div className="flex w-full justify-center">
                            <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-3 w-full justify-end">
                            <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                New Estimate
                            </Button>
                            <Button onClick={handleClose} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 px-8 h-11 rounded-lg">
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
