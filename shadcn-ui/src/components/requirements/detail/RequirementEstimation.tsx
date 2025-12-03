import { useState } from 'react';
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
    const [leftColumnExpanded, setLeftColumnExpanded] = useState<string | null>('technology');

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
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_320px] gap-3">
                {/* Column 1: Tech / Drivers / Risks */}
                <div className="overflow-hidden">
                    <div className="h-full overflow-y-auto space-y-3">
                        <TechnologySection
                            presets={presets}
                            selectedPresetId={selectedPresetId}
                            onPresetChange={handlePresetChange}
                            onApplyTemplate={handleApplyTemplate}
                            onAiRecalculate={onAiSuggest}
                            isAiLoading={isAiLoading}
                            requirementDescription={requirementDescription}
                            isExpanded={leftColumnExpanded === 'technology'}
                            onToggle={() => setLeftColumnExpanded(leftColumnExpanded === 'technology' ? null : 'technology')}
                        />

                        <DriversSection
                            drivers={drivers}
                            selectedDriverValues={selectedDriverValues}
                            onDriverChange={setDriverValue}
                            currentMultiplier={estimationResult?.driverMultiplier || 1.0}
                            isExpanded={leftColumnExpanded === 'drivers'}
                            onToggle={() => setLeftColumnExpanded(leftColumnExpanded === 'drivers' ? null : 'drivers')}
                        />

                        <RisksSection
                            risks={risks}
                            selectedRiskIds={selectedRiskIds}
                            onRiskToggle={toggleRisk}
                            currentRiskScore={estimationResult?.riskScore || 0}
                            isExpanded={leftColumnExpanded === 'risks'}
                            onToggle={() => setLeftColumnExpanded(leftColumnExpanded === 'risks' ? null : 'risks')}
                        />
                    </div>
                </div>

                {/* Column 2: Activities */}
                <div className="overflow-hidden">
                    <div className="h-full overflow-y-auto">
                        <ActivitiesSection
                            activities={activities}
                            selectedActivityIds={selectedActivityIds}
                            aiSuggestedIds={aiSuggestedIds}
                            onActivityToggle={toggleActivity}
                            isExpanded
                            onToggle={() => {}}
                        />
                    </div>
                </div>

                {/* Column 3: Summary */}
                <div className="overflow-hidden">
                    <div className="h-full overflow-y-auto">
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
        </div>
    );
}
