import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    getProjectActivities,
    updateProjectActivity,
    deleteProjectActivity,
    toggleProjectActivity,
} from '@/lib/project-activity-repository';
import type { ProjectActivity, ActivityGroup, InterventionType } from '@/types/project-activity';
import { AddActivityDialog } from './AddActivityDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Color / label maps
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_BAR_COLORS: Record<ActivityGroup, string> = {
    ANALYSIS: 'bg-amber-100 text-amber-700 border-amber-200',
    DEV: 'bg-blue-100 text-blue-700 border-blue-200',
    TEST: 'bg-green-100 text-green-700 border-green-200',
    OPS: 'bg-purple-100 text-purple-700 border-purple-200',
    GOVERNANCE: 'bg-slate-200 text-slate-700 border-slate-300',
};

const GROUP_LABELS: Record<ActivityGroup, string> = {
    ANALYSIS: 'Analysis',
    DEV: 'Dev',
    TEST: 'Test',
    OPS: 'Ops',
    GOVERNANCE: 'Governance',
};

const INTERVENTION_LABELS: Record<InterventionType, string> = {
    NEW: 'New',
    MODIFY: 'Modify',
    CONFIGURE: 'Configure',
    MIGRATE: 'Migrate',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectActivitiesTabProps {
    projectId: string;
}

export function ProjectActivitiesTab({ projectId }: ProjectActivitiesTabProps) {
    const [activities, setActivities] = useState<ProjectActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);

    const loadActivities = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProjectActivities(projectId);
            setActivities(data);
        } catch (e) {
            console.error(e);
            toast.error('Errore nel caricamento delle attività');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    // ── Toggle ────────────────────────────────────────────────────────────────

    const handleToggle = async (activity: ProjectActivity) => {
        if (!activity.id) return;
        const newEnabled = !activity.isEnabled;
        setActivities(prev =>
            prev.map(a => a.id === activity.id ? { ...a, isEnabled: newEnabled } : a),
        );
        try {
            await toggleProjectActivity(activity.id, newEnabled);
        } catch {
            toast.error('Errore nell\'aggiornamento');
            setActivities(prev =>
                prev.map(a => a.id === activity.id ? { ...a, isEnabled: activity.isEnabled } : a),
            );
        }
    };

    // ── Partial update (persisted on blur / select change) ────────────────────

    const persistUpdate = async (id: string, updates: Parameters<typeof updateProjectActivity>[1]) => {
        try {
            await updateProjectActivity(id, updates);
        } catch {
            toast.error('Errore nel salvataggio');
            loadActivities();
        }
    };

    // ── Local update (optimistic, no persist) ─────────────────────────────────

    const updateLocal = (id: string, patch: Partial<ProjectActivity>) => {
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (activity: ProjectActivity) => {
        if (!activity.id) return;
        if (!confirm(`Eliminare l'attività "${activity.name}"?`)) return;
        setActivities(prev => prev.filter(a => a.id !== activity.id));
        try {
            await deleteProjectActivity(activity.id);
            toast.success('Attività eliminata');
        } catch {
            toast.error('Errore nell\'eliminazione');
            loadActivities();
        }
    };

    // ── Derived summary ───────────────────────────────────────────────────────

    const enabledActivities = activities.filter(a => a.isEnabled);
    const totalHours = enabledActivities.reduce(
        (sum, a) => sum + a.baseHours * a.effortModifier,
        0,
    );
    const groupHours = enabledActivities.reduce((acc, a) => {
        acc[a.group] = (acc[a.group] ?? 0) + a.baseHours * a.effortModifier;
        return acc;
    }, {} as Partial<Record<ActivityGroup, number>>);

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Caricamento attività...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4">
            {/* Summary Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{enabledActivities.length}</span>
                        <span className="text-slate-400">/{activities.length}</span>
                        <span className="ml-1">attività attive</span>
                    </span>
                    {totalHours > 0 && (
                        <span className="text-sm font-semibold text-slate-900">
                            {totalHours.toFixed(1)}h totali
                        </span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                        {(Object.entries(groupHours) as [ActivityGroup, number][])
                            .sort(([, a], [, b]) => b - a)
                            .map(([group, hours]) => (
                                <span
                                    key={group}
                                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${GROUP_BAR_COLORS[group]}`}
                                >
                                    {GROUP_LABELS[group]} {hours.toFixed(1)}h
                                </span>
                            ))}
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                </Button>
            </div>

            {/* Table or empty state */}
            {activities.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg">
                    <p className="text-sm">Nessuna attività configurata per questo progetto.</p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setShowAddDialog(true)}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Aggiungi la prima attività
                    </Button>
                </div>
            ) : (
                <div className="max-h-[55vh] overflow-y-auto border rounded-lg">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-8 px-2"></TableHead>
                                <TableHead className="w-32 px-2 text-xs">Codice</TableHead>
                                <TableHead className="px-2 text-xs">Nome</TableHead>
                                <TableHead className="w-32 px-2 text-xs">Gruppo</TableHead>
                                <TableHead className="w-32 px-2 text-xs">Intervento</TableHead>
                                <TableHead className="w-24 px-2 text-xs text-right">Ore Base</TableHead>
                                <TableHead className="w-20 px-2 text-xs text-right">Mod.</TableHead>
                                <TableHead className="w-24 px-2 text-xs text-right">Ore Eff.</TableHead>
                                <TableHead className="w-16 px-2 text-xs text-center">Conf.</TableHead>
                                <TableHead className="w-10 px-2"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activities.map((activity) => (
                                <TableRow
                                    key={activity.id}
                                    className={activity.isEnabled ? '' : 'opacity-50 bg-slate-50'}
                                >
                                    {/* Toggle */}
                                    <TableCell className="px-2 py-1">
                                        <button
                                            type="button"
                                            onClick={() => handleToggle(activity)}
                                            className="flex items-center transition-colors"
                                            title={activity.isEnabled ? 'Disabilita' : 'Abilita'}
                                        >
                                            {activity.isEnabled
                                                ? <ToggleRight className="h-5 w-5 text-blue-500" />
                                                : <ToggleLeft className="h-5 w-5 text-slate-400" />
                                            }
                                        </button>
                                    </TableCell>

                                    {/* Code */}
                                    <TableCell className="px-2 py-1">
                                        <span className="text-xs font-mono text-slate-400 break-all">
                                            {activity.code}
                                        </span>
                                    </TableCell>

                                    {/* Name — inline editable */}
                                    <TableCell className="px-2 py-1">
                                        <Input
                                            className="h-7 text-sm border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1"
                                            value={activity.name}
                                            onChange={(e) => updateLocal(activity.id!, { name: e.target.value })}
                                            onBlur={(e) => {
                                                if (activity.id) persistUpdate(activity.id, { name: e.target.value });
                                            }}
                                        />
                                    </TableCell>

                                    {/* Group — inline Select */}
                                    <TableCell className="px-2 py-1">
                                        <Select
                                            value={activity.group}
                                            onValueChange={(value: ActivityGroup) => {
                                                updateLocal(activity.id!, { group: value });
                                                if (activity.id) persistUpdate(activity.id, { group: value });
                                            }}
                                        >
                                            <SelectTrigger className="h-7 text-xs border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(GROUP_LABELS) as ActivityGroup[]).map(g => (
                                                    <SelectItem key={g} value={g}>{GROUP_LABELS[g]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                    {/* InterventionType — inline Select */}
                                    <TableCell className="px-2 py-1">
                                        <Select
                                            value={activity.interventionType}
                                            onValueChange={(value: InterventionType) => {
                                                updateLocal(activity.id!, { interventionType: value });
                                                if (activity.id) persistUpdate(activity.id, { interventionType: value });
                                            }}
                                        >
                                            <SelectTrigger className="h-7 text-xs border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(INTERVENTION_LABELS) as InterventionType[]).map(t => (
                                                    <SelectItem key={t} value={t}>{INTERVENTION_LABELS[t]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                    {/* Base Hours — inline editable */}
                                    <TableCell className="px-2 py-1">
                                        <Input
                                            type="number"
                                            className="h-7 text-sm text-right border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1 w-full"
                                            value={activity.baseHours}
                                            min={0.125}
                                            max={40}
                                            step={0.125}
                                            onChange={(e) => updateLocal(activity.id!, { baseHours: Number(e.target.value) })}
                                            onBlur={(e) => {
                                                if (activity.id) persistUpdate(activity.id, { baseHours: Number(e.target.value) });
                                            }}
                                        />
                                    </TableCell>

                                    {/* Effort Modifier — inline editable */}
                                    <TableCell className="px-2 py-1">
                                        <Input
                                            type="number"
                                            className="h-7 text-sm text-right border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1 w-full"
                                            value={activity.effortModifier}
                                            min={0.1}
                                            max={3.0}
                                            step={0.1}
                                            onChange={(e) => updateLocal(activity.id!, { effortModifier: Number(e.target.value) })}
                                            onBlur={(e) => {
                                                if (activity.id) persistUpdate(activity.id, { effortModifier: Number(e.target.value) });
                                            }}
                                        />
                                    </TableCell>

                                    {/* Effective Hours — read only */}
                                    <TableCell className="px-2 py-1 text-right">
                                        <span className="text-sm font-medium text-slate-700">
                                            {(activity.baseHours * activity.effortModifier).toFixed(2)}h
                                        </span>
                                    </TableCell>

                                    {/* Confidence */}
                                    <TableCell className="px-2 py-1 text-center">
                                        {activity.confidence != null ? (
                                            <span className={`text-xs font-medium ${
                                                activity.confidence >= 0.8
                                                    ? 'text-green-600'
                                                    : activity.confidence >= 0.6
                                                    ? 'text-amber-600'
                                                    : 'text-red-500'
                                            }`}>
                                                {Math.round(activity.confidence * 100)}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </TableCell>

                                    {/* Delete */}
                                    <TableCell className="px-2 py-1">
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(activity)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                            title="Elimina"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <AddActivityDialog
                projectId={projectId}
                existingActivities={activities}
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSuccess={loadActivities}
            />
        </div>
    );
}
