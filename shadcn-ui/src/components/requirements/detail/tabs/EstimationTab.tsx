import { Card, CardContent } from '@/components/ui/card';
import { RequirementEstimation } from '../RequirementEstimation';
import { RequirementDriversCard } from '../RequirementDriversCard';
import { Calculator, History, Download } from 'lucide-react';
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
    const handleExportCSV = () => {
        if (!estimationState.estimationResult) return;

        const result = estimationState.estimationResult;
        const activities = estimationState.selectedActivityIds.map(id => {
            const act = data.activities.find(a => a.id === id);
            return act ? `"${act.name}"` : 'Unknown';
        }).join(';');

        const csvContent = [
            ['Metric', 'Value'],
            ['Total Days', result.totalDays.toFixed(2)],
            ['Base Days', result.baseDays.toFixed(2)],
            ['Driver Multiplier', result.driverMultiplier.toFixed(3)],
            ['Risk Score', result.riskScore],
            ['Contingency', `${(result.contingencyPercent * 100)}%`],
            ['Activities', activities]
        ].map(e => e.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `estimation_${requirement.title.substring(0, 20)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex-shrink-0 px-6 py-2 bg-white border-b border-slate-200 flex justify-end">
                <button
                    onClick={handleExportCSV}
                    className="text-xs flex items-center gap-1 text-slate-600 hover:text-blue-600 transition-colors"
                    title="Export to CSV"
                >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                </button>
            </div>

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
