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
    const [expandedSection, setExpandedSection] = useState<string | null>('technology');

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
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_320px] gap-3">
                {/* Left Column - Configuration */}
                <div className="space-y-2 overflow-y-auto">
                    <TechnologySection
                        presets={presets}
                        selectedPresetId={selectedPresetId}
                        onPresetChange={handlePresetChange}
                        onApplyTemplate={handleApplyTemplate}
                        onAiRecalculate={onAiSuggest}
                        isAiLoading={isAiLoading}
                        requirementDescription={requirementDescription}
                        isExpanded={expandedSection === 'technology'}
                        onToggle={() => setExpandedSection(expandedSection === 'technology' ? null : 'technology')}
                    />

                    <ActivitiesSection
                        activities={activities}
                        selectedActivityIds={selectedActivityIds}
                        aiSuggestedIds={aiSuggestedIds}
                        onActivityToggle={toggleActivity}
                        isExpanded={expandedSection === 'activities'}
                        onToggle={() => setExpandedSection(expandedSection === 'activities' ? null : 'activities')}
                    />

                    <DriversSection
                        drivers={drivers}
                        selectedDriverValues={selectedDriverValues}
                        onDriverChange={setDriverValue}
                        currentMultiplier={estimationResult?.driverMultiplier || 1.0}
                        isExpanded={expandedSection === 'drivers'}
                        onToggle={() => setExpandedSection(expandedSection === 'drivers' ? null : 'drivers')}
                    />

                    <RisksSection
                        risks={risks}
                        selectedRiskIds={selectedRiskIds}
                        onRiskToggle={toggleRisk}
                        currentRiskScore={estimationResult?.riskScore || 0}
                        isExpanded={expandedSection === 'risks'}
                        onToggle={() => setExpandedSection(expandedSection === 'risks' ? null : 'risks')}
                    />
                </div>

                {/* Right Column - Summary */}
                <div className="overflow-y-auto">
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
