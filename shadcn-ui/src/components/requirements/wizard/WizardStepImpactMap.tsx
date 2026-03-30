/**
 * Wizard Step — Impact Map
 *
 * Generates (or loads) the AI impact map artifact,
 * displays it for review, and lets the user confirm or regenerate.
 *
 * Inserted between Understanding and Technical Interview.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    AlertCircle,
    Loader2,
    Map,
    CheckCircle2,
} from 'lucide-react';
import { generateImpactMap } from '@/lib/impact-map-api';
import { ImpactMapCard } from './ImpactMapCard';
import type { WizardData } from '@/hooks/useWizardState';
import type { ImpactMap } from '@/types/impact-map';

interface WizardStepImpactMapProps {
    data: WizardData;
    onUpdate: (updates: Partial<WizardData>) => void;
    onNext: () => void;
    onBack: () => void;
}

type Phase = 'loading' | 'review' | 'error';

export function WizardStepImpactMap({
    data,
    onUpdate,
    onNext,
    onBack,
}: WizardStepImpactMapProps) {
    const [phase, setPhase] = useState<Phase>(() =>
        data.impactMap ? 'review' : 'loading'
    );
    const [error, setError] = useState<string | null>(null);
    const generatingRef = useRef(false);

    // Generate on mount if no impact map exists yet
    useEffect(() => {
        if (!data.impactMap && !generatingRef.current) {
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
            const result = await generateImpactMap({
                description: data.description,
                techCategory: data.techCategory || undefined,
                techPresetId: data.techPresetId || undefined,
                requirementUnderstanding:
                    data.requirementUnderstanding && data.requirementUnderstandingConfirmed
                        ? data.requirementUnderstanding
                        : undefined,
                projectTechnicalBlueprint: data.projectTechnicalBlueprint
                    ? (data.projectTechnicalBlueprint as unknown as Record<string, unknown>)
                    : undefined,
            });

            if (result.success && result.impactMap) {
                onUpdate({
                    impactMap: result.impactMap,
                    impactMapConfirmed: false,
                });
                setPhase('review');
            } else {
                setError(result.error || 'Generation failed. Please try again.');
                setPhase('error');
            }
        } catch (err) {
            console.error('[WizardStepImpactMap] generation error:', err);
            setError('An unexpected error occurred during generation.');
            setPhase('error');
        } finally {
            generatingRef.current = false;
        }
    }, [data.description, data.techCategory, data.techPresetId, data.requirementUnderstanding, data.requirementUnderstandingConfirmed, onUpdate]);

    const handleRegenerate = useCallback(() => {
        onUpdate({
            impactMap: undefined,
            impactMapConfirmed: false,
        });
        generate();
    }, [generate, onUpdate]);

    const handleConfirmAndContinue = useCallback(() => {
        onUpdate({ impactMapConfirmed: true });
        onNext();
    }, [onUpdate, onNext]);

    const handleSkip = useCallback(() => {
        // Allow proceeding without confirmed impact map (backward compatibility)
        onNext();
    }, [onNext]);

    // ── LOADING ──
    if (phase === 'loading') {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Map className="w-7 h-7 text-white animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">
                        Analyzing architectural impact…
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                        AI is identifying the system layers and components affected by this requirement.
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
                        Impact Map Error
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md">
                        {error || 'An error occurred. Please try again.'}
                    </p>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <Button onClick={generate}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                    <Button variant="ghost" onClick={handleSkip} className="text-slate-500">
                        Skip
                    </Button>
                </div>
            </div>
        );
    }

    // ── REVIEW ──
    const impactMap = data.impactMap as ImpactMap;

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <Map className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                            Impact Map
                        </h2>
                        <p className="text-xs text-slate-600">
                            Review the architectural layers and impacted components
                        </p>
                    </div>
                </div>
                {data.impactMapConfirmed && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                    </span>
                )}
            </div>

            {/* Card body */}
            <div className="flex-1 overflow-y-auto pr-1">
                <ImpactMapCard impactMap={impactMap} />
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                </Button>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleRegenerate}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Regenerate
                    </Button>
                    <Button size="sm" onClick={handleConfirmAndContinue}>
                        Confirm & continue
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
