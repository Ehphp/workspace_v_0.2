import React, { useEffect, useState } from 'react';
import { useWizardState } from '@/hooks/useWizardState';
import { WizardStep1 } from './wizard/WizardStep1';
import { WizardStepUnderstanding } from './wizard/WizardStepUnderstanding';
import { WizardStepImpactMap } from './wizard/WizardStepImpactMap';
import { WizardStepBlueprint } from './wizard/WizardStepBlueprint';
import { WizardStepInterview } from './wizard/WizardStepInterview';
import { WizardStep4 } from './wizard/WizardStep4';
import { WizardStep5 } from './wizard/WizardStep5';
import { createRequirement, saveEstimation, saveRequirementUnderstanding, saveImpactMap, saveEstimationBlueprint, fetchEstimationMasterData, fetchTechnology } from '@/lib/api';
import { getLatestProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import {
    orchestrateWizardDomainSave,
    finalizeWizardSnapshot,
    resolveWizardActivities,
    resolveWizardDrivers,
    resolveWizardRisks,
} from '@/lib/domain-save';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstimationResult } from '@/types/estimation';

/** Project context for AI to avoid redundant questions */
export interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
    defaultTechPresetId?: string;
    projectType?: string;
    domain?: string;
    scope?: string;
    teamSize?: number;
    deadlinePressure?: string;
    methodology?: string;
}

interface RequirementWizardProps {
    projectId: string;
    projectContext?: ProjectContext;
    onSuccess: () => void;
    onCancel: () => void;
    isOpen?: boolean;
}

