import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useActivityActions } from '@/hooks/useActivityActions';
import type { EstimationWithDetails, Activity } from '@/types/database';

interface RequirementProgressProps {
    estimation: EstimationWithDetails;
    activities: Activity[];
    onUpdate?: () => void;
}

export function RequirementProgress({ estimation, activities, onUpdate }: RequirementProgressProps) {
    const { toggleActivityStatus, updating } = useActivityActions();
    const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, boolean>>({});

    const estimationActivities = useMemo(() => {
        return estimation.estimation_activities || [];
    }, [estimation.estimation_activities]);

    // Sync/Clear optimistic updates when real data arrives
    useEffect(() => {
        setOptimisticUpdates(prev => {
            const next = { ...prev };
            let changed = false;
            estimationActivities.forEach(act => {
                // If the server data matches our optimistic expectation, we can clear the override
                if (next[act.id] === act.is_done) {
                    delete next[act.id];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [estimationActivities]);

    const progress = useMemo(() => {
        if (estimationActivities.length === 0) return 0;
        // Calculate progress using optimistic values
        const completed = estimationActivities.filter(a => {
            const isDone = optimisticUpdates[a.id] !== undefined ? optimisticUpdates[a.id] : a.is_done;
            return isDone;
        }).length;
        return Math.round((completed / estimationActivities.length) * 100);
    }, [estimationActivities, optimisticUpdates]);

    const handleToggle = async (activityId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        // Apply optimistic update
        setOptimisticUpdates(prev => ({ ...prev, [activityId]: newStatus }));

        try {
            await toggleActivityStatus(activityId, currentStatus, onUpdate);
        } catch (error) {
            // Revert on error
            setOptimisticUpdates(prev => {
                const next = { ...prev };
                delete next[activityId];
                return next;
            });
        }
    };

    if (estimationActivities.length === 0) return null;

    // Group activities by phase (matching SelectedActivitiesPanel style)
    const groupOrder = ['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'];
    const groupLabels: Record<string, string> = {
        ANALYSIS: 'Analisi',
        DEV: 'Sviluppo',
        TEST: 'Testing',
        OPS: 'Operations',
        GOVERNANCE: 'Governance',
    };

    const enrichedActivities = estimationActivities.map(estAct => {
        const activity = activities.find(a => a.id === estAct.activity_id);
        return { estAct, activity };
    }).filter(({ activity }) => activity != null);

    const grouped = enrichedActivities.reduce((acc, item) => {
        const group = item.activity!.group || 'DEV';
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {} as Record<string, typeof enrichedActivities>);

    return (
        <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <h3 className="text-sm font-medium text-slate-700">Progresso Implementazione</h3>
                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Activity Checklist — grouped by phase */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Attività ({estimationActivities.length})
                </h4>

                {groupOrder.map(groupKey => {
                    const items = grouped[groupKey];
                    if (!items || items.length === 0) return null;

                    const groupHours = items.reduce((sum, { activity }) => sum + (activity?.base_hours || 0), 0);
                    const groupDone = items.filter(({ estAct }) => {
                        return optimisticUpdates[estAct.id] !== undefined ? optimisticUpdates[estAct.id] : estAct.is_done;
                    }).length;

                    return (
                        <div key={groupKey} className="space-y-1.5">
                            {/* Group header */}
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                                    {groupLabels[groupKey] || groupKey}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400">
                                        {groupDone}/{items.length}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-500">
                                        {groupHours}h
                                    </span>
                                </div>
                            </div>

                            {/* Group activities */}
                            <div className="grid gap-1.5">
                                {items.map(({ estAct, activity }) => {
                                    const isDone = optimisticUpdates[estAct.id] !== undefined
                                        ? optimisticUpdates[estAct.id]
                                        : estAct.is_done;
                                    const isUpdating = updating === estAct.id;

                                    return (
                                        <div
                                            key={estAct.id}
                                            className={cn(
                                                "group flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer",
                                                isDone
                                                    ? "bg-purple-50/50 border-purple-100"
                                                    : "bg-white border-purple-200 hover:border-purple-300"
                                            )}
                                            onClick={() => !isUpdating && handleToggle(estAct.id, isDone)}
                                        >
                                            <div className={cn(
                                                "shrink-0 transition-colors duration-200",
                                                isDone ? "text-purple-600" : "text-slate-300 group-hover:text-purple-400"
                                            )}>
                                                {isDone ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : (
                                                    <Circle className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-medium text-[11px] transition-colors duration-200 truncate",
                                                    isDone ? "text-slate-500 line-through" : "text-slate-800"
                                                )}>
                                                    <span className="truncate">{activity!.name}</span>
                                                    {estAct.is_ai_suggested && (
                                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500 text-white shrink-0 flex items-center gap-0.5">
                                                            <Sparkles className="h-2 w-2" /> AI
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[9px] text-slate-400 truncate">
                                                    {activity!.code}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                                                isDone ? "bg-slate-100 text-slate-400" : "bg-purple-50 text-purple-700"
                                            )}>
                                                {activity!.base_hours}h
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
