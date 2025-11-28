import React, { useEffect, useState } from 'react';
import { useWizardState } from '@/hooks/useWizardState';
import { WizardStep1 } from '@/components/wizard/WizardStep1';
import { WizardStep2 } from '@/components/wizard/WizardStep2';
import { WizardStep3 } from '@/components/wizard/WizardStep3';
import { WizardStep4 } from '@/components/wizard/WizardStep4';
import { WizardStep5 } from '@/components/wizard/WizardStep5';
import { createRequirement, saveEstimation } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstimationResult } from '@/types/estimation';

interface RequirementWizardProps {
    listId: string;
    onSuccess: () => void;
    onCancel: () => void;
    isOpen?: boolean;
}

export function RequirementWizard({ listId, onSuccess, onCancel, isOpen }: RequirementWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const { data, updateData, resetData } = useWizardState();
    const { user } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const steps = [
        { title: 'Requirement', component: WizardStep1 },
        { title: 'Technology', component: WizardStep2 },
        { title: 'Activities', component: WizardStep3 },
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

    const handleSave = async (estimationResult: EstimationResult) => {
        if (!user) return;
        setSaving(true);

        try {
            // 1. Create Requirement
            const requirement = await createRequirement({
                listId,
                title: data.title || 'Untitled Requirement',
                description: data.description,
                priority: data.priority,
                state: data.state,
                business_owner: data.business_owner,
                tech_preset_id: data.techPresetId || null,
            });

            // 2. Save Estimation
            await saveEstimation({
                requirementId: requirement.id,
                userId: user.id,
                totalDays: estimationResult.totalDays,
                baseDays: estimationResult.baseDays,
                driverMultiplier: estimationResult.driverMultiplier,
                riskScore: estimationResult.riskScore,
                contingencyPercent: estimationResult.contingencyPercent,
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
                <Loader2 className="h-11 w-11 animate-spin text-blue-600" />
                <p className="text-sm text-slate-700 font-medium">Saving requirement and estimation...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-white/90 shadow-sm">
                <div className="flex items-center gap-2 min-w-[190px]">
                    <span className="px-2 py-1 rounded-md bg-blue-50 text-[11px] font-semibold text-blue-700">
                        Step {currentStep + 1} / {steps.length}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{steps[currentStep].title}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        {steps.map((step, index) => (
                            <div
                                key={step.title}
                                className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${index <= currentStep
                                    ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-100'
                                    : 'bg-white border-slate-300'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-slate-600 hover:text-slate-900"
                >
                    Close
                </Button>
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
