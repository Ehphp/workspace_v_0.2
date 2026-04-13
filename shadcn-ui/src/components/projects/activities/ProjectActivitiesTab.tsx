import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    getProjectActivities,
    updateProjectActivity,
    deleteProjectActivity,
    toggleProjectActivity,
} from '@/lib/project-activity-repository';
import type { ProjectActivity, ActivityGroup } from '@/types/project-activity';
import { AddActivityDialog } from './AddActivityDialog';
import { ActivityTable, GROUP_BAR_COLORS, GROUP_LABELS } from './ActivityTable';
import { ActivityDetailSheet } from './ActivityDetailSheet';

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
    const [selectedActivity, setSelectedActivity] = useState<ProjectActivity | null>(null);

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
                <ActivityTable
                    activities={activities}
                    onToggle={handleToggle}
                    onUpdateLocal={updateLocal}
                    onPersistUpdate={persistUpdate}
                    onDelete={handleDelete}
                    onRowClick={setSelectedActivity}
                />
            )}

            <AddActivityDialog
                projectId={projectId}
                existingActivities={activities}
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSuccess={loadActivities}
            />

            <ActivityDetailSheet
                activity={selectedActivity}
                open={!!selectedActivity}
                onOpenChange={(open) => { if (!open) setSelectedActivity(null); }}
            />
        </div>
    );
}
