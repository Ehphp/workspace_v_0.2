/**
 * BulkProgressTracker — S4-4: Visual progress tracker for bulk estimation
 *
 * Shows:
 *   - Progress bar with percentage
 *   - Current item being estimated
 *   - Partial results list with success/fail indicators
 *   - Error count badge
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface BulkProgress {
    total: number;
    completed: number;
    failed: number;
    currentItem?: string;
    partialResults?: PartialResult[];
}

interface PartialResult {
    success: boolean;
    reqId?: string;
    title?: string;
    estimation?: {
        totalDays?: number;
    };
    error?: string;
}

interface BulkProgressTrackerProps {
    progress: BulkProgress;
}

export function BulkProgressTracker({ progress }: BulkProgressTrackerProps) {
    const { total, completed, failed, currentItem, partialResults } = progress;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{completed}/{total} requisiti stimati</span>
                    <span>{percent}%</span>
                </div>
                <Progress value={percent} className="h-3" />
            </div>

            {/* Current item indicator */}
            {currentItem && completed < total && (
                <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground">Stima in corso:</span>
                    <span className="font-medium truncate">{currentItem}</span>
                </div>
            )}

            {/* Partial results list */}
            {partialResults && partialResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {partialResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                            {r.success
                                ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                : <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                            <span className="truncate flex-1">
                                {r.title || r.reqId || `Requisito ${i + 1}`}
                            </span>
                            {r.success && r.estimation?.totalDays != null && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                    {r.estimation.totalDays.toFixed(1)} gg
                                </Badge>
                            )}
                            {!r.success && r.error && (
                                <span className="text-destructive text-xs truncate max-w-32">
                                    {r.error}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Error count */}
            {failed > 0 && (
                <p className="text-xs text-destructive">
                    {failed} {failed === 1 ? 'requisito non stimato' : 'requisiti non stimati'}
                </p>
            )}
        </div>
    );
}
