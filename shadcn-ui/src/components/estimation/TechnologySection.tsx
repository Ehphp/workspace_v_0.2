import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { TechnologyPreset } from '@/types/database';

interface TechnologySectionProps {
    presets: TechnologyPreset[];
    selectedPresetId: string;
    onPresetChange: (presetId: string) => void;
    onApplyTemplate: () => void;
    isExpanded?: boolean;
    onToggle?: () => void;
}

export function TechnologySection({
    presets,
    selectedPresetId,
    onPresetChange,
    onApplyTemplate,
}: TechnologySectionProps) {
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);

    return (
        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">1</span>
                    Tecnologia
                </h3>
                {selectedPreset && (
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] font-medium px-1.5 py-0">
                        {selectedPreset.tech_category}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                    <Select value={selectedPresetId} onValueChange={onPresetChange}>
                        <SelectTrigger className="h-7 text-xs bg-white/80 border-slate-200">
                            <SelectValue placeholder="Seleziona tecnologia..." />
                        </SelectTrigger>
                        <SelectContent>
                            {presets.map((preset) => (
                                <SelectItem key={preset.id} value={preset.id} className="text-xs">
                                    {preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedPreset && selectedPreset.description && (
                <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">{selectedPreset.description}</p>
            )}

            <Button
                onClick={onApplyTemplate}
                disabled={!selectedPresetId}
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            >
                Applica Template
            </Button>
        </div>
    );
}
