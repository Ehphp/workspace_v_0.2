import { Card, CardContent } from '@/components/ui/card';
import { Calculator, FileText, User, Tag, Zap, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Requirement, TechnologyPreset, EstimationWithDetails, Activity } from '@/types/database';
import { RequirementProgress } from '../RequirementProgress';

interface OverviewTabProps {
    requirement: Requirement;
    presets: TechnologyPreset[];
    refetchRequirement: () => Promise<void>;
    latestEstimation?: EstimationWithDetails | null;
    activities?: Activity[];
}

const priorityColors = {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    LOW: 'bg-green-100 text-green-700 border-green-200',
};

const stateColors = {
    CREATED: 'bg-slate-100 text-slate-700 border-slate-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    DONE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function OverviewTab({ requirement, presets, refetchRequirement, latestEstimation, activities = [] }: OverviewTabProps) {
    const preset = presets.find(p => p.id === requirement.tech_preset_id);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="container mx-auto px-6 py-3">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Left: Compact Info Grid (3/5) */}
                        <div className="lg:col-span-3 space-y-3">
                            {/* Title & Description Card */}
                            <Card className="rounded-xl shadow-sm border-slate-200 bg-white/60 backdrop-blur-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono text-slate-500">{requirement.req_id}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs px-2 py-0 ${priorityColors[requirement.priority]}`}
                                                >
                                                    {requirement.priority}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs px-2 py-0 ${stateColors[requirement.state] || 'bg-slate-100 text-slate-700'}`}
                                                >
                                                    {requirement.state}
                                                </Badge>
                                            </div>
                                            <h2 className="text-lg font-bold text-slate-900 leading-tight">{requirement.title}</h2>
                                        </div>
                                    </div>

                                    {/* Compact Description */}
                                    <div className="mt-2">
                                        <p className="text-sm text-slate-600 line-clamp-3">
                                            {requirement.description || 'No description provided'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Progress Section */}
                            {latestEstimation && (
                                <Card className="rounded-xl shadow-sm border-slate-200 bg-white/60 backdrop-blur-sm">
                                    <CardContent className="p-4">
                                        <RequirementProgress
                                            estimation={latestEstimation}
                                            activities={activities}
                                            onUpdate={refetchRequirement}
                                        />
                                    </CardContent>
                                </Card>
                            )}


                        </div>

                        {/* Right: Estimation Summary (2/5) */}
                        <div className="lg:col-span-2">
                            <Card className="rounded-xl shadow-sm border-slate-200 bg-white/60 backdrop-blur-sm h-full">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-blue-50 rounded">
                                            <Calculator className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">Latest Estimation</h3>
                                    </div>

                                    {latestEstimation ? (
                                        <div className="space-y-3">
                                            {/* Total Days - Compact */}
                                            <div className="text-center py-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                                                <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                    {latestEstimation.total_days.toFixed(1)}
                                                </div>
                                                <div className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                                                    Total Days
                                                </div>
                                            </div>

                                            {/* Compact Breakdown */}
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Base:</span>
                                                    <span className="font-bold text-slate-900">{latestEstimation.base_days.toFixed(1)}d</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Multiplier:</span>
                                                    <span className="font-bold text-slate-900">{latestEstimation.driver_multiplier.toFixed(2)}x</span>
                                                </div>
                                                <div className="flex justify-between border-t pt-1.5">
                                                    <span className="text-slate-600">Subtotal:</span>
                                                    <span className="font-bold text-slate-900">
                                                        {(latestEstimation.base_days * latestEstimation.driver_multiplier).toFixed(1)}d
                                                    </span>
                                                </div>
                                                <div className="flex justify-between bg-orange-50 rounded px-2 py-1">
                                                    <span className="text-slate-600">Contingency:</span>
                                                    <span className="font-bold text-orange-700">{latestEstimation.contingency_percent}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs text-slate-500">No estimation yet</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Go to Estimation tab</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
