import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, X, GripVertical, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Activity } from '@/types/database';

interface SelectedActivitiesPanelProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
}

const groupLabels: Record<string, string> = {
    ANALYSIS: 'Analisi',
    DEV: 'Sviluppo',
    TEST: 'Testing',
    OPS: 'Operations',
    GOVERNANCE: 'Governance',
};

export function SelectedActivitiesPanel({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
}: SelectedActivitiesPanelProps) {
    const selectedSet = new Set(selectedActivityIds);
    const selectedActivities = activities.filter((a) => selectedSet.has(a.id));

    const totalHours = selectedActivities.reduce((sum, a) => sum + a.base_hours, 0);

    // Group selected activities
    const grouped = selectedActivities.reduce((acc, activity) => {
        if (!acc[activity.group]) acc[activity.group] = [];
        acc[activity.group].push(activity);
        return acc;
    }, {} as Record<string, Activity[]>);

    const groupOrder = ['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'];

    return (
        <div className="h-full flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                    Attività Selezionate
                </h3>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-600 bg-purple-50">
                        {selectedActivityIds.length} sel.
                    </Badge>
                    <span className="text-xs font-semibold text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                        {totalHours}h
                    </span>
                </div>
            </div>

            {/* Selected Activities */}
            <ScrollArea className="flex-1 min-h-0">
                {selectedActivities.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="Nessuna attività selezionata"
                        className="p-8"
                    />
                ) : (
                    <div className="space-y-3 pr-2">
                        {groupOrder.map((group) => {
                            const groupActivities = grouped[group] || [];
                            if (groupActivities.length === 0) return null;

                            const groupHours = groupActivities.reduce((sum, a) => sum + a.base_hours, 0);

                            return (
                                <div key={group}>
                                    <div className="flex items-center justify-between mb-1.5 px-1">
                                        <span className="text-[9px] font-semibold uppercase text-purple-400">
                                            {groupLabels[group]}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-400">{groupHours}h</span>
                                    </div>
                                    <div className="space-y-1">
                                        {groupActivities.map((activity) => {
                                            const isAiSuggested = aiSuggestedIds.includes(activity.id);
                                            return (
                                                <div
                                                    key={activity.id}
                                                    className="group flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                                                >
                                                    <GripVertical className="h-3 w-3 text-slate-300 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] font-medium text-slate-800 leading-tight flex items-center gap-1">
                                                            <span className="truncate">{activity.name}</span>
                                                            {isAiSuggested && (
                                                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500 text-white shrink-0 flex items-center gap-0.5">
                                                                    <Sparkles className="h-2 w-2" /> AI
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                            <span className="font-mono">{activity.code}</span>
                                                            <span>•</span>
                                                            <span className="font-semibold">{activity.base_hours}h</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0 rounded-full"
                                                        onClick={() => onActivityToggle(activity.id)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            {/* Footer summary */}
            {selectedActivities.length > 0 && (
                <div className="shrink-0 rounded-lg bg-purple-50 border border-purple-200 p-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-purple-700">Totale ore base</span>
                    <span className="text-sm font-bold text-purple-700 font-mono">{totalHours}h</span>
                </div>
            )}
        </div>
    );
}
