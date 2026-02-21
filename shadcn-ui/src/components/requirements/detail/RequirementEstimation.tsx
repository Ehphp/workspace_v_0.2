import { TechnologySection } from '@/components/estimation/TechnologySection';
import { ActivitiesSection } from '@/components/estimation/ActivitiesSection';
import { DriversSection } from '@/components/estimation/DriversSection';
import { RisksSection } from '@/components/estimation/RisksSection';
import { CalculationSummary } from '@/components/estimation/CalculationSummary';
import type { UseEstimationStateReturn } from '@/hooks/useEstimationState';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';

interface RequirementEstimationProps {
    estimationState: UseEstimationStateReturn;
    data: {
        presets: TechnologyPreset[];
        activities: Activity[];
        drivers: Driver[];
        risks: Risk[];
    };
    onSave: () => void;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    onAiSuggest: () => void;
    isAiLoading: boolean;
    requirementDescription: string;
}

export function RequirementEstimation({
    estimationState,
    data,
    onSave,
    isSaving,
    hasUnsavedChanges,
    onAiSuggest,
    isAiLoading,
    requirementDescription,
}: RequirementEstimationProps) {
    const {
        selectedPresetId,
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,
        setSelectedPresetId,
        toggleActivity,
        setDriverValue,
        toggleRisk,
        applyPresetDefaults,
        estimationResult,
    } = estimationState;

    const { presets, activities, drivers, risks } = data;

    const handlePresetChange = (presetId: string) => {
        setSelectedPresetId(presetId);
    };

    const handleApplyTemplate = () => {
        if (selectedPresetId) {
            applyPresetDefaults(selectedPresetId);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
                {/* Column 1: Technology + Drivers + Risks (3 cols) */}
                <div className="col-span-3 flex flex-col gap-3 border-r border-slate-100 pr-4 overflow-hidden">
                    {/* Technology Preset */}
                    <div className="shrink-0">
                        <TechnologySection
                            presets={presets}
                            selectedPresetId={selectedPresetId}
                            onPresetChange={handlePresetChange}
                            onApplyTemplate={handleApplyTemplate}
                        />
                    </div>

                    {/* Drivers */}
                    <DriversSection
                        drivers={drivers}
                        selectedDriverValues={selectedDriverValues}
                        onDriverChange={setDriverValue}
                        currentMultiplier={estimationResult?.driverMultiplier || 1.0}
                    />

                    {/* Risks */}
                    <RisksSection
                        risks={risks}
                        selectedRiskIds={selectedRiskIds}
                        onRiskToggle={toggleRisk}
                        currentRiskScore={estimationResult?.riskScore || 0}
                    />
                </div>

                {/* Column 2: Activities (5 cols) */}
                <div className="col-span-5 flex flex-col border-r border-slate-100 pr-4 h-full min-h-0">
                    <ActivitiesSection
                        activities={activities}
                        selectedActivityIds={selectedActivityIds}
                        aiSuggestedIds={aiSuggestedIds}
                        onActivityToggle={toggleActivity}
                        onAiRecalculate={onAiSuggest}
                        isAiLoading={isAiLoading}
                        requirementDescription={requirementDescription}
                    />
                </div>

                {/* Column 3: Summary (4 cols) */}
                <div className="col-span-4 overflow-y-auto">
                    <div className="sticky top-0">
                        <CalculationSummary
                            result={estimationResult}
                            onSave={onSave}
                            isSaving={isSaving}
                            hasUnsavedChanges={hasUnsavedChanges}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
