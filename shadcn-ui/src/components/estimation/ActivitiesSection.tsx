import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { Activity } from '@/types/database';

interface ActivitiesSectionProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
    onAiRecalculate: () => void;
    isAiLoading: boolean;
    requirementDescription: string;
    isExpanded: boolean;
    onToggle: () => void;
}

export function ActivitiesSection({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
    onAiRecalculate,
    isAiLoading,
    requirementDescription,
    isExpanded,
    onToggle,
}: ActivitiesSectionProps) {
    const selectedSet = new Set(selectedActivityIds);
    const selectedActivities = activities.filter((activity) => selectedSet.has(activity.id));
    const remainingActivities = activities.filter((activity) => !selectedSet.has(activity.id));

    // Group remaining (non-selected) activities by group
    const groupedActivities = remainingActivities.reduce((acc, activity) => {
        if (!acc[activity.group]) {
            acc[activity.group] = [];
        }
        acc[activity.group].push(activity);
        return acc;
    }, {} as Record<string, Activity[]>);

    const groupOrder = ['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'];
    const groupLabels: Record<string, string> = {
        ANALYSIS: 'Analysis',
        DEV: 'Development',
        TEST: 'Testing',
        OPS: 'Operations',
        GOVERNANCE: 'Governance',
    };

    return (
        <Card className="rounded-lg shadow-sm border-slate-200 bg-white flex flex-col">
            <CardHeader
                className="pb-2 pt-3 px-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <div>
                            <CardTitle className="text-xs font-semibold text-slate-900">Activities</CardTitle>
                            {selectedActivityIds.length > 0 && (
                                <CardDescription className="text-[10px]">{selectedActivityIds.length} selected</CardDescription>
                            )}
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="px-3 pb-3 pt-0">
                    <div className="mb-3">
                        <Button
                            onClick={onAiRecalculate}
                            disabled={isAiLoading || !requirementDescription}
                            size="sm"
                            className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isAiLoading ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Suggest Activities
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {selectedActivities.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Selected</h4>
                                <div className="space-y-1">
                                    {selectedActivities.map((activity) => {
                                        const isAiSuggested = aiSuggestedIds.includes(activity.id);
                                        return (
                                            <div
                                                key={activity.id}
                                                className="flex items-start gap-2 p-2 border rounded cursor-pointer text-xs transition-colors border-purple-300 bg-purple-50"
                                                onClick={() => onActivityToggle(activity.id)}
                                            >
                                                <Checkbox
                                                    id={`selected-${activity.id}`}
                                                    checked={selectedSet.has(activity.id)}
                                                    onCheckedChange={() => onActivityToggle(activity.id)}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <label htmlFor={`selected-${activity.id}`} className="cursor-pointer">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-slate-900">{activity.name}</span>
                                                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                                                {activity.base_days}h
                                                            </span>
                                                            {isAiSuggested && (
                                                                <Badge className="text-[10px] h-4 px-1 bg-purple-600">
                                                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{activity.description}</p>
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {groupOrder.map((group) => {
                            const groupActivities = groupedActivities[group] || [];
                            if (groupActivities.length === 0) return null;

                            return (
                                <div key={group}>
                                    <h4 className="text-[10px] font-semibold uppercase text-slate-500 mb-1">{groupLabels[group]}</h4>
                                    <div className="space-y-1">
                                        {groupActivities.map((activity) => {
                                            const isAiSuggested = aiSuggestedIds.includes(activity.id);
                                            return (
                                                <div
                                                    key={activity.id}
                                                    className="flex items-start gap-2 p-2 border rounded cursor-pointer text-xs transition-colors border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                    onClick={() => onActivityToggle(activity.id)}
                                                >
                                                    <Checkbox
                                                        id={activity.id}
                                                        checked={selectedSet.has(activity.id)}
                                                        onCheckedChange={() => onActivityToggle(activity.id)}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <label htmlFor={activity.id} className="cursor-pointer">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-slate-900">{activity.name}</span>
                                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                                                    {activity.base_days}h
                                                                </span>
                                                                {isAiSuggested && (
                                                                    <Badge className="text-[10px] h-4 px-1 bg-purple-600">
                                                                        <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{activity.description}</p>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
