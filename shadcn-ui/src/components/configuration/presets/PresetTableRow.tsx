import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Info, Edit3, Trash2, Sparkles } from 'lucide-react';
import type { PresetView } from '@/hooks/usePresetManagement';

interface PresetTableRowProps {
    preset: PresetView;
    userId: string | undefined;
    onPreview: (preset: PresetView) => void;
    onEdit: (preset: PresetView) => void;
    onDuplicate: (preset: PresetView) => void;
    onDelete: (preset: PresetView) => void;
}

export function PresetTableRow({
    preset,
    userId,
    onPreview,
    onEdit,
    onDuplicate,
    onDelete,
}: PresetTableRowProps) {
    const isOwner = preset.is_custom && preset.created_by === userId;

    return (
        <TableRow className="hover:bg-slate-50/80 border-slate-100">
            <TableCell className="align-top">
                <div className="font-semibold text-slate-900">{preset.name}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{preset.description}</div>
                {preset.is_custom && (
                    <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Custom</Badge>
                )}
            </TableCell>
            <TableCell className="align-top">
                <Badge variant="outline" className="text-xs border-slate-200 text-slate-600 bg-white">{preset.tech_category}</Badge>
            </TableCell>
            <TableCell className="align-top hidden md:table-cell">
                <div className="flex flex-col gap-1">
                    <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{preset.defaultActivities.length}</span> attività
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {preset.defaultActivities.slice(0, 2).map(a => (
                            <span key={a.id} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                                {a.code}
                            </span>
                        ))}
                        {preset.defaultActivities.length > 2 && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                                +{preset.defaultActivities.length - 2}
                            </span>
                        )}
                    </div>
                </div>
            </TableCell>
            <TableCell className="text-right align-top">
                <div className="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => onPreview(preset)}
                        title="Dettagli"
                    >
                        <Info className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                        onClick={() => onDuplicate(preset)}
                        title="Duplica"
                    >
                        <Sparkles className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => onEdit(preset)}
                                title="Modifica"
                            >
                                <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => onDelete(preset)}
                                title="Elimina"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
