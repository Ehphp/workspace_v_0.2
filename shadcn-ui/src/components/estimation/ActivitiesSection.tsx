import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import type { Activity } from '@/types/database';

interface ActivitiesSectionProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
}

export function ActivitiesSection({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
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
            <CardHeader className="pb-3 flex-none bg-gradient-to-r from-slate-50 to-blue-50">
                <CardTitle className="text-sm font-semibold text-slate-900">Attività</CardTitle>
                <CardDescription className="text-xs">
                    Select the activities required for this requirement
                </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
                <div className="space-y-6 pr-2">
                    {groupOrder.map((group) => {
                        const groupActivities = groupedActivities[group] || [];
                        if (groupActivities.length === 0) return null;

                        return (
                            <div key={group}>
                                <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                                    {groupLabels[group]}
                                </h4>
                                <div className="space-y-2">
                                    {groupActivities.map((activity) => {
                                        const isSelected = selectedActivityIds.includes(activity.id);
                                        const isAiSuggested = aiSuggestedIds.includes(activity.id);

                                        return (
                                            <div
                                                key={activity.id}
                                                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200/50 hover:bg-blue-50/50 hover:border-blue-300/50 transition-all duration-200"
                                            >
                                                <Checkbox
                                                    id={activity.id}
                                                    checked={isSelected}
                                                    onCheckedChange={() => onActivityToggle(activity.id)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <label
                                                            htmlFor={activity.id}
                                                            className="text-sm font-medium cursor-pointer"
                                                        >
                                                            {activity.name}
                                                        </label>
                                                        {isAiSuggested && (
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Sparkles className="h-3 w-3" />
                                                                AI
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-xs">
                                                            {activity.base_days}d
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {activity.description}
                                                    </p>
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
        </Card>
    );
}
