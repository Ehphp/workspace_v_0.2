import { AvailableActivitiesPanel } from '@/components/estimation/AvailableActivitiesPanel';
import { SelectedActivitiesPanel } from '@/components/estimation/SelectedActivitiesPanel';
import { CalculationSummary } from '@/components/estimation/CalculationSummary';
import type { UseEstimationStateReturn } from '@/hooks/useEstimationState';
import type { Technology, Activity, Driver, Risk } from '@/types/database';
import { FileText, Badge as BadgeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RequirementEstimationProps {
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

export function RequirementEstimation({
    estimationState,
    data,
    onSave,
    isSaving,
    hasUnsavedChanges,
    requirementDescription,
}: RequirementEstimationProps) {
    const {
        selectedPresetId,
        selectedActivityIds,
        aiSuggestedIds,
        toggleActivity,
        estimationResult,
    } = estimationState;

    const { presets, activities } = data;
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);

    return (
        <div className="h-full flex flex-col">
            {/* Header: Requirement + Technology badge */}
            <div className="shrink-0 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Requisito</span>
                            {requirementDescription ? (
                                <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{requirementDescription}</p>
                            ) : (
                                <p className="text-sm text-slate-400 mt-0.5 italic">Nessuna descrizione</p>
                            )}
                        </div>
                    </div>
                    {selectedPreset && (
                        <div className="shrink-0 flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-blue-200 text-blue-600 bg-blue-50 whitespace-nowrap">
                                <BadgeIcon className="h-3 w-3 mr-1" />
                                {selectedPreset.name}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>

            {/* 3-column layout: Available | Selected | Summary */}
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
                {/* Column 1: Available Activities (5 cols) */}
                <div className="col-span-5 flex flex-col border-r border-slate-100 pr-4 h-full min-h-0">
                    <AvailableActivitiesPanel
                        activities={activities}
                        selectedActivityIds={selectedActivityIds}
                        aiSuggestedIds={aiSuggestedIds}
                        onActivityToggle={toggleActivity}
                    />
                </div>

                {/* Column 2: Selected Activities (4 cols) */}
                <div className="col-span-4 flex flex-col border-r border-slate-100 pr-4 h-full min-h-0">
                    <SelectedActivitiesPanel
                        activities={activities}
                        selectedActivityIds={selectedActivityIds}
                        aiSuggestedIds={aiSuggestedIds}
                        onActivityToggle={toggleActivity}
                    />
                </div>

                {/* Column 3: Summary (3 cols) */}
                <div className="col-span-3 overflow-y-auto">
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
