import { useState } from 'react';
import { RequirementEstimation } from '../RequirementEstimation';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExportDialog } from '@/components/export/ExportDialog';
import type { Requirement, Activity, Driver, Risk, TechnologyPreset } from '@/types/database';
import type { UseEstimationStateReturn } from '@/hooks/useEstimationState';
import type { ExportableEstimation } from '@/types/export';

interface EstimationTabProps {
    requirement: Requirement;
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

export function EstimationTab({
    requirement,
    estimationState,
    data,
    onSave,
    isSaving,
    hasUnsavedChanges,
    onAiSuggest,
    isAiLoading,
    requirementDescription,
}: EstimationTabProps) {
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    // Build exportable estimation for dialog
    const getExportableEstimation = (): ExportableEstimation | null => {
        if (!estimationState.estimationResult) return null;

        const result = estimationState.estimationResult;
        const selectedPreset = data.presets.find(p => p.id === estimationState.selectedPresetId);

        return {
            requirement: {
                id: requirement.id,
                reqId: requirement.req_id,
                title: requirement.title,
                description: requirement.description || undefined,
                priority: requirement.priority as 'HIGH' | 'MEDIUM' | 'LOW',
                state: requirement.state,
                businessOwner: requirement.business_owner || undefined,
            },
            estimation: {
                totalDays: result.totalDays,
                baseDays: result.baseDays,
                driverMultiplier: result.driverMultiplier,
                subtotal: result.subtotal,
                riskScore: result.riskScore,
                contingencyPercent: result.contingencyPercent,
                contingencyDays: result.contingencyDays,
            },
            technology: selectedPreset ? {
                name: selectedPreset.name,
                category: selectedPreset.tech_category,
            } : undefined,
            activities: estimationState.selectedActivityIds.map(id => {
                const activity = data.activities.find(a => a.id === id);
                return {
                    code: activity?.code || id,
                    name: activity?.name || 'Unknown',
                    group: activity?.group || 'DEV',
                    hours: activity?.base_hours || 0,
                    isAiSuggested: estimationState.aiSuggestedIds.includes(id),
                };
            }),
            drivers: Object.entries(estimationState.selectedDriverValues).map(([driverId, value]) => {
                const driver = data.drivers.find(d => d.id === driverId);
                const option = driver?.options.find(o => o.value === value);
                return {
                    code: driver?.code || driverId,
                    name: driver?.name || driverId,
                    value,
                    label: option?.label || value,
                    multiplier: option?.multiplier || 1.0,
                };
            }),
            risks: estimationState.selectedRiskIds.map(id => {
                const risk = data.risks.find(r => r.id === id);
                return {
                    code: risk?.code || id,
                    name: risk?.name || 'Unknown',
                    weight: risk?.weight || 0,
                };
            }),
        };
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex-shrink-0 bg-white/60 backdrop-blur-xl border-b border-slate-200/50">
                <div className="container mx-auto px-6 py-3 flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-sm text-slate-600 hover:text-blue-600 rounded-xl border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200"
                                disabled={!estimationState.estimationResult}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Esporta
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl">
                            <DropdownMenuItem
                                onClick={() => setExportDialogOpen(true)}
                                className="flex items-center gap-3 rounded-lg py-2"
                            >
                                <FileText className="w-4 h-4 text-red-500" />
                                <span>Esporta PDF</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setExportDialogOpen(true)}
                                className="flex items-center gap-3 rounded-lg py-2"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                <span>Esporta Excel</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Main Workspace - Full height */}
            <div className="flex-1 min-h-0">
                <div className="container mx-auto px-6 py-4 h-full">
                    <div className="h-full overflow-y-auto">
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

            {/* Export Dialog */}
            {getExportableEstimation() && (
                <ExportDialog
                    open={exportDialogOpen}
                    onOpenChange={setExportDialogOpen}
                    estimations={[getExportableEstimation()!]}
                    projectName={requirement.title}
                />
            )}
        </div>
    );
}
