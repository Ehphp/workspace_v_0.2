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
import { ChevronDown, ChevronUp, Activity, GitBranch, Zap, AlertTriangle, ListTree } from 'lucide-react';
import type { EstimationFromInterviewResponse } from '@/types/requirement-interview';
import type { DebugDecisionTraceEntry } from '@/lib/pipeline-debug-api';

type PipelineTrace = NonNullable<EstimationFromInterviewResponse['pipelineTrace']>;

interface CandidateProvenanceLike {
    primarySource: string;
}

interface PipelineTraceCardProps {
    trace: PipelineTrace;
    /** Decision trace from DecisionEngine (deterministic path) */
    decisionTrace?: DebugDecisionTraceEntry[];
    /** Full candidate provenance — used to surface sources not in signalSets */
    candidateProvenance?: CandidateProvenanceLike[];
    /** Open by default (e.g. when rendered in debug dashboard). Default: false */
    defaultOpen?: boolean;
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

const STEP_LABELS: Record<string, string> = {
    'score-gate':             'Score gate',
    'mandatory-keyword':      'Mandatory KW',
    'coverage-enforcement':   'Coverage',
    'redundancy-elimination': 'Redundancy',
    'top-k-cap':              'Top-K cap',
};

const ACTION_COLORS: Record<string, string> = {
    'select':        'text-green-700 bg-green-50',
    'add-coverage':  'text-blue-700 bg-blue-50',
    'add-mandatory': 'text-purple-700 bg-purple-50',
    'exclude':       'text-slate-500 bg-slate-50',
};

export function PipelineTraceCard({ trace, decisionTrace, candidateProvenance, defaultOpen = false }: PipelineTraceCardProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [ksOpen, setKsOpen] = useState(false);
    const [dtOpen, setDtOpen] = useState(false);

    // Compute full primary-source distribution from candidateProvenance.
    // Sources that attributed candidates but have no signalSet are "silent" —
    // they contribute to the gap between sum(signalSources%) and 100%.
    const silentSources: { source: string; share: number }[] = [];
    if (candidateProvenance && candidateProvenance.length > 0) {
        const knownSources = new Set(trace.signalSources.map(s => s.source));
        const countBySource = new Map<string, number>();
        for (const p of candidateProvenance) {
            if (p.primarySource && !knownSources.has(p.primarySource)) {
                countBySource.set(p.primarySource, (countBySource.get(p.primarySource) ?? 0) + 1);
            }
        }
        for (const [source, count] of countBySource) {
            silentSources.push({
                source,
                share: Number((count / candidateProvenance.length).toFixed(3)),
            });
        }
        silentSources.sort((a, b) => b.share - a.share);
    }

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
                            {silentSources.map(s => (
                                <div key={s.source} className="flex items-center gap-2 opacity-60" title="Fonte senza signal set proprio — candidati attribuiti tramite provenance">
                                    <Badge variant="outline" className={`text-[10px] w-28 justify-center shrink-0 border-dashed ${sourceColor(s.source)}`}>
                                        {s.source}
                                    </Badge>
                                    <span className="text-xs text-slate-300 w-16 shrink-0 italic">
                                        no signals
                                    </span>
                                    <ScoreBar value={s.share} max={maxShare} />
                                    <span className="text-xs font-mono text-slate-400 w-10 text-right">
                                        {Math.round(s.share * 100)}%
                                    </span>
                                    <span className="text-xs text-slate-300 w-12 text-right">—</span>
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

                    {/* ── Decision Trace ── */}
                    {decisionTrace && decisionTrace.length > 0 && (
                        <div>
                            <button
                                onClick={() => setDtOpen(o => !o)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <ListTree className="h-3 w-3" />
                                <span>Decision Trace ({decisionTrace.length} steps)</span>
                                {dtOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            {dtOpen && (
                                <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
                                    <div className="grid grid-cols-[90px_80px_100px_1fr_50px] bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 gap-2">
                                        <span>Step</span>
                                        <span>Action</span>
                                        <span>Code</span>
                                        <span>Reason</span>
                                        <span className="text-right">Score</span>
                                    </div>
                                    <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                                        {decisionTrace.map((entry, i) => (
                                            <div key={i} className="grid grid-cols-[90px_80px_100px_1fr_50px] px-3 py-1.5 text-xs gap-2 items-start hover:bg-slate-50">
                                                <span className="text-slate-400 text-[10px] pt-0.5">
                                                    {STEP_LABELS[entry.step] ?? entry.step}
                                                </span>
                                                <span className={`text-[10px] font-medium rounded px-1 py-0.5 w-fit ${ACTION_COLORS[entry.action] ?? 'text-slate-500 bg-slate-50'}`}>
                                                    {entry.action}
                                                </span>
                                                <span className="font-mono text-[10px] text-indigo-600 truncate">
                                                    {entry.code || '—'}
                                                </span>
                                                <span className="text-slate-500 text-[10px] leading-relaxed">
                                                    {entry.reason}
                                                </span>
                                                <span className="font-mono text-[10px] text-slate-400 text-right">
                                                    {entry.score != null ? entry.score.toFixed(2) : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
