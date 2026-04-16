/**
 * PipelineDebug — /dev/pipeline-debug
 *
 * Dev dashboard per testare e confrontare il pipeline di stima con
 * configurazioni diverse senza toccare l'UI principale.
 *
 * Layout:
 *   Left  — input + kill-switch config
 *   Right — trace espanso + storico (localStorage)
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
    ArrowLeft,
} from 'lucide-react';
import { PipelineTraceCard } from '@/components/estimation/debug/PipelineTraceCard';
import {
    runDebugEstimation,
    saveDebugRun,
    loadDebugHistory,
    clearDebugHistory,
    DEFAULT_KS,
    type DebugRun,
    type DebugKillSwitches,
    type ForceMode,
} from '@/lib/pipeline-debug-api';
import { supabase } from '@/lib/supabase';

// ─── Tech categories ──────────────────────────────────────────────────────────

const TECH_CATS = [
    { value: 'MULTI', label: 'MULTI (generic)' },
    { value: 'PP', label: 'PP (Power Platform)' },
    { value: 'BE', label: 'BE (Backend)' },
    { value: 'FRONTEND', label: 'FRONTEND' },
];

// ─── KS toggle config ─────────────────────────────────────────────────────────

interface KsToggle {
    key: keyof DebugKillSwitches;
    label: string;
    group: 'signals' | 'agent' | 'obs';
}

const KS_TOGGLES: KsToggle[] = [
    { key: 'blueprintSignalEnabled',       label: 'Blueprint signal',        group: 'signals' },
    { key: 'impactMapSignalEnabled',        label: 'Impact-map signal',       group: 'signals' },
    { key: 'understandingSignalEnabled',    label: 'Understanding signal',    group: 'signals' },
    { key: 'projectActivitySignalEnabled',  label: 'Project-activity signal', group: 'signals' },
    { key: 'agenticEnabled',               label: 'Agentic pipeline',        group: 'agent'   },
    { key: 'reflectionEnabled',            label: 'Reflection loop',         group: 'agent'   },
    { key: 'toolUseEnabled',               label: 'Tool use',                group: 'agent'   },
    { key: 'agentDeltaEnabled',            label: 'Agent delta (Δ)',         group: 'obs'     },
];

// ─── HistoryItem subcomponent ─────────────────────────────────────────────────

function HistoryItem({
    run,
    isActive,
    onSelect,
}: {
    run: DebugRun;
    isActive: boolean;
    onSelect: () => void;
}) {
    const time = new Date(run.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ok = !run.error;

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-xs ${
                isActive
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {ok
                        ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        : <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    }
                    <span className="truncate text-slate-700 font-medium">
                        {run.config.description.slice(0, 40)}{run.config.description.length > 40 ? '…' : ''}
                    </span>
                </div>
                <span className="text-slate-400 shrink-0">{time}</span>
            </div>
            <div className="mt-1 flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] py-0 px-1">
                    {run.config.techCategory}
                </Badge>
                {run.config.projectId && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1 bg-violet-50 text-violet-700 border-violet-200">
                        project
                    </Badge>
                )}
                {ok && (
                    <>
                        <Badge variant="outline" className={`text-[10px] py-0 px-1 ${
                            run.result.pipelineMode === 'agentic' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelineDebug() {
    const navigate = useNavigate();

    // ── form state ──
    const [description, setDescription] = useState('');
    const [techCategory, setTechCategory] = useState('MULTI');
    const [projectId, setProjectId] = useState<string>('');
    const [ks, setKs] = useState<DebugKillSwitches>({ ...DEFAULT_KS });
    const [forceMode, setForceMode] = useState<ForceMode>('default');

    // ── projects ──
    const [projects, setProjects] = useState<{ id: string; name: string; technology_id: string | null }[]>([]);

    useEffect(() => {
        supabase
            .from('projects')
            .select('id, name, technology_id')
            .order('name')
            .then(({ data }) => { if (data) setProjects(data); });
    }, []);

    // ── run state ──
    const [running, setRunning] = useState(false);
    const [activeRun, setActiveRun] = useState<DebugRun | null>(null);
    const [history, setHistory] = useState<DebugRun[]>(() => loadDebugHistory());

    // ── UI state ──
    const [ksOpen, setKsOpen] = useState(true);

    const toggleKs = useCallback((key: keyof DebugKillSwitches) => {
        setKs(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleRun = useCallback(async () => {
        if (!description.trim()) return;
        setRunning(true);
        try {
            const run = await runDebugEstimation({
                description,
                techCategory,
                projectId: projectId || undefined,
                killSwitches: ks,
                forceMode,
            });
            const updated = saveDebugRun(run);
            setHistory(updated);
            setActiveRun(run);
        } finally {
            setRunning(false);
        }
    }, [description, techCategory, projectId, ks, forceMode]);

    const handleClearHistory = useCallback(() => {
        clearDebugHistory();
        setHistory([]);
        setActiveRun(null);
    }, []);

    const signalToggles = KS_TOGGLES.filter(t => t.group === 'signals');
    const agentToggles  = KS_TOGGLES.filter(t => t.group === 'agent');
    const obsToggles    = KS_TOGGLES.filter(t => t.group === 'obs');

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                        className="h-8 px-2 text-slate-500 hover:text-slate-900"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>
                    <div className="w-px h-5 bg-slate-200" />
                    <FlaskConical className="h-5 w-5 text-indigo-500" />
                    <div>
                        <h1 className="text-lg font-semibold text-slate-900">Pipeline Debug</h1>
                        <p className="text-xs text-slate-500">Testa il pipeline di stima con configurazioni custom — dev only</p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 items-start">

                {/* ── Left: Config panel ── */}
                <div className="w-80 shrink-0 space-y-4">

                    {/* Description + context */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                        <Label className="text-sm font-medium text-slate-700">Descrizione requisito</Label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Implementare una funzionalità che permette all'utente di..."
                            rows={5}
                            className="text-sm resize-none"
                        />

                        {/* Project */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Progetto (opzionale)</Label>
                            <Select value={projectId || '__none__'} onValueChange={v => setProjectId(v === '__none__' ? '' : v)}>
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Nessun progetto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__" className="text-sm text-slate-400">
                                        Nessun progetto
                                    </SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-sm">
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {projectId && (
                                <p className="text-[10px] text-violet-600">
                                    project-activity signal attivo
                                </p>
                            )}
                        </div>

                        {/* Tech category */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Tech category</Label>
                            <Select value={techCategory} onValueChange={setTechCategory}>
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TECH_CATS.map(c => (
                                        <SelectItem key={c.value} value={c.value} className="text-sm">
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Pipeline mode */}
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
                            {ksOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>

                        {ksOpen && (
                            <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                                {[
                                    { label: 'Signals', toggles: signalToggles },
                                    { label: 'Agent',   toggles: agentToggles  },
                                    { label: 'Obs',     toggles: obsToggles    },
                                ].map(group => (
                                    <div key={group.label}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-3 mb-2">
                                            {group.label}
                                        </p>
                                        <div className="space-y-2.5">
                                            {group.toggles.map(t => (
                                                <div key={t.key} className="flex items-center justify-between">
                                                    <Label htmlFor={t.key} className="text-xs text-slate-600 cursor-pointer">
                                                        {t.label}
                                                    </Label>
                                                    <Switch
                                                        id={t.key}
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

                    {/* Run button */}
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
                                Run
                            </span>
                        )}
                    </Button>
                </div>

                {/* ── Right: Results ── */}
                <div className="flex-1 min-w-0 space-y-4">

                    {/* Active trace */}
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
                                    {/* Summary */}
                                    <div className="flex gap-3 flex-wrap">
                                        <Badge variant="outline" className="bg-slate-50">
                                            {activeRun.result.totalBaseDays.toFixed(1)} giorni
                                        </Badge>
                                        <Badge variant="outline" className="bg-slate-50">
                                            conf {Math.round(activeRun.result.confidenceScore * 100)}%
                                        </Badge>
                                        <Badge variant="outline" className={activeRun.result.pipelineMode === 'agentic' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}>
                                            {activeRun.result.pipelineMode}
                                        </Badge>
                                        <Badge variant="outline" className="bg-slate-50">
                                            {activeRun.result.activitiesSelected.length} attività
                                        </Badge>
                                        {activeRun.config.projectId && (
                                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                                                project ctx
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Activities */}
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

                                    {/* Trace card (expanded by default here) */}
                                    {activeRun.trace && (
                                        <PipelineTraceCard trace={activeRun.trace} defaultOpen />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {!activeRun && (
                        <div className="bg-white border border-dashed border-slate-200 rounded-lg p-12 text-center">
                            <FlaskConical className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-400 text-sm">Inserisci una descrizione e premi Run</p>
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
                                    onClick={handleClearHistory}
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
    );
}
