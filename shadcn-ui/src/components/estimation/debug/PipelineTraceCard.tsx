/**
 * PipelineTraceCard — Dev dashboard for a single pipeline trace.
 *
 * Collapsible debug card. Answers at a glance:
 *   • Which path was taken? (agentic / deterministic-fallback)
 *   • How confident was the pipeline? (aggregateConfidence)
 *   • Which signals fired? (signalSources table)
 *   • How much did the agent deviate from deterministic? (agentDelta)
 *   • Which kill switches were active?
 *
 * Collapsed by default — zero visual noise for production.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Activity, GitBranch, Zap, AlertTriangle } from 'lucide-react';
import type { EstimationFromInterviewResponse } from '@/types/requirement-interview';

type PipelineTrace = NonNullable<EstimationFromInterviewResponse['pipelineTrace']>;

interface PipelineTraceCardProps {
    trace: PipelineTrace;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
    blueprint:            'bg-purple-100 text-purple-800 border-purple-200',
    'impact-map':         'bg-blue-100 text-blue-800 border-blue-200',
    understanding:        'bg-green-100 text-green-800 border-green-200',
    keyword:              'bg-amber-100 text-amber-800 border-amber-200',
    'project-activity':   'bg-rose-100 text-rose-800 border-rose-200',
};

function sourceColor(source: string) {
    return SOURCE_COLORS[source] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function confidenceColor(c: number) {
    if (c >= 0.8) return 'text-green-700 bg-green-50';
    if (c >= 0.6) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
}

function ScoreBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PipelineTraceCard({ trace }: PipelineTraceCardProps) {
    const [open, setOpen] = useState(false);
    const [ksOpen, setKsOpen] = useState(false);

    const modeColor = trace.pipelineMode === 'agentic'
        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
        : 'bg-orange-100 text-orange-800 border-orange-200';

    const maxShare = Math.max(...trace.signalSources.map(s => s.primarySourceShare), 0.001);

    return (
        <div className="border border-slate-200 rounded-lg bg-white text-sm">
            {/* ── Header ── */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors rounded-lg"
            >
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-700">Pipeline Trace</span>

                    <Badge variant="outline" className={`text-[10px] ${modeColor}`}>
                        {trace.pipelineMode}
                    </Badge>

                    <Badge variant="outline" className={`text-[10px] ${confidenceColor(trace.aggregateConfidence)}`}>
                        conf {Math.round(trace.aggregateConfidence * 100)}%
                    </Badge>

                    {trace.isStale && (
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            stale
                        </Badge>
                    )}

                    {trace.agentDelta && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                            overlap {Math.round(trace.agentDelta.overlapScore * 100)}%
                        </Badge>
                    )}
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {open && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-4">

                    {/* ── Meta row ── */}
                    <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
                        <span>req <code className="text-slate-700">{trace.requestId.slice(0, 12)}</code></span>
                        <span>{new Date(trace.timestamp).toLocaleTimeString('it-IT')}</span>
                        <span>{trace.durationMs}ms</span>
                        <span>{trace.candidateCount} candidates (limit {trace.candidateLimit})</span>
                        <span>strategy: <code className="text-slate-700">{trace.candidateSynthesisStrategy}</code></span>
                        {trace.staleReasons.length > 0 && (
                            <span className="text-yellow-600">{trace.staleReasons.join(', ')}</span>
                        )}
                    </div>

                    {/* ── Signal sources ── */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signal Sources</p>
                        <div className="space-y-1.5">
                            {trace.signalSources.map(s => (
                                <div key={s.source} className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[10px] w-28 justify-center shrink-0 ${sourceColor(s.source)}`}>
                                        {s.source}
                                    </Badge>
                                    <span className="text-xs text-slate-400 w-16 shrink-0">
                                        {s.signalCount} signals
                                    </span>
                                    <ScoreBar value={s.primarySourceShare} max={maxShare} />
                                    <span className="text-xs font-mono text-slate-500 w-10 text-right">
                                        {Math.round(s.primarySourceShare * 100)}%
                                    </span>
                                    <span className="text-xs font-mono text-slate-400 w-12 text-right">
                                        avg {s.topAvgScore.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Agent delta ── */}
                    {trace.agentDelta && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                Agent Delta vs Deterministic
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-slate-500">overlap</span>
                                    <span className={`font-semibold ${trace.agentDelta.overlapScore >= 0.8 ? 'text-green-600' : trace.agentDelta.overlapScore >= 0.5 ? 'text-yellow-600' : 'text-red-500'}`}>
                                        {Math.round(trace.agentDelta.overlapScore * 100)}%
                                    </span>
                                </div>
                                {trace.agentDelta.added.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-xs text-green-600 font-medium">+{trace.agentDelta.added.length} added:</span>
                                        {trace.agentDelta.added.map(c => (
                                            <Badge key={c} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-mono">
                                                {c}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {trace.agentDelta.removed.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-xs text-red-500 font-medium">−{trace.agentDelta.removed.length} removed:</span>
                                        {trace.agentDelta.removed.map(c => (
                                            <Badge key={c} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 font-mono">
                                                {c}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {trace.agentDelta.added.length === 0 && trace.agentDelta.removed.length === 0 && (
                                    <span className="text-xs text-slate-400 italic">agent selection identical to deterministic</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Kill switches ── */}
                    {trace.killSwitches && (
                        <div>
                            <button
                                onClick={() => setKsOpen(o => !o)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Zap className="h-3 w-3" />
                                <span>Kill switches</span>
                                {ksOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            {ksOpen && (
                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                    {Object.entries(trace.killSwitches).map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-1.5 text-xs">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${v === true ? 'bg-green-400' : v === false ? 'bg-red-400' : 'bg-slate-300'}`} />
                                            <code className="text-slate-500 truncate">{k}</code>
                                            <span className="text-slate-400 ml-auto font-mono">{String(v)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
