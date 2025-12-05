import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Sparkles, Wand2 } from 'lucide-react';
import { useRequirementNormalization } from '@/hooks/useRequirementNormalization';
import type { TechnologyPreset } from '@/types/database';

interface QuickEstimateInputProps {
    description: string;
    onDescriptionChange: (value: string) => void;
    techPresetId: string;
    onPresetChange: (value: string) => void;
    presets: TechnologyPreset[];
    calculating: boolean;
    isDemoMode: boolean;
    error: string | null;
}

export function QuickEstimateInput({
    description,
    onDescriptionChange,
    techPresetId,
    onPresetChange,
    presets,
    calculating,
    isDemoMode,
    error,
}: QuickEstimateInputProps) {
    const { normalize, isNormalizing, normalizationResult, resetNormalization } = useRequirementNormalization();
    const [editedNormalizedDescription, setEditedNormalizedDescription] = useState<string>('');

    useEffect(() => {
        if (normalizationResult?.normalizedDescription) {
            setEditedNormalizedDescription(normalizationResult.normalizedDescription);
        }
    }, [normalizationResult]);

    return (
        <div className="space-y-6">
            {isDemoMode && (
                <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span><strong>Demo Mode:</strong> Using sample data.</span>
                </div>
            )}

            <div className="space-y-4">
                <Label htmlFor="description" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    What would you like to build?
                </Label>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                    <Textarea
                        id="description"
                        placeholder="Describe your project in detail (e.g., A customer loyalty mobile app with QR code scanning, points tracking, and rewards redemption...)"
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        className="relative min-h-[160px] resize-none text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/80 backdrop-blur-sm shadow-sm transition-all rounded-xl p-4 leading-relaxed"
                        disabled={calculating}
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] font-medium text-slate-400 bg-white/90 px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                        {description.length} chars
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-slate-500 font-medium">
                        Be as specific as possible for better accuracy
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => normalize(description)}
                        disabled={isNormalizing || !description || description.length < 10}
                        className="border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm hover:shadow-md bg-white/50"
                    >
                        {isNormalizing ? (
                            <>
                                <Sparkles className="w-3.5 h-3.5 mr-2 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-3.5 h-3.5 mr-2" />
                                Analyze & Improve with AI
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Normalization Result */}
            {normalizationResult && (
                <div className="rounded-2xl border border-indigo-100/50 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ring-1 ring-indigo-100/50">
                    <div className="px-4 py-2.5 bg-indigo-100/30 border-b border-indigo-100/50 flex items-center justify-between backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-indigo-100 rounded-md">
                                <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">AI Analysis</span>
                        </div>
                        <Badge variant={normalizationResult.isValidRequirement ? "default" : "destructive"} className={`text-[10px] py-0.5 h-5 font-semibold shadow-sm ${normalizationResult.isValidRequirement ? 'bg-green-600 hover:bg-green-700' : ''}`}>
                            {normalizationResult.isValidRequirement ? 'Valid Requirement' : 'Needs Attention'}
                        </Badge>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                                <Label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Original Request</Label>
                                <div className="w-full bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto shadow-inner">
                                    {normalizationResult.originalDescription}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1.5 pl-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    AI Suggestion
                                </Label>
                                <textarea
                                    value={editedNormalizedDescription}
                                    onChange={(e) => setEditedNormalizedDescription(e.target.value)}
                                    className="w-full bg-white p-3 rounded-xl border border-indigo-200 text-xs text-slate-800 leading-relaxed max-h-32 overflow-y-auto resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all hover:border-indigo-300"
                                    rows={4}
                                />
                            </div>
                        </div>

                        {normalizationResult.validationIssues?.length > 0 && (
                            <div className="space-y-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100/60">
                                <Label className="text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Attention Required ({normalizationResult.validationIssues.length})
                                </Label>
                                <ul className="pl-1 space-y-1.5">
                                    {normalizationResult.validationIssues.slice(0, 3).map((issue, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[11px] text-amber-900/80 leading-snug">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-1 border-t border-indigo-100/30">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetNormalization}
                                className="text-xs h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                            >
                                Discard Changes
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    onDescriptionChange(editedNormalizedDescription);
                                    resetNormalization();
                                    setEditedNormalizedDescription('');
                                }}
                                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 rounded-lg px-4"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Apply Improvement
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3 pt-2">
                <Label htmlFor="technology" className="text-sm font-semibold text-slate-700">
                    Technology Stack
                </Label>
                <Select
                    value={techPresetId}
                    onValueChange={onPresetChange}
                    disabled={calculating}
                >
                    <SelectTrigger id="technology" className="h-12 border-slate-200 focus:ring-blue-500/20 bg-white/80 backdrop-blur-sm shadow-sm rounded-xl px-4 text-base">
                        <SelectValue placeholder="Select technology..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {presets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id} className="py-3">
                                <span className="font-medium">{preset.name}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-3 shadow-sm">
                    <div className="p-2 bg-red-100/50 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="mt-1">{error}</span>
                </div>
            )}
        </div>
    );
}
