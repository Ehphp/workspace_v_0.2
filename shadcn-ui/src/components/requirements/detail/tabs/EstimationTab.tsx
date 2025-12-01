import { Card, CardContent } from '@/components/ui/card';
import { RequirementEstimation } from '../RequirementEstimation';
import { RequirementDriversCard } from '../RequirementDriversCard';
import { Calculator, History } from 'lucide-react';
import type { Requirement, Activity, Driver, Risk, TechnologyPreset, RequirementDriverValue } from '@/types/database';
import type { UseEstimationStateReturn } from '@/hooks/useEstimationState';

interface EstimationTabProps {
    requirement: Requirement;
    estimationState: UseEstimationStateReturn;
    data: {
        presets: TechnologyPreset[];
        activities: Activity[];
        drivers: Driver[];
        risks: Risk[];
    };
    drivers: Driver[];
    driverValues?: RequirementDriverValue[];
    onSave: () => void;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    onAiSuggest: () => void;
    isAiLoading: boolean;
    requirementDescription: string;
    refetchRequirement: () => Promise<void>;
    setDriverValues: (map: Record<string, string>) => void;
    estimationHistory: any[];
}

export function EstimationTab({
    requirement,
    estimationState,
    data,
    drivers,
    driverValues,
    onSave,
    isSaving,
    hasUnsavedChanges,
    onAiSuggest,
    isAiLoading,
    requirementDescription,
    refetchRequirement,
    setDriverValues,
    estimationHistory
}: EstimationTabProps) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Main Workspace - Full height */}
            <div className="flex-1 min-h-0">
                <div className="container mx-auto px-6 py-3 h-full">
                    <div className="grid grid-cols-12 gap-4 h-full">
                        {/* Left: Drivers (35%) */}
                        <div className="col-span-4 overflow-y-auto">
                            <RequirementDriversCard
                                requirementId={requirement.id}
                                drivers={drivers}
                                driverValues={driverValues || []}
                                onSaved={refetchRequirement}
                                onApplyToEstimate={(map) => setDriverValues(map)}
                            />
                        </div>

                        {/* Right: Estimation Editor (65%) */}
                        <div className="col-span-8 overflow-y-auto">
                            <RequirementEstimation
                                estimationState={estimationState}
                                data={data}
                                onSave={onSave}
                                isSaving={isSaving}
                                hasUnsavedChanges={hasUnsavedChanges}
                                onAiSuggest={onAiSuggest}
                                isAiLoading={isAiLoading}
                                requirementDescription={requirementDescription}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
