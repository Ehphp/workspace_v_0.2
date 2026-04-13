import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/PageShell';
import { ActivityTable, GROUP_BAR_COLORS, GROUP_LABELS } from '@/components/projects/activities/ActivityTable';
import { ActivityDetailSheet } from '@/components/projects/activities/ActivityDetailSheet';
import { AddActivityDialog } from '@/components/projects/activities/AddActivityDialog';
import {
    getProjectActivities,
    updateProjectActivity,
    deleteProjectActivity,
    toggleProjectActivity,
} from '@/lib/project-activity-repository';
import { fetchProject } from '@/lib/projects';
import type { Project } from '@/types/database';
import type { ProjectActivity, ActivityGroup } from '@/types/project-activity';

export default function ProjectActivitiesPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [activities, setActivities] = useState<ProjectActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<ProjectActivity | null>(null);

    // ── Load data ─────────────────────────────────────────────────────────────

    const loadActivities = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getProjectActivities(projectId);
            setActivities(data);
        } catch (e) {
            console.error(e);
            toast.error('Errore nel caricamento delle attività');
        }
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [proj] = await Promise.all([
                    fetchProject(projectId),
                    loadActivities(),
                ]);
                setProject(proj);
            } catch (e) {
                console.error(e);
                toast.error('Errore nel caricamento del progetto');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [projectId, loadActivities]);

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
            toast.error("Errore nell'aggiornamento");
            setActivities(prev =>
                prev.map(a => a.id === activity.id ? { ...a, isEnabled: activity.isEnabled } : a),
            );
        }
    };

    // ── Partial update ────────────────────────────────────────────────────────

    const persistUpdate = async (id: string, updates: Partial<ProjectActivity>) => {
        try {
            await updateProjectActivity(id, updates as Parameters<typeof updateProjectActivity>[1]);
        } catch {
            toast.error('Errore nel salvataggio');
            loadActivities();
        }
    };

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
            toast.error("Errore nell'eliminazione");
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

    // ── Loading state ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <PageShell>
                <div className="flex items-center justify-center py-32 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm">Caricamento...</span>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex-shrink-0 relative border-b border-white/50 bg-white/60 backdrop-blur-xl -mx-6 px-6 py-4">
                    <div className="flex items-center justify-between gap-6">
                        {/* Left: Back + Project info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                                onClick={() => navigate(`/dashboard/${projectId}/requirements`)}
                                className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0"
                                title="Torna ai requisiti"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                                <ListChecks className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold text-slate-900 truncate">
                                    Attività — {project?.name}
                                </h1>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Gestisci le attività custom del progetto
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <Link to={`/dashboard/${projectId}/requirements`}>
                                <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 text-sm">
                                    Requisiti
                                </Button>
                            </Link>
                            <Button
                                size="sm"
                                onClick={() => setShowAddDialog(true)}
                                className="rounded-xl h-9 px-3 text-sm"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Aggiungi
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Summary Bar */}
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

                {/* Table or empty state */}
                {activities.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 border border-dashed rounded-lg bg-white">
                        <ListChecks className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm">Nessuna attività configurata per questo progetto.</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Le attività vengono generate automaticamente dal Technical Blueprint, oppure puoi aggiungerle manualmente.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-4"
                            onClick={() => setShowAddDialog(true)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Aggiungi la prima attività
                        </Button>
                    </div>
                ) : (
                    <ActivityTable
                        activities={activities}
                        onToggle={handleToggle}
                        onUpdateLocal={updateLocal}
                        onPersistUpdate={persistUpdate}
                        onDelete={handleDelete}
                        onRowClick={setSelectedActivity}
                        maxHeight="calc(100vh - 280px)"
                    />
                )}
            </div>

            {/* Dialogs */}
            {projectId && (
                <AddActivityDialog
                    projectId={projectId}
                    existingActivities={activities}
                    open={showAddDialog}
                    onOpenChange={setShowAddDialog}
                    onSuccess={loadActivities}
                />
            )}

            <ActivityDetailSheet
                activity={selectedActivity}
                open={!!selectedActivity}
                onOpenChange={(open) => { if (!open) setSelectedActivity(null); }}
            />
        </PageShell>
    );
}
