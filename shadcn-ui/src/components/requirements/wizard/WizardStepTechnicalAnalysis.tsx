/**
 * Wizard Step — Technical Analysis (merged Impact Map + Blueprint)
 *
 * Sequentially generates both AI artifacts (Impact Map first, then Blueprint),
 * displays them in a unified review, and lets the user confirm both at once.
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
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { generateImpactMap } from '@/lib/impact-map-api';
import { generateEstimationBlueprint } from '@/lib/estimation-blueprint-api';
import { ImpactMapCard } from './ImpactMapCard';
import { EstimationBlueprintCard } from './EstimationBlueprintCard';
import type { WizardData } from '@/hooks/useWizardState';
import type { ImpactMap } from '@/types/impact-map';
import type { EstimationBlueprint } from '@/types/estimation-blueprint';

interface WizardStepTechnicalAnalysisProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

type Phase =
  | 'generating-impact'
  | 'generating-blueprint'
  | 'review'
  | 'error';

export function WizardStepTechnicalAnalysis({
  data,
  onUpdate,
  onNext,
  onBack,
}: WizardStepTechnicalAnalysisProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    data.impactMap && data.estimationBlueprint ? 'review' : 'generating-impact'
  );
  const [error, setError] = useState<string | null>(null);
  const generatingRef = useRef(false);

  // Collapsible sections in review
  const [impactExpanded, setImpactExpanded] = useState(false);
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);

  // Start generation on mount if artifacts are missing
  useEffect(() => {
    if ((!data.impactMap || !data.estimationBlueprint) && !generatingRef.current) {
      generateAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateAll = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setError(null);

    try {
      // ── Step 1: Impact Map ──
      let impactMap = data.impactMap as ImpactMap | undefined;
      if (!impactMap) {
        setPhase('generating-impact');
        const imResult = await generateImpactMap({
          description: data.description,
          techCategory: data.techCategory || undefined,
          techPresetId: data.technologyId || undefined,
          projectContext: data.projectContext || undefined,
          requirementUnderstanding:
            data.requirementUnderstanding && data.requirementUnderstandingConfirmed
              ? data.requirementUnderstanding
              : undefined,
          projectTechnicalBlueprint: data.projectTechnicalBlueprint
            ? (data.projectTechnicalBlueprint as unknown as Record<string, unknown>)
            : undefined,
        });

        if (!imResult.success || !imResult.impactMap) {
          throw new Error(imResult.error || 'Impact Map generation failed.');
        }

        impactMap = imResult.impactMap;
        onUpdate({ impactMap, impactMapConfirmed: false });
      }

      // ── Step 2: Blueprint (depends on Impact Map) ──
      if (!data.estimationBlueprint) {
        setPhase('generating-blueprint');
        const bpResult = await generateEstimationBlueprint({
          description: data.description,
          techCategory: data.techCategory || undefined,
          techPresetId: data.technologyId || undefined,
          projectContext: data.projectContext || undefined,
          requirementUnderstanding:
            data.requirementUnderstanding && data.requirementUnderstandingConfirmed
              ? data.requirementUnderstanding
              : undefined,
          impactMap: impactMap || undefined,
        });

        if (!bpResult.success || !bpResult.blueprint) {
          throw new Error(bpResult.error || 'Blueprint generation failed.');
        }

        onUpdate({ estimationBlueprint: bpResult.blueprint, estimationBlueprintConfirmed: false });
      }

      setPhase('review');
    } catch (err) {
      console.error('[WizardStepTechnicalAnalysis] generation error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setPhase('error');
    } finally {
      generatingRef.current = false;
    }
  }, [
    data.description,
    data.techCategory,
    data.technologyId,
    data.requirementUnderstanding,
    data.requirementUnderstandingConfirmed,
    data.impactMap,
    data.estimationBlueprint,
    data.projectContext,
    data.projectTechnicalBlueprint,
    onUpdate,
  ]);

  const handleRegenerate = useCallback(() => {
    onUpdate({
      impactMap: undefined,
      impactMapConfirmed: false,
      estimationBlueprint: undefined,
      estimationBlueprintConfirmed: false,
    });
    generateAll();
  }, [generateAll, onUpdate]);

  const handleConfirmAndContinue = useCallback(() => {
    onUpdate({ impactMapConfirmed: true, estimationBlueprintConfirmed: true });
    onNext();
  }, [onUpdate, onNext]);

  const handleSkip = useCallback(() => {
    onNext();
  }, [onNext]);

  // ── LOADING ──
  if (phase === 'generating-impact' || phase === 'generating-blueprint') {
    const stepIndex = phase === 'generating-impact' ? 0 : 1;
    const steps = [
      { icon: Map, label: 'Impact Map', description: 'Identifying impacted system layers and components' },
      { icon: Layers, label: 'Blueprint', description: 'Decomposing into components, integrations, and testing scope' },
    ];

    return (
      <div className="flex flex-col h-full items-center justify-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
          {stepIndex === 0
            ? <Map className="w-7 h-7 text-white animate-pulse" />
            : <Layers className="w-7 h-7 text-white animate-pulse" />}
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-slate-900">
            {steps[stepIndex].description}…
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Step {stepIndex + 1} of 2 — generating technical analysis artifacts
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < stepIndex;
            const isCurrent = i === stepIndex;
            return (
              <div key={s.label} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-px ${isDone ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                )}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isDone
                    ? 'bg-emerald-100 text-emerald-700'
                    : isCurrent
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
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
          <h3 className="text-lg font-semibold text-slate-900">Technical Analysis Error</h3>
          <p className="text-sm text-slate-500 max-w-md">
            {error || 'An error occurred. Please try again.'}
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={generateAll}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
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
  const blueprint = data.estimationBlueprint as EstimationBlueprint;
  const bothConfirmed = data.impactMapConfirmed && data.estimationBlueprintConfirmed;

  // Quick summary counts
  const layerCount = impactMap?.impacts?.length ?? 0;
  const componentCount = blueprint?.components?.length ?? 0;
  const integrationCount = blueprint?.integrations?.length ?? 0;
  const testAreaCount = blueprint?.testingScope?.length ?? 0;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Technical Analysis
            </h2>
            <p className="text-xs text-slate-600">
              Impact map & technical blueprint — review the AI analysis
            </p>
          </div>
        </div>
        {bothConfirmed && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        )}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <SummaryBadge icon={Map} label="Layers" count={layerCount} />
        <SummaryBadge icon={Layers} label="Components" count={componentCount} />
        {integrationCount > 0 && <SummaryBadge icon={Layers} label="Integrations" count={integrationCount} />}
        {testAreaCount > 0 && <SummaryBadge icon={Layers} label="Test areas" count={testAreaCount} />}
      </div>

      {/* Collapsible details */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {/* Impact Map section */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setImpactExpanded(!impactExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">Impact Map</span>
              <span className="text-xs text-slate-500">{layerCount} layers</span>
            </div>
            {impactExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {impactExpanded && (
            <div className="px-3 pb-3 border-t border-slate-100">
              <ImpactMapCard impactMap={impactMap} />
            </div>
          )}
        </div>

        {/* Blueprint section */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setBlueprintExpanded(!blueprintExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">Technical Blueprint</span>
              <span className="text-xs text-slate-500">
                {componentCount} components{integrationCount > 0 ? `, ${integrationCount} integrations` : ''}
              </span>
            </div>
            {blueprintExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {blueprintExpanded && (
            <div className="px-3 pb-3 border-t border-slate-100">
              <EstimationBlueprintCard blueprint={blueprint} />
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRegenerate}>
            <RefreshCw className="w-4 h-4 mr-1" /> Regenerate
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

/* ── Helper ── */

function SummaryBadge({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
      <Icon className="w-3.5 h-3.5 text-indigo-500" />
      {count} {label}
    </span>
  );
}
