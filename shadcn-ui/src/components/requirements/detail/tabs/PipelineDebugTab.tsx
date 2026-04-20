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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { PipelineTraceCard } from '@/components/estimation/debug/PipelineTraceCard';
import { ActivityTable } from '@/components/estimation/debug/ActivityTable';
import {
    runDebugEstimation,
    runFullDebugPipeline,
    DEFAULT_KS,
    type DebugRun,
    type DebugActivity,
    type DebugArtifacts,
    type DebugKillSwitches,
    type ForceMode,
    type DebugStep,
    type FullDebugRun,
} from '@/lib/pipeline-debug-api';
import { FullPipelineTimeline } from '@/components/estimation/debug/FullPipelineTimeline';

// ─── Types ────────────────────────────────────────────────────────────────────

type DebugMode = 'estimate' | 'full';

interface PipelineDebugTabProps {
    requirementId: string;
    description: string;
    projectId?: string;
    techCategory?: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const lsKey     = (id: string) => `pipeline_debug_req_${id}`;
const lsKeyFull = (id: string) => `pipeline_debug_full_req_${id}`;
const MAX_RUNS = 10;
const MAX_FULL_RUNS = 5;

function loadHistory(reqId: string): DebugRun[] {
    try { return JSON.parse(localStorage.getItem(lsKey(reqId)) ?? '[]'); }
    catch { return []; }
}
function saveRun(reqId: string, run: DebugRun): DebugRun[] {
    const updated = [run, ...loadHistory(reqId)].slice(0, MAX_RUNS);
    localStorage.setItem(lsKey(reqId), JSON.stringify(updated));
    return updated;
}
function clearHistory(reqId: string): void { localStorage.removeItem(lsKey(reqId)); }

function loadFullHistory(reqId: string): FullDebugRun[] {
    try { return JSON.parse(localStorage.getItem(lsKeyFull(reqId)) ?? '[]'); }
    catch { return []; }
}
function saveFullRun(reqId: string, run: FullDebugRun): FullDebugRun[] {
    const updated = [run, ...loadFullHistory(reqId)].slice(0, MAX_FULL_RUNS);
    localStorage.setItem(lsKeyFull(reqId), JSON.stringify(updated));
    return updated;
}
function clearFullHistory(reqId: string): void { localStorage.removeItem(lsKeyFull(reqId)); }

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

// ─── Extract estimate result from full pipeline steps ─────────────────────────

function extractEstimateResult(steps: DebugStep[]) {
    const step = steps.find(s => s.id === 'estimate');
    if (!step?.response || step.status !== 'success') return null;
    const data = step.response as any;

    const provByCode = new Map((data.candidateProvenance ?? []).map((p: any) => [p.code, p]));
    const activities: DebugActivity[] = (data.activities ?? []).map((a: any) => {
        const prov = provByCode.get(a.code) as any;
        return {
            code: a.code,
            name: a.name,
            baseHours: a.baseHours,
            score: prov?.score,
            primarySource: prov?.primarySource,
            contributions: prov ? {
                blueprint: prov.contributions?.blueprint ?? 0,
                impactMap: prov.contributions?.impactMap ?? 0,
                understanding: prov.contributions?.understanding ?? 0,
                keyword: prov.contributions?.keyword ?? 0,
                projectContext: prov.contributions?.projectContext ?? 0,
                projectActivity: prov.contributions?.projectActivity ?? 0,
            } : undefined,
            reason: a.reason,
        };
    });

    return {
        totalBaseDays: data.totalBaseDays ?? 0,
        confidenceScore: data.confidenceScore ?? 0,
        pipelineMode: data.pipelineTrace?.pipelineMode ?? 'unknown',
        activities,
        trace: data.pipelineTrace,
        decisionTrace: data.decisionTrace,
    };
}

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
    const [debugMode, setDebugMode] = useState<DebugMode>('estimate');
    const [ks, setKs] = useState<DebugKillSwitches>({ ...DEFAULT_KS });
    const [forceMode, setForceMode] = useState<ForceMode>('default');
    const [ksOpen, setKsOpen] = useState(false);

    const [running, setRunning] = useState(false);

    // Estimate mode state
    const [activeRun, setActiveRun] = useState<DebugRun | null>(null);
    const [history, setHistory] = useState<DebugRun[]>(() => loadHistory(requirementId));

    // Full pipeline mode state
    const [liveSteps, setLiveSteps] = useState<DebugStep[] | null>(null);
    const [activeFullRun, setActiveFullRun] = useState<FullDebugRun | null>(null);
    const [fullHistory, setFullHistory] = useState<FullDebugRun[]>(() => loadFullHistory(requirementId));

