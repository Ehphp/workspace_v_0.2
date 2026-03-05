/**
 * Interview Loading Component
 *
 * Progressive loading state that mirrors the real server pipeline stages,
 * showing AI "reasoning" thoughts and pipeline progress to make the wait
 * feel shorter and more transparent.
 *
 * Pipeline stages (server-side):
 *   1. Fetch activity catalog from Supabase
 *   2. Rank activities by keyword relevance
 *   3. RAG: search for similar historical requirements
 *   4. Build prompts + LLM call (information-gain planner)
 *   5. Post-processing (decision enforcement, question filtering)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Database,
    Search,
    Brain,
    CheckCircle2,
    Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface InterviewLoadingProps {
    techCategory?: string;
    /** Requirement description — used to extract keywords for thinking bubbles */
    description?: string;
    /** Variant: 'interview' for question generation, 'estimate' for estimation */
    variant?: 'interview' | 'estimate';
}

// ── Pipeline step definitions ──────────────────────────────────────────────

interface PipelineStep {
    id: string;
    icon: typeof Database;
    label: string;
    detail?: string;
    /** Simulated delay (ms) before this step completes */
    durationMs: number;
}

const INTERVIEW_STEPS: PipelineStep[] = [
    {
        id: 'catalog',
        icon: Database,
        label: 'Caricamento catalogo attività',
        detail: 'Recupero attività dal database per lo stack selezionato',
        durationMs: 1800,
    },
    {
        id: 'rag',
        icon: Search,
        label: 'Ricerca requisiti simili nello storico',
        detail: 'Confronto con stime precedenti per maggiore accuratezza',
        durationMs: 2500,
    },
    {
        id: 'llm',
        icon: Brain,
        label: 'Analisi AI del requisito',
        detail: 'Pre-stima, valutazione complessità e generazione domande',
        durationMs: 8000,
    },
    {
        id: 'post',
        icon: Sparkles,
        label: 'Finalizzazione',
        detail: 'Filtro domande ad alto impatto informativo',
        durationMs: 1200,
    },
];

const ESTIMATE_STEPS: PipelineStep[] = [
    {
        id: 'catalog',
        icon: Database,
        label: 'Caricamento catalogo attività',
        detail: 'Recupero attività disponibili per lo stack',
        durationMs: 1800,
    },
    {
        id: 'vector',
        icon: Search,
        label: 'Ricerca attività per similarità semantica',
        detail: 'Matching delle attività più rilevanti al requisito',
        durationMs: 2200,
    },
    {
        id: 'rag',
        icon: Search,
        label: 'Recupero stime storiche simili',
        detail: 'Esempi precedenti per ancorare la stima',
        durationMs: 2000,
    },
    {
        id: 'llm',
        icon: Brain,
        label: 'Generazione stima dettagliata',
        detail: 'Selezione attività, calcolo ore e analisi di coerenza',
        durationMs: 12000,
    },
    {
        id: 'post',
        icon: Sparkles,
        label: 'Verifica e rifinitura',
        detail: 'Controllo totali e ordinamento per priorità',
        durationMs: 1500,
    },
];

// ── AI "thinking" thoughts ─────────────────────────────────────────────────

const INTERVIEW_THOUGHTS = [
    'Valutazione della complessità architetturale...',
    'Identificazione delle aree di incertezza...',
    'Confronto con pattern di requisiti noti...',
    'Analisi delle dipendenze tecniche...',
    'Stima del range di effort iniziale...',
    'Selezione delle domande a maggior valore informativo...',
    'Valutazione dell\'impatto sulle attività di sviluppo...',
    'Verifica della copertura delle aree critiche...',
];

const ESTIMATE_THOUGHTS = [
    'Analisi delle risposte tecniche fornite...',
    'Calcolo dell\'impatto di ogni risposta sulla stima...',
    'Selezione delle attività dal catalogo...',
    'Stima delle ore per ogni attività...',
    'Verifica della coerenza con la pre-stima...',
    'Applicazione dei moltiplicatori di complessità...',
    'Calcolo del confidence score...',
    'Identificazione di driver e rischi suggeriti...',
];

/** Extract short keyword tokens from a description for "thinking" display */
function extractKeywords(description?: string): string[] {
    if (!description || description.length < 20) return [];
    const stopWords = new Set([
        'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'del', 'della',
        'dei', 'degli', 'delle', 'a', 'al', 'alla', 'ai', 'da', 'dal', 'dalla',
        'in', 'nel', 'nella', 'con', 'su', 'per', 'tra', 'fra', 'che', 'non',
        'the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'or', 'is', 'are',
        'e', 'o', 'ma', 'se', 'come', 'anche', 'più', 'questo', 'questa',
        'essere', 'avere', 'fare', 'deve', 'deve', 'dovrebbe', 'può',
    ]);
    return description
        .split(/[\s,.;:!?()[\]{}]+/)
        .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
        .slice(0, 8);
}

// ── Component ──────────────────────────────────────────────────────────────

