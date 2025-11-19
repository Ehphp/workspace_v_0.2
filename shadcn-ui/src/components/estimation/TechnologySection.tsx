import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { TechnologyPreset } from '@/types/database';

interface TechnologySectionProps {
    presets: TechnologyPreset[];
    selectedPresetId: string;
    onPresetChange: (presetId: string) => void;
    onApplyTemplate: () => void;
    onAiRecalculate: () => void;
    isAiLoading: boolean;
    requirementDescription: string;
    isExpanded: boolean;
    onToggle: () => void;
}

export function TechnologySection({
    presets,
    selectedPresetId,
    onPresetChange,
    onApplyTemplate,
    onAiRecalculate,
    isAiLoading,
    requirementDescription,
    isExpanded,
    onToggle,
}: TechnologySectionProps) {
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);

    return (
        <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader
                className="pb-3 bg-gradient-to-r from-slate-50 to-blue-50 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold text-slate-900">Scenario & Driver</CardTitle>
                        <CardDescription className="text-xs">
                            Select the technology stack for this requirement
                        </CardDescription>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="space-y-2">
                    <div className="space-y-2">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-xs font-medium mb-1 block">
                                    Technology
                                </label>
                                <Select value={selectedPresetId} onValueChange={onPresetChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select technology..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {presets.map((preset) => (
                                            <SelectItem key={preset.id} value={preset.id}>
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
                                size="default"
                                className="gap-2"
                            >
                                Apply Template
                            </Button>
                        </div>

                        <Button
                            onClick={onAiRecalculate}
                            disabled={isAiLoading || !requirementDescription || !selectedPresetId}
                            variant="default"
                            className="gap-2 w-full"
                        >
                            {isAiLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    AI Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    AI Suggest
                                </>
                            )}
                        </Button>
                    </div>

                    {selectedPreset && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{selectedPreset.tech_category}</Badge>
                                <span className="text-xs text-muted-foreground">
                                    {selectedPreset.description}
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