    const toggleKs = useCallback((key: keyof DebugKillSwitches) => {
        setKs(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleRun = useCallback(async () => {
        setRunning(true);
        const runConfig = {
            description,
            techCategory: techCategory || 'MULTI',
            projectId: projectId || undefined,
            requirementId,
            killSwitches: ks,
            forceMode,
        };

        if (debugMode === 'estimate') {
            try {
                const run = await runDebugEstimation(runConfig);
                const updated = saveRun(requirementId, run);
                setHistory(updated);
                setActiveRun(run);
            } finally {
                setRunning(false);
            }
        } else {
            setLiveSteps(null);
            try {
                const run = await runFullDebugPipeline(runConfig, setLiveSteps);
                const updated = saveFullRun(requirementId, run);
                setFullHistory(updated);
                setActiveFullRun(run);
                setLiveSteps(null);
            } finally {
                setRunning(false);
            }
        }
    }, [description, techCategory, projectId, ks, forceMode, requirementId, debugMode]);

    const handleClear = useCallback(() => {
        if (debugMode === 'estimate') {
            clearHistory(requirementId);
            setHistory([]);
            setActiveRun(null);
        } else {
            clearFullHistory(requirementId);
            setFullHistory([]);
            setActiveFullRun(null);
        }
    }, [requirementId, debugMode]);

    return (
        <div className="h-full overflow-auto bg-slate-50">
            <div className="container mx-auto px-6 py-6 max-w-6xl">

                {/* Mode toggle */}
                <TooltipProvider delayDuration={300}>
                    <div className="mb-4 flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setDebugMode('estimate')}
                                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                        debugMode === 'estimate'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Stima Finale
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs leading-snug">
                                Riusa gli artefatti già salvati nel DB (Understanding, Impact Map, Blueprint) e chiama direttamente <strong>ai-estimate-from-interview</strong> con i signal attivi. Utile per testare solo la fase di stima e l'agente.
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setDebugMode('full')}
                                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                        debugMode === 'full'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Full Pipeline
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs leading-snug">
                                Rigenera tutti gli artefatti da zero (Validate → Understanding → Impact Map → Blueprint → Interview → Stima). Ogni step mostra request e response. Utile per debuggare l'intera catena di generazione.
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>

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
                                    <p className="text-[10px] text-slate-400 italic mt-3 leading-snug">
                                        {debugMode === 'full'
                                            ? 'In Full Pipeline: disabilitare un signal salta la generazione dell\'artefatto e lo esclude dal contesto degli step successivi.'
                                            : 'In Stima Finale: i signal controllano quali artefatti (già in DB) vengono passati all\'agente durante la stima.'}
                                    </p>
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

                        {debugMode === 'estimate' ? (
                            <>
                                {/* Active estimate run */}
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
                                                    <ActivityTable activities={activeRun.result.activities} />
                                                )}
                                                {activeRun.trace && (
                                                    <PipelineTraceCard
                                                        trace={activeRun.trace}
                                                        decisionTrace={activeRun.decisionTrace}
                                                        candidateProvenance={activeRun.result.activities}
                                                        defaultOpen
                                                    />
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
                                {history.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-slate-700">Storico ({history.length})</p>
                                            <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-red-500 h-7 px-2" onClick={handleClear}>
                                                <Trash2 className="h-3 w-3 mr-1" />Cancella
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {history.map(run => (
                                                <HistoryItem key={run.id} run={run} isActive={activeRun?.id === run.id} onSelect={() => setActiveRun(run)} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Full pipeline live/result view */}
                                {(liveSteps || activeFullRun) && (() => {
                                    const steps = liveSteps ?? activeFullRun!.steps;
                                    const estimateResult = extractEstimateResult(steps);
                                    return (
                                        <>
                                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                                <FullPipelineTimeline
                                                    steps={steps}
                                                    totalDurationMs={liveSteps ? undefined : activeFullRun!.totalDurationMs}
                                                />
                                            </div>
                                            {estimateResult && (
                                                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                                    <p className="text-sm font-medium text-slate-700">Risultato Stima</p>
                                                    <div className="flex gap-3 flex-wrap">
                                                        <Badge variant="outline" className="bg-slate-50">
                                                            {estimateResult.totalBaseDays.toFixed(1)} giorni
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-slate-50">
                                                            conf {Math.round(estimateResult.confidenceScore * 100)}%
                                                        </Badge>
                                                        <Badge variant="outline" className={
                                                            estimateResult.pipelineMode === 'agentic'
                                                                ? 'bg-indigo-50 text-indigo-700'
                                                                : 'bg-orange-50 text-orange-700'
                                                        }>
                                                            {estimateResult.pipelineMode}
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-slate-50">
                                                            {estimateResult.activities.length} attività
                                                        </Badge>
                                                    </div>
                                                    {estimateResult.activities.length > 0 && (
                                                        <ActivityTable activities={estimateResult.activities} />
                                                    )}
                                                    {estimateResult.trace && (
                                                        <PipelineTraceCard
                                                            trace={estimateResult.trace}
                                                            decisionTrace={estimateResult.decisionTrace}
                                                            candidateProvenance={estimateResult.activities}
                                                            defaultOpen
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {!liveSteps && !activeFullRun && (
                                    <div className="bg-white border border-dashed border-slate-200 rounded-lg p-10 text-center">
                                        <FlaskConical className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">Premi Run per eseguire il pipeline completo</p>
                                    </div>
                                )}
                                {fullHistory.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-slate-700">Storico ({fullHistory.length})</p>
                                            <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-red-500 h-7 px-2" onClick={handleClear}>
                                                <Trash2 className="h-3 w-3 mr-1" />Cancella
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {fullHistory.map(run => {
                                                const errors = run.steps.filter(s => s.status === 'error').length;
                                                const time = new Date(run.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                return (
                                                    <button
                                                        key={run.id}
                                                        onClick={() => { setActiveFullRun(run); setLiveSteps(null); }}
                                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-xs ${
                                                            activeFullRun?.id === run.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                {errors === 0
                                                                    ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                                    : <XCircle className="h-3 w-3 text-red-500" />}
                                                                <span className="text-slate-500">{time}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                {errors > 0 && (
                                                                    <Badge variant="outline" className="text-[10px] py-0 px-1 bg-red-50 text-red-700">
                                                                        {errors} err
                                                                    </Badge>
                                                                )}
                                                                <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                                                                    <Clock className="h-2.5 w-2.5" />{run.totalDurationMs}ms
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
