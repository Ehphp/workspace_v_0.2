/**
 * ActivityTable — Per-activity provenance table for Pipeline Debug.
 *
 * Shows each selected activity with:
 *   - Score from CandidateSynthesizer
 *   - Primary source badge (blueprint / impactMap / keyword / ...)
 *   - Contribution bar for each active source
 *   - LLM reason or deterministic reason
 */

import type { DebugActivity } from '@/lib/pipeline-debug-api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
    blueprint:          'bg-purple-100 text-purple-700 border-purple-200',
    'impact-map':       'bg-blue-100 text-blue-700 border-blue-200',
    understanding:      'bg-green-100 text-green-700 border-green-200',
    keyword:            'bg-amber-100 text-amber-700 border-amber-200',
    'project-activity': 'bg-rose-100 text-rose-700 border-rose-200',
    context:            'bg-slate-100 text-slate-600 border-slate-200',
};

const CONTRIB_COLORS: Record<string, string> = {
    blueprint:       'bg-purple-400',
    impactMap:       'bg-blue-400',
    understanding:   'bg-green-400',
    keyword:         'bg-amber-400',
    projectActivity: 'bg-rose-400',
    projectContext:  'bg-slate-400',
};

const CONTRIB_LABELS: Record<string, string> = {
    blueprint:       'bp',
    impactMap:       'im',
    understanding:   'un',
    keyword:         'kw',
    projectActivity: 'pa',
    projectContext:  'ctx',
};

function sourceColor(s: string) {
    return SOURCE_COLORS[s] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

function ContribBars({ contributions }: { contributions: DebugActivity['contributions'] }) {
    if (!contributions) return null;
    const entries = Object.entries(contributions).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    const max = Math.max(...entries.map(([, v]) => v));

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {entries.map(([key, val]) => (
                <div key={key} className="flex items-center gap-0.5" title={`${key}: ${val.toFixed(2)}`}>
                    <span className="text-[9px] text-slate-400">{CONTRIB_LABELS[key] ?? key}</span>
                    <div className="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${CONTRIB_COLORS[key] ?? 'bg-slate-400'}`}
                            style={{ width: `${Math.min((val / max) * 100, 100)}%` }}
                        />
                    </div>
                    {/* <span className="text-[9px] font-mono text-slate-400">{val.toFixed(2)}</span> */}
                </div>
            ))}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityTableProps {
    activities: DebugActivity[];
}

export function ActivityTable({ activities }: ActivityTableProps) {
    return (
        <div className="rounded-lg border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex justify-between">
                <span>Attività selezionate ({activities.length})</span>
                <span>ore base</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {activities.map(a => (
                    <div key={a.code} className="px-3 py-2 text-xs hover:bg-slate-50 space-y-1">
                        {/* Row 1: code / name / source / score / hours */}
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-indigo-600 shrink-0 max-w-[40%] truncate" title={a.code}>{a.code}</span>
                            <span className="text-slate-700 flex-1 min-w-0 truncate">{a.name}</span>
                            {a.primarySource && (
                                <span className={`text-[9px] border rounded px-1 py-0.5 shrink-0 ${sourceColor(a.primarySource)}`}>
                                    {a.primarySource}
                                </span>
                            )}
                            {a.score != null && (
                                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                    {a.score.toFixed(2)}
                                </span>
                            )}
                            <span className="font-mono text-slate-500 shrink-0 w-8 text-right">{a.baseHours}h</span>
                        </div>
                        {/* Row 2: contribution bars */}
                        {a.contributions && <ContribBars contributions={a.contributions} />}
                        {/* Row 3: reason (collapsed to one line) */}
                        {a.reason && (
                            <p className="text-[10px] text-slate-400 truncate" title={a.reason}>
                                {a.reason}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
