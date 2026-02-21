import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Layers, X, CheckCircle2 } from 'lucide-react';
import type { Activity } from '@/types/database';

interface ActivitiesSectionProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
    onAiRecalculate: () => void;
    isAiLoading: boolean;
    requirementDescription: string;
    isExpanded?: boolean;
    onToggle?: () => void;
}

export function ActivitiesSection({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
    onAiRecalculate,
    isAiLoading,
    requirementDescription,
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
        ANALYSIS: 'Analisi',
        DEV: 'Sviluppo',
        TEST: 'Testing',
        OPS: 'Operations',
        GOVERNANCE: 'Governance',
    };

    // Calculate total hours
    const totalHours = selectedActivities.reduce((sum, a) => sum + a.base_hours, 0);

    return (
        <div className="h-full flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">4</span>
                    Attività Selezionate
                </h3>
                <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] font-medium px-1.5 py-0">
                        {selectedActivityIds.length} sel.
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-mono">{totalHours}h</span>
                </div>
            </div>

            {/* AI Button */}
            <div className="shrink-0 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/30 p-2">
                <Button
                    onClick={onAiRecalculate}
                    disabled={isAiLoading || !requirementDescription}
                    size="sm"
                    className="w-full h-7 text-[10px] bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-sm"
                >
                    {isAiLoading ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Analisi in corso...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Suggerisci con AI
                        </>
                    )}
                </Button>
            </div>

            {/* Selected Activities */}
            {selectedActivities.length > 0 && (
                <div className="shrink-0 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-2">
                    <div className="text-[9px] font-semibold uppercase text-purple-600 mb-1.5">Selezionate</div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                        {selectedActivities.map((activity, idx) => {
                            const isAiSuggested = aiSuggestedIds.includes(activity.id);
                            return (
                                <div
                                    key={activity.id}
                                    className="group flex items-center justify-between bg-white p-2 rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-4 h-4 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 text-[9px] font-semibold shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-medium text-slate-800 leading-tight flex items-center gap-1 truncate">
                                                <span className="truncate">{activity.name}</span>
                                                {isAiSuggested && (
                                                    <span className="text-[8px] px-1 rounded bg-purple-500 text-white shrink-0 flex items-center gap-0.5">
                                                        <Sparkles className="h-2 w-2" /> AI
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                <span className="font-mono">{activity.code}</span>
                                                <span>•</span>
                                                <span>{activity.base_hours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        onClick={() => onActivityToggle(activity.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Activities by Group */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-3 pr-2">
                    {selectedActivities.length === 0 && remainingActivities.length === 0 && (
                        <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-6">
                            <Layers className="w-8 h-8 opacity-20 mb-2" />
                            <p className="text-xs">Nessuna attività disponibile</p>
                        </div>
                    )}

                    {groupOrder.map((group) => {
                        const groupActivities = groupedActivities[group] || [];
                        if (groupActivities.length === 0) return null;

                        return (
                            <div key={group} className="rounded-lg border-2 border-slate-200 bg-slate-50/30 p-2">
                                <div className="text-[9px] font-semibold uppercase text-slate-500 mb-1.5">{groupLabels[group]}</div>
                                <div className="space-y-1">
                                    {groupActivities.map((activity) => {
                                        const isAiSuggested = aiSuggestedIds.includes(activity.id);
                                        return (
                                            <div
                                                key={activity.id}
                                                className="cursor-pointer rounded p-1.5 text-[10px] flex items-center gap-1.5 transition-all bg-white/80 border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                                                onClick={() => onActivityToggle(activity.id)}
                                            >
                                                <div className="w-3 h-3 shrink-0 rounded border border-slate-300 bg-white flex items-center justify-center" />
                                                <span className="font-medium text-slate-700 truncate flex-1" title={activity.name}>
                                                    {activity.name}
                                                </span>
                                                <span className="text-[8px] text-slate-400 font-mono shrink-0">{activity.base_hours}h</span>
                                                {isAiSuggested && (
                                                    <span className="text-[7px] px-1 rounded bg-purple-100 text-purple-600 shrink-0">AI</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
