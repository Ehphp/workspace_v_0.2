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
        <div className="container mx-auto px-6 py-12 h-full">
            {/* Header Sezione */}
            <div className="mb-6 px-4 py-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-md">
                <h2 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Configure Estimation
                </h2>
                <p className="text-xs text-slate-600 mt-1">Select technology, activities, drivers and risks to calculate the estimation</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-6 pb-12 h-full min-h-0">
                {/* Left Column - Configuration */}
                <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2">
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

                {/* Right Column - Summary (Sticky) */}
                <div className="lg:sticky lg:top-6 lg:self-start lg:h-fit">
                    <CalculationSummary
                        result={estimationResult}
                        onSave={onSave}
                        isSaving={isSaving}
                        hasUnsavedChanges={hasUnsavedChanges}
                    />
                </div>
            </div>
        </div>
    );
}
