import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { Activity } from '@/types/database';

interface ActivitiesSectionProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export function ActivitiesSection({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
    isExpanded,
    onToggle,
}: ActivitiesSectionProps) {
    // Group activities by group
    const groupedActivities = activities.reduce((acc, activity) => {
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
        <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 flex flex-col max-h-[400px]">
            <CardHeader
                className="pb-3 flex-none bg-gradient-to-r from-purple-50 to-pink-50 cursor-pointer border-b border-purple-100"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">Activities</CardTitle>
                            <CardDescription className="text-xs">
                                {selectedActivityIds.length > 0
                                    ? `${selectedActivityIds.length} selected`
                                    : 'Select activities for this requirement'}
                            </CardDescription>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-purple-600" /> : <ChevronDown className="h-4 w-4 text-purple-600" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="overflow-y-auto flex-1 pt-4">
                    <div className="space-y-5 pr-2">
                        {groupOrder.map((group) => {
                            const groupActivities = groupedActivities[group] || [];
                            if (groupActivities.length === 0) return null;

                            return (
                                <div key={group}>
                                    <h4 className="font-bold text-sm mb-3 text-slate-900 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                                        {groupLabels[group]}
                                    </h4>
                                    <div className="space-y-2">
                                        {groupActivities.map((activity) => {
                                            const isSelected = selectedActivityIds.includes(activity.id);
                                            const isAiSuggested = aiSuggestedIds.includes(activity.id);

                                            return (
                                                <div
                                                    key={activity.id}
                                                    className={`group flex items-start space-x-3 p-3 border-2 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                                                        ? 'border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 shadow-md'
                                                        : 'border-slate-200 hover:border-purple-200 hover:bg-purple-50/30'
                                                        }`}
                                                    onClick={() => onActivityToggle(activity.id)}
                                                >
                                                    <Checkbox
                                                        id={activity.id}
                                                        checked={isSelected}
                                                        onCheckedChange={() => onActivityToggle(activity.id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <label htmlFor={activity.id} className="cursor-pointer">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition-colors">
                                                                    {activity.name}
                                                                </span>
                                                                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                    {activity.base_days}h
                                                                </span>
                                                                {isAiSuggested && (
                                                                    <Badge className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 border-0">
                                                                        <Sparkles className="h-3 w-3 mr-1" />
                                                                        AI
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                                                                {activity.description}
                                                            </p>
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
