import { RequirementEstimation } from '../RequirementEstimation';
import type { Requirement, Activity, Driver, Risk, Technology } from '@/types/database';
import type { UseEstimationStateReturn } from '@/hooks/useEstimationState';

interface EstimationTabProps {
    requirement: Requirement;
    estimationState: UseEstimationStateReturn;
    data: {
        presets: Technology[];
        activities: Activity[];
        drivers: Driver[];
        risks: Risk[];
    };
    onSave: () => void;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    /** @deprecated STEP 4 — Legacy AI suggest removed */
    onAiSuggest?: () => void;
    isAiLoading?: boolean;
    requirementDescription: string;
}

export function EstimationTab({
    estimationState,
    data,
    onSave,
    isSaving,
    hasUnsavedChanges,
    onAiSuggest,
    isAiLoading = false,
    requirementDescription,
}: EstimationTabProps) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Main Workspace - Full height */}
            <div className="flex-1 min-h-0">
                <div className="container mx-auto px-6 py-5 h-full">
                    <div className="h-full overflow-y-auto space-y-6">
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
    );
}
