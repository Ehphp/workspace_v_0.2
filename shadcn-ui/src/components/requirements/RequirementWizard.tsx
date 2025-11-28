import { useState } from 'react';
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

interface RequirementWizardProps {
    listId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function RequirementWizard({ listId, onSuccess, onCancel }: RequirementWizardProps) {
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

    const handleSave = async (estimationResult: any) => {
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

    if (saving) {
        return (
            <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-slate-600 font-medium">Saving requirement and estimation...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Progress Steps - Compact */}
            <div className="mb-4 flex-shrink-0">
                <div className="flex items-center justify-between px-2 relative">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-col items-center relative z-10">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${index <= currentStep
                                    ? 'bg-blue-600 text-white shadow-md scale-110'
                                    : 'bg-slate-100 text-slate-400'
                                    }`}
                            >
                                {index + 1}
                            </div>
                            <span className={`text-[9px] mt-1 font-medium ${index <= currentStep ? 'text-blue-700' : 'text-slate-400'
                                }`}>
                                {step.title}
                            </span>
                        </div>
                    ))}
                    {/* Progress Bar Background */}
                    <div className="absolute top-3 left-0 w-full h-0.5 bg-slate-100 -z-0" />
                    {/* Active Progress Bar */}
                    <div
                        className="absolute top-3 left-0 h-0.5 bg-blue-600 transition-all duration-300 -z-0"
                        style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                    />
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto px-1">
                <CurrentStepComponent
                    data={data}
                    onUpdate={updateData}
                    onNext={handleNext}
                    onBack={handleBack}
                    onReset={resetData}
                    // @ts-ignore - onSave is only for Step 5
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}
