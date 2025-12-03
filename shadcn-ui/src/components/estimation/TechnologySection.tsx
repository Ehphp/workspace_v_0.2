import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TechnologyPreset } from '@/types/database';

interface TechnologySectionProps {
    presets: TechnologyPreset[];
    selectedPresetId: string;
    onPresetChange: (presetId: string) => void;
    onApplyTemplate: () => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export function TechnologySection({
    presets,
    selectedPresetId,
    onPresetChange,
    onApplyTemplate,
    isExpanded,
    onToggle,
}: TechnologySectionProps) {
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);

    return (
        <Card className="rounded-lg shadow-sm border-slate-200 bg-white">
            <CardHeader
                className="pb-2 pt-3 px-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                        </div>
                        <div>
                            <CardTitle className="text-xs font-semibold text-slate-900">Technology</CardTitle>
                            {selectedPreset && (
                                <CardDescription className="text-[10px]">{selectedPreset.name}</CardDescription>
                            )}
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="px-3 pb-3 pt-0 space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Select value={selectedPresetId} onValueChange={onPresetChange}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select..." />
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

                        <Button
                            onClick={onApplyTemplate}
                            disabled={!selectedPresetId}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-2"
                        >
                            Apply
                        </Button>
                    </div>

                    {selectedPreset && selectedPreset.description && (
                        <p className="text-[10px] text-slate-500 leading-tight">{selectedPreset.description}</p>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
