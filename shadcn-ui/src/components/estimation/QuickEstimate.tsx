import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuickEstimationV2 } from '@/hooks/useQuickEstimationV2';
import { QuickEstimateInput } from '@/components/estimation/quick-estimate/QuickEstimateInput';
import { QuickEstimateResultV2 } from '@/components/estimation/quick-estimate/QuickEstimateResultV2';
import { QuickEstimateProgress } from '@/components/estimation/quick-estimate/QuickEstimateProgress';
import { Zap, Sparkles, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuickEstimateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ViewState = 'input' | 'running' | 'result';

export function QuickEstimate({ open, onOpenChange }: QuickEstimateProps) {
    const [view, setView] = useState<ViewState>('input');
    const [description, setDescription] = useState('');
    const [techPresetId, setTechPresetId] = useState('');

    const {
        currentStep,
        stepLabel,
        isRunning,
        result,
        error,
        isDemoMode,
        liveInsights,
        technologies: presets,
        loadMasterData,
        calculate,
        reset,
        abort,
    } = useQuickEstimationV2();

    useEffect(() => {
        if (open) {
            loadMasterData();
            if (!result) {
                setView('input');
                setDescription('');
                setTechPresetId('');
            }
        }
    }, [open]);

    const handleCalculate = async () => {
        setView('running');
        const success = await calculate(description, techPresetId);
        if (success) {
            setView('result');
        } else {
            setView('input');
        }
    };

    const handleReset = () => {
        setDescription('');
        setTechPresetId('');
        abort();
        reset();
        setView('input');
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    const canCalculate = description.trim().length > 0 && techPresetId !== '';

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
                                    techPresetId={techPresetId}
                                    onPresetChange={setTechPresetId}
                                    presets={presets}
                                    calculating={isRunning}
                                    isDemoMode={isDemoMode}
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
