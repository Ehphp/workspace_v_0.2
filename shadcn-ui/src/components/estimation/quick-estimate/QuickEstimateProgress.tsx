import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Brain, Layers, Puzzle, HelpCircle, AlertTriangle } from 'lucide-react';
import type { PipelineStep, PipelineInsight } from '@/hooks/useQuickEstimationV2';
import { STEP_LABELS } from '@/hooks/useQuickEstimationV2';

// ─── Typewriter hook ────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        setDisplayed('');
        setDone(false);
        if (!text) return;
        let i = 0;
        const id = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(id);
                setDone(true);
            }
        }, speed);
        return () => clearInterval(id);
    }, [text, speed]);

    return { displayed, done };
}

// ─── Typewriter message bubble ──────────────────────────────────────────────

function TypewriterBubble({ text, success }: { text: string; success: boolean }) {
    const { displayed, done } = useTypewriter(text, 14);
    return (
        <span className={success ? 'text-slate-700' : 'text-amber-700'}>
            {displayed}
            {!done && (
                <span className="inline-block w-[2px] h-[14px] ml-0.5 align-middle bg-indigo-500 animate-pulse" />
            )}
        </span>
    );
}

// ─── Icon mapping ───────────────────────────────────────────────────────────

const INSIGHT_ICONS = {
    understanding: Brain,
    impact: Layers,
    blueprint: Puzzle,
    planner: HelpCircle,
} as const;

// ─── Shimmer skeleton for "thinking" state ──────────────────────────────────

function ThinkingSkeleton({ label }: { label: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-3"
        >
            {/* AI avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            {/* Shimmer bubble */}
            <div className="flex-1 space-y-2 pt-1">
                <p className="text-xs font-medium text-indigo-600">{label}</p>
                <div className="space-y-1.5">
                    <div className="h-3 w-4/5 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
                    <div className="h-3 w-3/5 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite_0.2s]" />
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface QuickEstimateProgressProps {
    currentStep: PipelineStep;
    stepLabel: string;
    liveInsights?: PipelineInsight[];
}

export function QuickEstimateProgress({ currentStep, stepLabel, liveInsights = [] }: QuickEstimateProgressProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new insights arrive
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [liveInsights.length, currentStep]);

    return (
        <div className="flex flex-col h-full max-h-[400px]">
            {/* Feed */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1 py-4 scroll-smooth">
                {/* Completed insights — rendered as chat bubbles */}
                <AnimatePresence initial={false}>
                    {liveInsights.map((insight, i) => {
                        const Icon = INSIGHT_ICONS[insight.icon];
                        const isLast = i === liveInsights.length - 1;

                        return (
                            <motion.div
                                key={`${insight.step}-${i}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="flex items-start gap-3"
                            >
                                {/* AI avatar */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${insight.success
                                        ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-indigo-500/20'
                                        : 'bg-amber-100 shadow-amber-200/40'
                                    }`}>
                                    {insight.success
                                        ? <Bot className="w-3.5 h-3.5 text-white" />
                                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    }
                                </div>

                                {/* Message bubble */}
                                <div className={`flex-1 rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed ${insight.success
                                        ? 'bg-slate-50/80 ring-1 ring-slate-100'
                                        : 'bg-amber-50/80 ring-1 ring-amber-100'
                                    }`}>
                                    {/* Step icon + label */}
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon className={`w-3 h-3 ${insight.success ? 'text-indigo-500' : 'text-amber-500'}`} />
                                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${insight.success ? 'text-indigo-500/70' : 'text-amber-500/70'
                                            }`}>
                                            {insight.label}
                                        </span>
                                    </div>

                                    {/* Body — typewriter on last message, static on older */}
                                    {isLast ? (
                                        <TypewriterBubble text={insight.detail} success={insight.success} />
                                    ) : (
                                        <span className={insight.success ? 'text-slate-700' : 'text-amber-700'}>
                                            {insight.detail}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Active thinking skeleton — shown while waiting for next step */}
                <AnimatePresence mode="wait">
                    {currentStep !== 'idle' && currentStep !== 'done' && currentStep !== 'error' && (
                        <ThinkingSkeleton key={currentStep} label={stepLabel} />
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom bar — minimal progress indicator */}
            <div className="flex items-center justify-center gap-3 pt-3 pb-1 border-t border-slate-100/60">
                <div className="flex items-center gap-1">
                    {['loading-data', 'understanding', 'impact-map', 'blueprint', 'interview-planner', 'estimation', 'finalizing'].map((step) => {
                        const ordered = ['loading-data', 'understanding', 'impact-map', 'blueprint', 'interview-planner', 'estimation', 'finalizing'];
                        const ci = ordered.indexOf(currentStep);
                        const si = ordered.indexOf(step);
                        const isDone = si < ci || currentStep === 'done';
                        const isCurrent = si === ci;
                        return (
                            <div
                                key={step}
                                className={`h-1 w-6 rounded-full transition-all duration-500 ${isDone
                                        ? 'bg-emerald-400'
                                        : isCurrent
                                            ? 'bg-indigo-400 animate-pulse'
                                            : 'bg-slate-200'
                                    }`}
                            />
                        );
                    })}
                </div>
                <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                    {stepLabel}
                </span>
            </div>
        </div>
    );
}