export function RequirementWizard({ projectId, projectContext, onSuccess, onCancel, isOpen }: RequirementWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const { data, updateData, resetData } = useWizardState();
    const { user } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    // Store project context in wizard state on first render
    useEffect(() => {
        if (projectContext && !data.projectContext) {
            updateData({ projectContext });
        }
    }, [projectContext, data.projectContext, updateData]);

    // Inherit technology from project — resolve code from id
    useEffect(() => {
        const techId = projectContext?.defaultTechPresetId;
        if (techId && !data.techPresetId) {
            fetchTechnology(techId).then((tech) => {
                if (tech) {
                    updateData({ techPresetId: tech.id, techCategory: tech.code || '' });
                }
            }).catch((err) => console.warn('Failed to resolve project technology:', err));
        }
    }, [projectContext?.defaultTechPresetId, data.techPresetId, updateData]);

    // Load project technical blueprint (if available) for architectural context
    useEffect(() => {
        if (projectId && !data.projectTechnicalBlueprint) {
            getLatestProjectTechnicalBlueprint(projectId).then((blueprint) => {
                if (blueprint) {
                    updateData({ projectTechnicalBlueprint: blueprint });
                }
            }).catch((err) => console.warn('Failed to load project technical blueprint:', err));
        }
    }, [projectId, data.projectTechnicalBlueprint, updateData]);

    const steps = [
        { title: 'Requirement', component: WizardStep1 },
        { title: 'Understanding', component: WizardStepUnderstanding },
        { title: 'Impact Map', component: WizardStepImpactMap },
        { title: 'Blueprint', component: WizardStepBlueprint },
        { title: 'Technical Interview', component: WizardStepInterview },
        { title: 'Drivers & Risks', component: WizardStep4 },
        { title: 'Results', component: WizardStep5 },
    ];
    const progress = ((currentStep + 1) / steps.length) * 100;

    // Clear persisted wizard data when the dialog closes
    useEffect(() => {
        if (isOpen === false) {
            resetData();
            setCurrentStep(0);
        }
    }, [isOpen, resetData]);

    // Cleanup on unmount to avoid stale data on next open
    useEffect(() => {
        return () => resetData();
    }, [resetData]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSave = async (_estimationResult: EstimationResult) => {
        if (!user) return;
        setSaving(true);

        try {
            // Determine title with fallback logic:
            // 1. Try title from interview estimate (new AI flow)
            // 2. Try generatedTitle from normalizationResult (first GPT call - legacy)
            // 3. If not available, try generatedTitle from activitySuggestionResult (legacy)
            // 4. If still not available, use fallback "Requisito senza titolo"
            let finalTitle = 'Untitled requirement';

            if (data.title) {
                finalTitle = data.title;
                console.log('Using title from interview estimate:', finalTitle);
            } else if (data.normalizationResult?.generatedTitle) {
                finalTitle = data.normalizationResult.generatedTitle;
                console.log('Using title from normalization:', finalTitle);
            } else if (data.activitySuggestionResult?.generatedTitle) {
                finalTitle = data.activitySuggestionResult.generatedTitle;
                console.log('Using title from activity suggestion (fallback):', finalTitle);
            } else {
                console.warn('No title generated by AI, using default fallback:', finalTitle);
            }

            // 1. Create Requirement
            const requirement = await createRequirement({
                projectId,
                title: finalTitle,
                description: data.description,
                priority: data.priority,
                state: data.state,
                business_owner: data.business_owner,
                tech_preset_id: data.techPresetId || null,
                technology_id: data.techPresetId || null,
            });

            // 2. Persist Requirement Understanding (if confirmed)
            if (data.requirementUnderstanding && data.requirementUnderstandingConfirmed) {
                try {
                    await saveRequirementUnderstanding({
                        requirementId: requirement.id,
                        understanding: data.requirementUnderstanding as Record<string, unknown>,
                        inputDescription: data.description,
                        inputTechCategory: data.techCategory || undefined,
                    });
                } catch (err) {
                    // Non-blocking: log but don't fail the whole save
                    console.error('Failed to persist requirement understanding:', err);
                }
            }

            // 2b. Persist Impact Map (if confirmed)
            if (data.impactMap && data.impactMapConfirmed) {
                try {
                    await saveImpactMap({
                        requirementId: requirement.id,
                        impactMap: data.impactMap as Record<string, unknown>,
                        inputDescription: data.description,
                        inputTechCategory: data.techCategory || undefined,
                        hasRequirementUnderstanding: !!data.requirementUnderstandingConfirmed,
                    });
                } catch (err) {
                    // Non-blocking: log but don't fail the whole save
                    console.error('Failed to persist impact map:', err);
                }
            }

            // 2c. Persist Estimation Blueprint (if confirmed)
            let savedBlueprintId: string | undefined;
            if (data.estimationBlueprint && data.estimationBlueprintConfirmed) {
                try {
                    const savedBlueprint = await saveEstimationBlueprint({
                        requirementId: requirement.id,
                        blueprint: data.estimationBlueprint as Record<string, unknown>,
                        inputDescription: data.description,
                        inputTechCategory: data.techCategory || undefined,
                        confidenceScore: data.estimationBlueprint.overallConfidence,
                    });
                    savedBlueprintId = savedBlueprint.id;
                } catch (err) {
                    // Non-blocking: log but don't fail the whole save
                    console.error('Failed to persist estimation blueprint:', err);
                }
            }

            // 2d. Domain orchestration — build traceability chain
            const masterData = await fetchEstimationMasterData();
            const resolvedActivities = resolveWizardActivities(
                data.selectedActivityCodes,
                data.aiSuggestedActivityCodes,
                masterData.activities,
            );
            const resolvedDrivers = resolveWizardDrivers(
                data.selectedDriverValues,
                masterData.drivers,
            );
            const resolvedRisks = resolveWizardRisks(
                data.selectedRiskCodes,
                masterData.risks,
            );

            const domainResult = await orchestrateWizardDomainSave({
                requirementId: requirement.id,
                userId: user.id,
                description: data.description,
                techCategory: data.techCategory || null,
                technologyId: data.techPresetId || null,
                blueprintId: savedBlueprintId || null,
                understanding: data.requirementUnderstanding
                    ? (data.requirementUnderstanding as Record<string, unknown>)
                    : null,
                impactMapData: data.impactMap
                    ? (data.impactMap as Record<string, unknown>)
                    : null,
                activities: resolvedActivities,
                drivers: resolvedDrivers,
                risks: resolvedRisks,
                // Pass enriched candidates from CandidateBuilder (with provenance)
                // so that candidate_sets persists full score/sources/contributions.
                enrichedCandidates: data.candidateProvenance
                    ? data.candidateProvenance.map(cp => ({
                        activity_id: resolvedActivities.find(a => a.code === cp.code)?.activity_id || '',
                        activity_code: cp.code,
                        source: (cp.primarySource === 'keyword-fallback' ? 'ai'
                            : cp.primarySource === 'impact-map' || cp.primarySource === 'impact-map-exclusive' ? 'rule'
                                : cp.primarySource.startsWith('blueprint') || cp.primarySource === 'multi-crosscutting' ? 'blueprint'
                                    : 'ai') as 'blueprint' | 'ai' | 'rule' | 'manual',
                        score: Math.round(cp.score * 10),
                        confidence: cp.confidence,
                        reason: JSON.stringify({
                            sources: cp.sources,
                            contributions: cp.contributions,
                            provenance: cp.provenance,
                            primarySource: cp.primarySource,
                        }),
                    }))
                    : undefined,
            });

            // 3. Save Estimation — domain engine is the canonical source
            const estimationId = await saveEstimation({
                requirementId: requirement.id,
                userId: user.id,
                totalDays: domainResult.estimation.totalDays,
                baseDays: domainResult.estimation.baseDays,
                driverMultiplier: domainResult.estimation.driverMultiplier,
                riskScore: domainResult.estimation.riskScore,
                contingencyPercent: domainResult.estimation.contingencyPercent,
                aiReasoning: data.aiAnalysis,
                blueprintId: savedBlueprintId,
                analysisId: domainResult.analysisId,
                decisionId: domainResult.decisionId,
                activities: data.selectedActivityCodes.map(code => ({
                    code,
                    isAiSuggested: data.aiSuggestedActivityCodes.includes(code)
                })),
                drivers: Object.entries(data.selectedDriverValues).map(([code, value]) => ({
                    code,
                    value
                })),
                risks: data.selectedRiskCodes.map(code => ({ code }))
            });

            // 4. Finalize snapshot (non-blocking — estimation is already saved)
            try {
                await finalizeWizardSnapshot({
                    estimationId,
                    userId: user.id,
                    analysisId: domainResult.analysisId,
                    decisionId: domainResult.decisionId,
                    blueprintId: savedBlueprintId || null,
                    activities: resolvedActivities,
                    drivers: resolvedDrivers,
                    risks: resolvedRisks,
                    estimation: domainResult.estimation,
                });
            } catch (err) {
                console.error('Failed to create estimation snapshot (non-blocking):', err);
            }

            toast({
                title: 'Success',
                description: `Requirement ${requirement.req_id} created with estimation`,
            });

            resetData();
            onSuccess();
        } catch (error) {
            console.error('Error saving requirement:', error);
            toast({
                title: 'Error',
                description: 'Failed to save requirement and estimation',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const CurrentStepComponent = steps[currentStep].component;

    const handleCancel = () => {
        resetData();
        setCurrentStep(0);
        onCancel();
    };

    if (saving) {
        return (
            <div className="h-[600px] flex flex-col items-center justify-center space-y-3 rounded-xl border border-slate-200 bg-white/80">
                <Loader2 className="h-11 w-11 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-700 font-medium">Saving requirement and estimation...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-white/90 shadow-sm">
                <div className="flex items-center gap-2 min-w-[190px]">
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-xs font-semibold text-indigo-700">
                        Step {currentStep + 1} / {steps.length}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{steps[currentStep].title}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-600 to-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        {steps.map((step, index) => (
                            <div
                                key={step.title}
                                className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${index <= currentStep
                                    ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-100'
                                    : 'bg-white border-slate-300'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full rounded-xl border border-slate-200 bg-white/90 shadow-sm">
                    <div className="h-full overflow-hidden px-3 py-2">
                        <CurrentStepComponent
                            data={data}
                            onUpdate={updateData}
                            onNext={handleNext}
                            onBack={handleBack}
                            onReset={resetData}
                            onSave={handleSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
