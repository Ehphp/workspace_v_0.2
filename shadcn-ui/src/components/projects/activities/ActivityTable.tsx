import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
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
import type { ProjectActivity, ActivityGroup, InterventionType } from '@/types/project-activity';

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants (re-exported for other consumers)
// ─────────────────────────────────────────────────────────────────────────────

export const GROUP_BAR_COLORS: Record<ActivityGroup, string> = {
    ANALYSIS: 'bg-amber-100 text-amber-700 border-amber-200',
    DEV: 'bg-blue-100 text-blue-700 border-blue-200',
    TEST: 'bg-green-100 text-green-700 border-green-200',
    OPS: 'bg-purple-100 text-purple-700 border-purple-200',
    GOVERNANCE: 'bg-slate-200 text-slate-700 border-slate-300',
};

export const GROUP_LABELS: Record<ActivityGroup, string> = {
    ANALYSIS: 'Analysis',
    DEV: 'Dev',
    TEST: 'Test',
    OPS: 'Ops',
    GOVERNANCE: 'Governance',
};

export const INTERVENTION_LABELS: Record<InterventionType, string> = {
    NEW: 'New',
    MODIFY: 'Modify',
    CONFIGURE: 'Configure',
    MIGRATE: 'Migrate',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityTableProps {
    activities: ProjectActivity[];
    onToggle: (activity: ProjectActivity) => void;
    onUpdateLocal: (id: string, patch: Partial<ProjectActivity>) => void;
    onPersistUpdate: (id: string, updates: Partial<ProjectActivity>) => void;
    onDelete: (activity: ProjectActivity) => void;
    onRowClick?: (activity: ProjectActivity) => void;
    maxHeight?: string;
}

export function ActivityTable({
    activities,
    onToggle,
    onUpdateLocal,
    onPersistUpdate,
    onDelete,
    onRowClick,
    maxHeight = '55vh',
}: ActivityTableProps) {
    return (
        <div className={`max-h-[${maxHeight}] overflow-y-auto border rounded-lg`} style={{ maxHeight }}>
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
                            className={`${activity.isEnabled ? '' : 'opacity-50 bg-slate-50'} ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => onRowClick?.(activity)}
                        >
                            {/* Toggle */}
                            <TableCell className="px-2 py-1">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onToggle(activity); }}
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
                            <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    className="h-7 text-sm border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1"
                                    value={activity.name}
                                    onChange={(e) => onUpdateLocal(activity.id!, { name: e.target.value })}
                                    onBlur={(e) => {
                                        if (activity.id) onPersistUpdate(activity.id, { name: e.target.value });
                                    }}
                                />
                            </TableCell>

                            {/* Group — inline Select */}
                            <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Select
                                    value={activity.group}
                                    onValueChange={(value: ActivityGroup) => {
                                        onUpdateLocal(activity.id!, { group: value });
                                        if (activity.id) onPersistUpdate(activity.id, { group: value });
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
                            <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Select
                                    value={activity.interventionType}
                                    onValueChange={(value: InterventionType) => {
                                        onUpdateLocal(activity.id!, { interventionType: value });
                                        if (activity.id) onPersistUpdate(activity.id, { interventionType: value });
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
                            <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    type="number"
                                    className="h-7 text-sm text-right border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1 w-full"
                                    value={activity.baseHours}
                                    min={0.125}
                                    max={40}
                                    step={0.125}
                                    onChange={(e) => onUpdateLocal(activity.id!, { baseHours: Number(e.target.value) })}
                                    onBlur={(e) => {
                                        if (activity.id) onPersistUpdate(activity.id, { baseHours: Number(e.target.value) });
                                    }}
                                />
                            </TableCell>

                            {/* Effort Modifier — inline editable */}
                            <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    type="number"
                                    className="h-7 text-sm text-right border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1 w-full"
                                    value={activity.effortModifier}
                                    min={0.1}
                                    max={3.0}
                                    step={0.1}
                                    onChange={(e) => onUpdateLocal(activity.id!, { effortModifier: Number(e.target.value) })}
                                    onBlur={(e) => {
                                        if (activity.id) onPersistUpdate(activity.id, { effortModifier: Number(e.target.value) });
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
                                    onClick={(e) => { e.stopPropagation(); onDelete(activity); }}
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
    );
}
