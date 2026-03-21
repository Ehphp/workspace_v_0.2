import { useMemo } from 'react';
import { AlertCircle, Clock, ShieldAlert, CalendarClock } from 'lucide-react';
import type { RequirementWithEstimation } from '@/types/database';
import { PRIORITY_LABELS, STATE_LABELS } from '@/types/export';

interface RequirementsInsightPanelProps {
    requirements: RequirementWithEstimation[];
}

interface Insight {
    icon: React.ReactNode;
    text: string;
    severity: 'warning' | 'info';
}

export function RequirementsInsightPanel({ requirements }: RequirementsInsightPanelProps) {
    const insights = useMemo(() => {
        const result: Insight[] = [];
        if (requirements.length === 0) return result;

        // 1. Requirements without estimation
        const unestimated = requirements.filter(r => !r.latest_estimation);
        if (unestimated.length > 0) {
            result.push({
                icon: <Clock className="h-3.5 w-3.5" />,
                text: `${unestimated.length} requisit${unestimated.length === 1 ? 'o' : 'i'} senza stima`,
                severity: 'warning',
            });
        }

        // 2. High-priority without estimation
        const highUnestimated = unestimated.filter(r => r.priority === 'HIGH');
        if (highUnestimated.length > 0) {
            result.push({
                icon: <ShieldAlert className="h-3.5 w-3.5" />,
                text: `${highUnestimated.length} ad alta priorità senza stima`,
                severity: 'warning',
            });
        }

        // 3. High risk estimations (risk_score > 0.6)
        const highRisk = requirements.filter(r => r.latest_estimation && r.latest_estimation.risk_score > 0.6);
        if (highRisk.length > 0) {
            result.push({
                icon: <AlertCircle className="h-3.5 w-3.5" />,
                text: `${highRisk.length} stim${highRisk.length === 1 ? 'a' : 'e'} con rischio elevato`,
                severity: 'warning',
            });
        }

        // 4. PROPOSED for a long time (>14 days)
        const now = Date.now();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        const staleProposed = requirements.filter(r =>
            r.state === 'PROPOSED' && (now - new Date(r.created_at).getTime()) > fourteenDays
        );
        if (staleProposed.length > 0) {
            result.push({
                icon: <CalendarClock className="h-3.5 w-3.5" />,
                text: `${staleProposed.length} requisit${staleProposed.length === 1 ? 'o' : 'i'} in stato Proposto da oltre 2 settimane`,
                severity: 'info',
            });
        }

        return result;
    }, [requirements]);

    if (insights.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-4">
            {insights.map((insight, i) => {
                const color = insight.severity === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';
                return (
                    <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${color}`}
                    >
                        {insight.icon}
                        {insight.text}
                    </span>
                );
            })}
        </div>
    );
}
