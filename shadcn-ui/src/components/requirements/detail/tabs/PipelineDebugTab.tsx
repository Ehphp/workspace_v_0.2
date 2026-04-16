/**
 * PipelineDebugTab — Tab "Pipeline Debug" nel RequirementDetail.
 *
 * Riutilizza lo stesso stack backend del wizard normale:
 * preleva descrizione, projectId e techCategory direttamente
 * dal contesto del requisito, espone solo i kill-switch e
 * il modo di esecuzione.
 *
 * Storico delle run → localStorage, chiave per requisito.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Play,
    Trash2,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp,
    FlaskConical,
} from 'lucide-react';
import { PipelineTraceCard } from '@/components/estimation/debug/PipelineTraceCard';
import {
    runDebugEstimation,
    DEFAULT_KS,
    type DebugRun,
    type DebugArtifacts,
    type DebugKillSwitches,
    type ForceMode,
} from '@/lib/pipeline-debug-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineDebugTabProps {
    requirementId: string;
    description: string;
    projectId?: string;
    techCategory?: string;
}

// ─── localStorage helpers (per-requirement) ───────────────────────────────────

const lsKey = (reqId: string) => `pipeline_debug_req_${reqId}`;
const MAX_RUNS = 10;

function loadHistory(reqId: string): DebugRun[] {
    try {
        const raw = localStorage.getItem(lsKey(reqId));
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveRun(reqId: string, run: DebugRun): DebugRun[] {
    const prev = loadHistory(reqId);
    const updated = [run, ...prev].slice(0, MAX_RUNS);
    localStorage.setItem(lsKey(reqId), JSON.stringify(updated));
    return updated;
}

function clearHistory(reqId: string): void {
    localStorage.removeItem(lsKey(reqId));
}

// ─── KS toggles ───────────────────────────────────────────────────────────────

interface KsToggle { key: keyof DebugKillSwitches; label: string; group: string }

const KS_TOGGLES: KsToggle[] = [
    { key: 'blueprintSignalEnabled',       label: 'Blueprint signal',        group: 'Signals' },
    { key: 'impactMapSignalEnabled',        label: 'Impact-map signal',       group: 'Signals' },
    { key: 'understandingSignalEnabled',    label: 'Understanding signal',    group: 'Signals' },
    { key: 'projectActivitySignalEnabled',  label: 'Project-activity signal', group: 'Signals' },
    { key: 'agenticEnabled',               label: 'Agentic pipeline',        group: 'Agent'   },
    { key: 'reflectionEnabled',            label: 'Reflection loop',         group: 'Agent'   },
    { key: 'toolUseEnabled',               label: 'Tool use',                group: 'Agent'   },
    { key: 'agentDeltaEnabled',            label: 'Agent delta (Δ)',         group: 'Obs'     },
];

const KS_GROUPS = ['Signals', 'Agent', 'Obs'];

// ─── ArtifactBar ─────────────────────────────────────────────────────────────

function ArtifactBar({ artifacts }: { artifacts?: DebugArtifacts }) {
    const items: { label: string; active: boolean }[] = [
        { label: 'Understanding',  active: artifacts?.hasUnderstanding      ?? false },
        { label: 'Impact Map',     active: artifacts?.hasImpactMap          ?? false },
        { label: 'Est. Blueprint', active: artifacts?.hasEstimationBlueprint ?? false },
        { label: 'Proj. Blueprint',active: artifacts?.hasProjectBlueprint   ?? false },
    ];
    const loaded = artifacts !== undefined;
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">Artifact:</span>
            {!loaded && (
                <span className="text-slate-400 italic">caricati al prossimo Run</span>
            )}
            {loaded && items.map(({ label, active }) => (
                <Badge
                    key={label}
                    variant="outline"
                    className={`text-[10px] py-0 px-1.5 ${
                        active
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                    }`}
                >
                    {label}
                </Badge>
            ))}
        </div>
    );
}

// ─── HistoryItem ──────────────────────────────────────────────────────────────

function HistoryItem({
    run,
    isActive,
    onSelect,
}: { run: DebugRun; isActive: boolean; onSelect: () => void }) {
    const time = new Date(run.timestamp).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const ok = !run.error;

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-xs ${
                isActive ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {ok
                        ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                    <span className="text-slate-500 shrink-0">{time}</span>
                </div>
                <div className="flex gap-1.5 items-center">
                    {ok && (
                        <>
                            <Badge variant="outline" className={`text-[10px] py-0 px-1 ${
                                run.result.pipelineMode === 'agentic'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-orange-50 text-orange-700'
                            }`}>
                                {run.result.pipelineMode}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-slate-50">
                                {run.result.totalBaseDays.toFixed(1)}g
                            </Badge>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-slate-50">
                                conf {Math.round(run.result.confidenceScore * 100)}%
                            </Badge>
                        </>
                    )}
                    <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{run.durationMs}ms
                    </span>
                </div>
            </div>
            {run.error && (
                <p className="mt-1 text-red-500 text-[10px] truncate">
                    {typeof run.error === 'object'
                        ? (run.error as any)?.message ?? JSON.stringify(run.error)
                        : run.error}
                </p>
            )}
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PipelineDebugTab({
    requirementId,
    description,
    projectId,
    techCategory,
}: PipelineDebugTabProps) {
    const [ks, setKs] = useState<DebugKillSwitches>({ ...DEFAULT_KS });
    const [forceMode, setForceMode] = useState<ForceMode>('default');
    const [ksOpen, setKsOpen] = useState(false);

    const [running, setRunning] = useState(false);
    const [activeRun, setActiveRun] = useState<DebugRun | null>(null);
    const [history, setHistory] = useState<DebugRun[]>(() => loadHistory(requirementId));

    const toggleKs = useCallback((key: keyof DebugKillSwitches) => {
        setKs(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleRun = useCallback(async () => {
        setRunning(true);
        try {
            const run = await runDebugEstimation({
                description,
                techCategory: techCategory || 'MULTI',
                projectId: projectId || undefined,
                requirementId,
                killSwitches: ks,
                forceMode,
            });
            const updated = saveRun(requirementId, run);
            setHistory(updated);
            setActiveRun(run);
        } finally {
            setRunning(false);
        }
    }, [description, techCategory, projectId, ks, forceMode, requirementId]);

    const handleClear = useCallback(() => {
        clearHistory(requirementId);
        setHistory([]);
        setActiveRun(null);
    }, [requirementId]);

    return (
        <div className="h-full overflow-auto bg-slate-50">
            <div className="container mx-auto px-6 py-6 max-w-6xl">

                {/* Context banner */}
                <div className="mb-6 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <FlaskConical className="h-4 w-4 text-indigo-500 shrink-0" />
                        <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                            {techCategory || 'MULTI'}
                        </Badge>
                        {projectId && (
                            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                                project-activity attivo
                            </Badge>
                        )}
                        <span className="text-slate-400 truncate max-w-xs" title={description}>
                            {description.slice(0, 80)}{description.length > 80 ? '…' : ''}
                        </span>
                    </div>
                    {/* Artifact status — updated after each run */}
                    <ArtifactBar artifacts={activeRun?.artifacts} />
                </div>

                <div className="flex gap-6 items-start">

                    {/* ── Left: config ── */}
                    <div className="w-72 shrink-0 space-y-4">

                        {/* Pipeline mode */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500">Pipeline mode</Label>
                                <Select value={forceMode} onValueChange={v => setForceMode(v as ForceMode)}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default" className="text-sm">Default (env)</SelectItem>
                                        <SelectItem value="deterministic" className="text-sm">Force deterministic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Kill switches */}
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setKsOpen(o => !o)}
                                className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
                            >
                                <span className="text-sm font-medium text-slate-700">Kill Switches</span>
                                {ksOpen
                                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                    : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </button>

                            {ksOpen && (
                                <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                                    {KS_GROUPS.map(group => (
                                        <div key={group}>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-3 mb-2">
                                                {group}
                                            </p>
                                            <div className="space-y-2.5">
                                                {KS_TOGGLES.filter(t => t.group === group).map(t => (
                                                    <div key={t.key} className="flex items-center justify-between">
                                                        <Label htmlFor={`req-ks-${t.key}`} className="text-xs text-slate-600 cursor-pointer">
                                                            {t.label}
                                                        </Label>
                                                        <Switch
                                                            id={`req-ks-${t.key}`}
                                                            checked={ks[t.key]}
                                                            onCheckedChange={() => toggleKs(t.key)}
                                                            className="scale-75 origin-right"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2 text-xs"
                                        onClick={() => setKs({ ...DEFAULT_KS })}
                                    >
                                        Reset defaults
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Run */}
                        <Button
                            onClick={handleRun}
                            disabled={running || !description.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                        >
                            {running ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Running…
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Play className="h-4 w-4" />
                                    Run estimation
                                </span>
                            )}
                        </Button>
                    </div>

                    {/* ── Right: results + history ── */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* Active run */}
                        {activeRun && (
                            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-700">Ultima run</p>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />{activeRun.durationMs}ms
                                    </span>
                                </div>

                                {activeRun.error ? (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        {typeof activeRun.error === 'object'
                                            ? (activeRun.error as any)?.message ?? JSON.stringify(activeRun.error)
                                            : activeRun.error}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-3 flex-wrap">
                                            <Badge variant="outline" className="bg-slate-50">
                                                {activeRun.result.totalBaseDays.toFixed(1)} giorni
                                            </Badge>
                                            <Badge variant="outline" className="bg-slate-50">
                                                conf {Math.round(activeRun.result.confidenceScore * 100)}%
                                            </Badge>
                                            <Badge variant="outline" className={
                                                activeRun.result.pipelineMode === 'agentic'
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'bg-orange-50 text-orange-700'
                                            }>
                                                {activeRun.result.pipelineMode}
                                            </Badge>
                                            <Badge variant="outline" className="bg-slate-50">
                                                {(activeRun.result.activities ?? activeRun.result.activitiesSelected).length} attività
                                            </Badge>
                                        </div>

                                        {(activeRun.result.activities?.length ?? 0) > 0 && (
                                            <div className="rounded-lg border border-slate-100 overflow-hidden">
                                                <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex justify-between">
                                                    <span>Attività selezionate ({activeRun.result.activities.length})</span>
                                                    <span>ore base</span>
                                                </div>
                                                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                                    {activeRun.result.activities.map(a => (
                                                        <div key={a.code} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-mono text-[10px] text-indigo-600 shrink-0">{a.code}</span>
                                                                <span className="text-slate-600 truncate">{a.name}</span>
                                                            </div>
                                                            <span className="font-mono text-slate-500 shrink-0 ml-3">{a.baseHours}h</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {activeRun.trace && (
                                            <PipelineTraceCard trace={activeRun.trace} defaultOpen />
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {!activeRun && (
                            <div className="bg-white border border-dashed border-slate-200 rounded-lg p-10 text-center">
                                <FlaskConical className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-400 text-sm">Premi Run per lanciare il pipeline</p>
                            </div>
                        )}

                        {/* History */}
                        {history.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-700">
                                        Storico ({history.length})
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-slate-400 hover:text-red-500 h-7 px-2"
                                        onClick={handleClear}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Cancella
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {history.map(run => (
                                        <HistoryItem
                                            key={run.id}
                                            run={run}
                                            isActive={activeRun?.id === run.id}
                                            onSelect={() => setActiveRun(run)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
