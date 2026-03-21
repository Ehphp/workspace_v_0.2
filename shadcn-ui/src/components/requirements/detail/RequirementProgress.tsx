import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
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

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <h3 className="text-sm font-medium text-slate-700">Progresso Implementazione</h3>
                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Activity Checklist */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Attività ({estimationActivities.length})
                </h4>
                <div className="grid gap-2">
                    {estimationActivities.map((estAct) => {
                        const activity = activities.find(a => a.id === estAct.activity_id);
                        if (!activity) return null;

                        // Use optimistic value if available
                        const isDone = optimisticUpdates[estAct.id] !== undefined
                            ? optimisticUpdates[estAct.id]
                            : estAct.is_done;

                        const isUpdating = updating === estAct.id;

                        return (
                            <div
                                key={estAct.id}
                                className={cn(
                                    "group flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer",
                                    isDone
                                        ? "bg-blue-50/50 border-blue-100"
                                        : "bg-white border-slate-200 hover:border-blue-300"
                                )}
                                onClick={() => !isUpdating && handleToggle(estAct.id, isDone)}
                            >
                                <div className={cn(
                                    "shrink-0 transition-colors duration-200",
                                    isDone ? "text-blue-600" : "text-slate-300 group-hover:text-blue-400"
                                )}>
                                    {isDone ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <Circle className="w-4 h-4" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "font-medium text-xs transition-colors duration-200 truncate",
                                        isDone ? "text-slate-500 line-through" : "text-slate-900"
                                    )}>
                                        {activity.name}
                                    </div>
                                </div>

                                <div className={cn(
                                    "text-xs font-bold px-1.5 py-0.5 rounded",
                                    isDone ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700"
                                )}>
                                    {activity.base_hours}h
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
