/**
 * Wizard Step — Requirement Understanding
 *
 * Generates (or loads) the AI understanding artifact,
 * displays it for review, and lets the user confirm or regenerate.
 *
 * Inserted between Technology selection and Technical Interview.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    AlertCircle,
    Loader2,
    Brain,
    CheckCircle2,
    PenLine,
} from 'lucide-react';
import { generateRequirementUnderstanding } from '@/lib/requirement-understanding-api';
import { RequirementUnderstandingCard } from './RequirementUnderstandingCard';
import type { WizardData } from '@/hooks/useWizardState';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';

interface WizardStepUnderstandingProps {
    data: WizardData;
    onUpdate: (updates: Partial<WizardData>) => void;
    onNext: () => void;
    onBack: () => void;
}

type Phase = 'loading' | 'review' | 'error';

export function WizardStepUnderstanding({
    data,
    onUpdate,
    onNext,
    onBack,
}: WizardStepUnderstandingProps) {
    const [phase, setPhase] = useState<Phase>(() =>
        data.requirementUnderstanding ? 'review' : 'loading'
    );
    const [error, setError] = useState<string | null>(null);
    const generatingRef = useRef(false);
    const [originalUnderstanding, setOriginalUnderstanding] = useState<RequirementUnderstanding | null>(
        () => data.requirementUnderstanding ? structuredClone(data.requirementUnderstanding as RequirementUnderstanding) : null
    );

    // Generate on mount if no understanding exists yet
    useEffect(() => {
        if (!data.requirementUnderstanding && !generatingRef.current) {
            generate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generate = useCallback(async () => {
        if (generatingRef.current) return;
        generatingRef.current = true;

        setPhase('loading');
        setError(null);

        try {
            const result = await generateRequirementUnderstanding({
                description: data.description,
                techCategory: data.techCategory || undefined,
                techPresetId: data.technologyId || undefined,
                projectContext: data.projectContext || undefined,
            });

            if (result.success && result.understanding) {
                setOriginalUnderstanding(structuredClone(result.understanding));
                onUpdate({
                    requirementUnderstanding: result.understanding,
                    requirementUnderstandingConfirmed: false,
                });
                setPhase('review');
            } else {
                setError(result.error || 'Generazione fallita. Riprova.');
                setPhase('error');
            }
        } catch (err) {
            console.error('[WizardStepUnderstanding] generation error:', err);
            setError('Si è verificato un errore inatteso durante la generazione.');
            setPhase('error');
        } finally {
            generatingRef.current = false;
        }
    }, [data.description, data.techCategory, data.technologyId, data.projectContext, onUpdate]);

    const handleRegenerate = useCallback(() => {
        setOriginalUnderstanding(null);
        onUpdate({
            requirementUnderstanding: undefined,
            requirementUnderstandingConfirmed: false,
        });
        generate();
    }, [generate, onUpdate]);

    const handleCardUpdate = useCallback((updated: RequirementUnderstanding) => {
        onUpdate({ requirementUnderstanding: updated });
    }, [onUpdate]);

    const handleConfirmAndContinue = useCallback(() => {
        onUpdate({ requirementUnderstandingConfirmed: true });
        onNext();
    }, [onUpdate, onNext]);

    const handleSkip = useCallback(() => {
        // Allow proceeding without confirmed understanding (backward compatibility)
        onNext();
    }, [onNext]);

    // Count user edits for footer indicator
    const editCount = useMemo(() => {
        if (!originalUnderstanding || !data.requirementUnderstanding) return 0;
        const u = data.requirementUnderstanding as RequirementUnderstanding;
        const o = originalUnderstanding;
        let count = 0;
        if (u.businessObjective !== o.businessObjective) count++;
        if (u.expectedOutput !== o.expectedOutput) count++;
        if (JSON.stringify(u.functionalPerimeter) !== JSON.stringify(o.functionalPerimeter)) count++;
        if (JSON.stringify(u.exclusions) !== JSON.stringify(o.exclusions)) count++;
        if (JSON.stringify(u.actors) !== JSON.stringify(o.actors)) count++;
        if (u.stateTransition.initialState !== o.stateTransition.initialState ||
            u.stateTransition.finalState !== o.stateTransition.finalState) count++;
        if (JSON.stringify(u.preconditions) !== JSON.stringify(o.preconditions)) count++;
        if (JSON.stringify(u.assumptions) !== JSON.stringify(o.assumptions)) count++;
        return count;
    }, [data.requirementUnderstanding, originalUnderstanding]);

    // ── LOADING ──
    if (phase === 'loading') {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Brain className="w-7 h-7 text-white animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">
                        Analisi del requisito in corso…
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                        L'AI sta analizzando l'obiettivo, il perimetro, gli attori e la complessità del requisito.
                    </p>
                </div>
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mt-2" />
            </div>
        );
    }

    // ── ERROR ──
    if (phase === 'error') {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                        Errore nell'analisi del requisito
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md">
                        {error || 'Si è verificato un errore. Riprova.'}
                    </p>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Indietro
                    </Button>
                    <Button onClick={generate}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Riprova
                    </Button>
                    <Button variant="ghost" onClick={handleSkip} className="text-slate-500">
                        Salta
                    </Button>
                </div>
            </div>
        );
    }

    // ── REVIEW ──
    const understanding = data.requirementUnderstanding as RequirementUnderstanding;

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                            Comprensione del Requisito
                        </h2>
                        <p className="text-xs text-slate-600">
                            Verifica e modifica l'analisi AI — clicca su qualsiasi testo per correggerlo
                        </p>
                    </div>
                </div>
                {data.requirementUnderstandingConfirmed && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confermato
                    </span>
                )}
            </div>

            {/* Card body */}
            <div className="flex-1 overflow-y-auto pr-1">
                <RequirementUnderstandingCard
                    understanding={understanding}
                    originalUnderstanding={originalUnderstanding || undefined}
                    onUpdate={handleCardUpdate}
                />
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Indietro
                </Button>

                <div className="flex items-center gap-2">
                    {editCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <PenLine className="w-3 h-3" />
                            {editCount} {editCount === 1 ? 'modifica' : 'modifiche'}
                        </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleRegenerate}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Rigenera
                    </Button>
                    <Button size="sm" onClick={handleConfirmAndContinue}>
                        Conferma e continua
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
