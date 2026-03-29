import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Layers, Search, Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Activity } from '@/types/database';

interface AvailableActivitiesPanelProps {
    activities: Activity[];
    selectedActivityIds: string[];
    aiSuggestedIds: string[];
    onActivityToggle: (activityId: string) => void;
}

const groupOrder = ['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'];
const groupLabels: Record<string, string> = {
    ANALYSIS: 'Analisi',
    DEV: 'Sviluppo',
    TEST: 'Testing',
    OPS: 'Operations',
    GOVERNANCE: 'Governance',
};

export function AvailableActivitiesPanel({
    activities,
    selectedActivityIds,
    aiSuggestedIds,
    onActivityToggle,
}: AvailableActivitiesPanelProps) {
    const [search, setSearch] = useState('');
    const selectedSet = new Set(selectedActivityIds);

    const availableActivities = activities.filter((a) => !selectedSet.has(a.id));

    const filtered = search.trim()
        ? availableActivities.filter((a) =>
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.code.toLowerCase().includes(search.toLowerCase())
        )
        : availableActivities;

    const grouped = filtered.reduce((acc, activity) => {
        if (!acc[activity.group]) acc[activity.group] = [];
        acc[activity.group].push(activity);
        return acc;
    }, {} as Record<string, Activity[]>);

    return (
        <div className="h-full flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Attività Disponibili
                </h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500">
                    {availableActivities.length}
                </Badge>
            </div>

            {/* Search */}
            <div className="shrink-0 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                    placeholder="Cerca attività..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 text-xs pl-7 bg-slate-50 border-slate-200"
                />
            </div>

            {/* Activities list */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-3 pr-2">
                    {filtered.length === 0 && (
                        <EmptyState
                            icon={Layers}
                            title={search ? 'Nessun risultato' : 'Tutte le attività sono selezionate'}
                            className="p-6"
                        />
                    )}

                    {groupOrder.map((group) => {
                        const groupActivities = grouped[group] || [];
                        if (groupActivities.length === 0) return null;

                        return (
                            <div key={group}>
                                <div className="text-[9px] font-semibold uppercase text-slate-400 mb-1.5 px-1">
                                    {groupLabels[group]}
                                </div>
                                <div className="space-y-1">
                                    {groupActivities.map((activity) => {
                                        const isAiSuggested = aiSuggestedIds.includes(activity.id);
                                        return (
                                            <div
                                                key={activity.id}
                                                className="group cursor-pointer rounded-lg p-2 text-[11px] flex items-center gap-2 transition-all bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                                                onClick={() => onActivityToggle(activity.id)}
                                            >
                                                <div className="w-5 h-5 shrink-0 rounded-md border border-slate-300 bg-white flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-50 transition-colors">
                                                    <Plus className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                                <span className="font-medium text-slate-700 truncate flex-1" title={activity.name}>
                                                    {activity.name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono shrink-0">{activity.base_hours}h</span>
                                                {isAiSuggested && (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 shrink-0 font-medium">AI</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
