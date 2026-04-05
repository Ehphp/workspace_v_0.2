/**
 * BlueprintRelationReviewCard — per-relation curation card
 *
 * Supports: view, edit type, remove. Used in the review flow
 * for curating relation data extracted by AI.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Trash2, ArrowRight } from 'lucide-react';
import type { BlueprintRelation, BlueprintRelationType } from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const RELATION_TYPE_OPTIONS: { value: BlueprintRelationType; label: string }[] = [
    { value: 'reads', label: 'Reads' },
    { value: 'writes', label: 'Writes' },
    { value: 'orchestrates', label: 'Orchestrates' },
    { value: 'syncs', label: 'Syncs' },
    { value: 'owns', label: 'Owns' },
    { value: 'depends_on', label: 'Depends On' },
];

const RELATION_TYPE_COLORS: Record<BlueprintRelationType, string> = {
    reads: 'bg-sky-100 text-sky-700',
    writes: 'bg-amber-100 text-amber-700',
    orchestrates: 'bg-indigo-100 text-indigo-700',
    syncs: 'bg-teal-100 text-teal-700',
    owns: 'bg-emerald-100 text-emerald-700',
    depends_on: 'bg-red-100 text-red-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BlueprintRelationReviewCardProps {
    relation: BlueprintRelation;
    index: number;
    /** Map of nodeId → human-readable label */
    nodeLabels: Map<string, string>;
    onUpdateType: (index: number, type: BlueprintRelationType) => void;
    onRemove: (index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BlueprintRelationReviewCard({
    relation,
    index,
    nodeLabels,
    onUpdateType,
    onRemove,
}: BlueprintRelationReviewCardProps) {
    const fromLabel = nodeLabels.get(relation.fromNodeId) ?? relation.fromNodeId;
    const toLabel = nodeLabels.get(relation.toNodeId) ?? relation.toNodeId;
    const typeColor = RELATION_TYPE_COLORS[relation.type] ?? 'bg-slate-100 text-slate-600';

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
            {/* From → To */}
            <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]" title={fromLabel}>
                {fromLabel}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]" title={toLabel}>
                {toLabel}
            </span>

            {/* Type selector */}
            <Select
                value={relation.type}
                onValueChange={(v) => onUpdateType(index, v as BlueprintRelationType)}
            >
                <SelectTrigger className="h-6 w-[110px] text-[10px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {RELATION_TYPE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">
                            {r.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Confidence */}
            {relation.confidence != null && (
                <span className="text-[10px] text-slate-400 tabular-nums">
                    {Math.round(relation.confidence * 100)}%
                </span>
            )}

            {/* Remove */}
            <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500 ml-auto"
                onClick={() => onRemove(index)}
            >
                <Trash2 className="w-3 h-3" />
            </Button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Relation Dialog (inline)
// ─────────────────────────────────────────────────────────────────────────────

interface AddRelationInlineProps {
    availableNodes: { id: string; label: string }[];
    onAdd: (fromNodeId: string, toNodeId: string, type: BlueprintRelationType) => void;
    onCancel: () => void;
}

export function AddRelationInline({ availableNodes, onAdd, onCancel }: AddRelationInlineProps) {
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [type, setType] = useState<BlueprintRelationType>('depends_on');

    const canAdd = from && to && from !== to;

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="h-6 w-[130px] text-[10px]">
                    <SelectValue placeholder="From…" />
                </SelectTrigger>
                <SelectContent>
                    {availableNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">{n.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <ArrowRight className="w-3 h-3 text-blue-400 flex-shrink-0" />

            <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="h-6 w-[130px] text-[10px]">
                    <SelectValue placeholder="To…" />
                </SelectTrigger>
                <SelectContent>
                    {availableNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">{n.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={type} onValueChange={(v) => setType(v as BlueprintRelationType)}>
                <SelectTrigger className="h-6 w-[100px] text-[10px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {RELATION_TYPE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                size="sm"
                variant="default"
                className="h-6 text-[10px] px-2"
                onClick={() => canAdd && onAdd(from, to, type)}
                disabled={!canAdd}
            >
                Add
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={onCancel}
            >
                Cancel
            </Button>
        </div>
    );
}

// Need useState import
import { useState } from 'react';
