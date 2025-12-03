import { useMemo } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
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

    const estimationActivities = useMemo(() => {
        return estimation.activities || [];
    }, [estimation.activities]);

    const progress = useMemo(() => {
        if (estimationActivities.length === 0) return 0;
        const completed = estimationActivities.filter(a => a.is_done).length;
        return Math.round((completed / estimationActivities.length) * 100);
    }, [estimationActivities]);

    const handleToggle = async (activityId: string, currentStatus: boolean) => {
        await toggleActivityStatus(activityId, currentStatus, onUpdate);
    };

    if (estimationActivities.length === 0) return null;

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <h3 className="text-sm font-medium text-slate-700">Implementation Progress</h3>
                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Activity Checklist */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Activities ({estimationActivities.length})
                </h4>
                <div className="grid gap-2">
                    {estimationActivities.map((estAct) => {
                        const activity = activities.find(a => a.id === estAct.activity_id);
                        if (!activity) return null;

                        const isDone = estAct.is_done;
                        const isUpdating = updating === estAct.id;

                        return (
                            <motion.div
                                key={estAct.id}
                                layout
                                initial={false}
                                className={cn(
                                    "group flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                                    isDone
                                        ? "bg-blue-50/50 border-blue-100"
                                        : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
                                )}
                                onClick={() => !isUpdating && handleToggle(estAct.id, isDone)}
                            >
                                <div className={cn(
                                    "mt-0.5 shrink-0 transition-colors duration-200",
                                    isDone ? "text-blue-600" : "text-slate-300 group-hover:text-blue-400"
                                )}>
                                    {isUpdating ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                    ) : isDone ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <Circle className="w-5 h-5" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "font-medium text-sm transition-colors duration-200",
                                        isDone ? "text-slate-500 line-through" : "text-slate-900"
                                    )}>
                                        {activity.name}
                                    </div>
                                    {activity.description && (
                                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                            {activity.description}
                                        </div>
                                    )}
                                </div>

                                <div className="text-xs font-mono font-medium text-slate-400">
                                    {activity.base_days}d
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