export function InterviewLoading({
    techCategory,
    description,
    variant = 'interview',
}: InterviewLoadingProps) {
    const steps = variant === 'interview' ? INTERVIEW_STEPS : ESTIMATE_STEPS;
    const thoughts = variant === 'interview' ? INTERVIEW_THOUGHTS : ESTIMATE_THOUGHTS;
    const keywords = useMemo(() => extractKeywords(description), [description]);

    // Track which step index is currently active (0-based, steps.length = all done)
    const [activeStep, setActiveStep] = useState(0);
    // Current "AI thought" text
    const [currentThought, setCurrentThought] = useState(thoughts[0]);
    // Elapsed seconds (for subtle time indicator)
    const [elapsed, setElapsed] = useState(0);

    const thoughtIndexRef = useRef(0);

    // ── Progressive step completion ─────────────────────────────────────
    useEffect(() => {
        let cumulative = 0;
        const timers: ReturnType<typeof setTimeout>[] = [];

        steps.forEach((step, idx) => {
            cumulative += step.durationMs;
            timers.push(
                setTimeout(() => {
                    setActiveStep(idx + 1);
                }, cumulative),
            );
        });

        return () => timers.forEach(clearTimeout);
    }, [steps]);

    // ── Rotating thoughts ───────────────────────────────────────────────
    useEffect(() => {
        const allThoughts = [...thoughts];
        // Interleave keyword-based thoughts
        if (keywords.length > 0) {
            keywords.forEach((kw, i) => {
                allThoughts.splice(
                    Math.min(i * 2 + 1, allThoughts.length),
                    0,
                    `Analisi: "${kw}"...`,
                );
            });
        }

        const interval = setInterval(() => {
            thoughtIndexRef.current = (thoughtIndexRef.current + 1) % allThoughts.length;
            setCurrentThought(allThoughts[thoughtIndexRef.current]);
        }, 2400);

        return () => clearInterval(interval);
    }, [thoughts, keywords]);

    // ── Elapsed timer ───────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const title = variant === 'interview'
        ? 'Preparazione Interview Tecnica'
        : 'Generazione Stima Dettagliata';

    return (
        <div className="flex flex-col items-center justify-center py-10 space-y-7 max-w-md mx-auto">
            {/* ── Header icon ─────────────────────────────────────── */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative"
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Brain className="w-8 h-8 text-white" />
                </div>
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-indigo-400/50"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </motion.div>

            {/* ── Title ────────────────────────────────────────────── */}
            <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                {techCategory && (
                    <p className="text-sm text-slate-500">
                        Stack: <span className="font-medium text-indigo-600">{techCategory}</span>
                    </p>
                )}
            </div>

            {/* ── Pipeline steps ───────────────────────────────────── */}
            <div className="w-full space-y-2">
                {steps.map((step, idx) => {
                    const isDone = activeStep > idx;
                    const isActive = activeStep === idx;
                    const StepIcon = step.icon;

                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.15 }}
                            className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-300 ${isActive
                                    ? 'bg-indigo-50 border border-indigo-200'
                                    : isDone
                                        ? 'bg-emerald-50/60 border border-emerald-200/60'
                                        : 'bg-slate-50 border border-slate-100'
                                }`}
                        >
                            {/* Status icon */}
                            <div className="mt-0.5 flex-shrink-0">
                                {isDone ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400 }}
                                    >
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    </motion.div>
                                ) : isActive ? (
                                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                ) : (
                                    <StepIcon className="w-5 h-5 text-slate-300" />
                                )}
                            </div>

                            {/* Text */}
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${isDone
                                        ? 'text-emerald-700'
                                        : isActive
                                            ? 'text-indigo-700'
                                            : 'text-slate-400'
                                    }`}>
                                    {step.label}
                                </p>
                                {(isActive || isDone) && step.detail && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className={`text-xs mt-0.5 ${isDone ? 'text-emerald-500' : 'text-indigo-400'
                                            }`}
                                    >
                                        {step.detail}
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── AI Thinking bubble ──────────────────────────────── */}
            <div className="w-full rounded-lg bg-slate-900 px-4 py-3 shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        AI Reasoning
                    </span>
                    <span className="ml-auto text-xs text-slate-500 font-mono tabular-nums">
                        {elapsed}s
                    </span>
                </div>
                <AnimatePresence mode="wait">
                    <motion.p
                        key={currentThought}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm text-slate-300 font-mono leading-relaxed"
                    >
                        <span className="text-indigo-400">{'> '}</span>
                        {currentThought}
                        <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="text-indigo-400"
                        >
                            _
                        </motion.span>
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* ── Subtle tip ──────────────────────────────────────── */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="text-xs text-slate-400 text-center max-w-sm"
            >
                {variant === 'interview'
                    ? 'Le domande saranno specifiche per il tuo requisito e lo stack tecnologico selezionato.'
                    : 'La stima include selezione attività, calcolo ore e analisi di coerenza.'}
            </motion.p>
        </div>
    );
}
