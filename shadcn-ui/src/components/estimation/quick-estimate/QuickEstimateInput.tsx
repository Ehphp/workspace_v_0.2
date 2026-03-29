import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import type { Technology } from '@/types/database';

interface QuickEstimateInputProps {
    description: string;
    onDescriptionChange: (value: string) => void;
    techPresetId: string;
    onPresetChange: (value: string) => void;
    presets: Technology[];
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

                <p className="text-xs text-slate-500 font-medium">
                    Be as specific as possible for better accuracy
                </p>
            </div>

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
