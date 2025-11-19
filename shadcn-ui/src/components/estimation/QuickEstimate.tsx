import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_TECHNOLOGY_PRESETS } from '@/lib/mockData';
import { calculateQuickEstimation } from '@/lib/estimationEngine';
import type { TechnologyPreset } from '@/types/database';

interface QuickEstimateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QuickEstimate({ open, onOpenChange }: QuickEstimateProps) {
    const [description, setDescription] = useState('');
    const [techPresetId, setTechPresetId] = useState('');
    const [presets, setPresets] = useState<TechnologyPreset[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        if (open) {
            loadPresets();
            // Reset form when dialog opens
            setDescription('');
            setTechPresetId('');
            setResult(null);
        }
    }, [open]);

    const loadPresets = async () => {
        setLoading(true);
        try {
            const { data: presetsData, error } = await supabase
                .from('technology_presets')
                .select('*')
                .order('name');

            if (error || !presetsData || presetsData.length === 0) {
                setPresets(MOCK_TECHNOLOGY_PRESETS);
                setIsDemoMode(true);
            } else {
                setPresets(presetsData);
                setIsDemoMode(false);
            }
        } catch (error) {
            setPresets(MOCK_TECHNOLOGY_PRESETS);
            setIsDemoMode(true);
        }
        setLoading(false);
    };

    const handleCalculate = () => {
        if (!description.trim() || !techPresetId) return;

        const selectedPreset = presets.find(p => p.id === techPresetId);
        const estimatedDays = calculateQuickEstimation(description, selectedPreset?.name || '');
        setResult(estimatedDays);
    };

    const handleReset = () => {
        setDescription('');
        setTechPresetId('');
        setResult(null);
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    const canCalculate = description.trim().length > 0 && techPresetId !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <div>
                            <DialogTitle className="text-2xl">Quick Estimate</DialogTitle>
                            <DialogDescription>
                                Get a fast estimate with just description and technology
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {isDemoMode && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>
                            <strong>Demo Mode:</strong> Using sample data with simplified calculations
                        </span>
                    </div>
                )}

                <div className="space-y-6 py-4">
                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="flex items-center gap-2">
                            <span className="font-semibold">Requirement Description</span>
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Describe your requirement... (e.g., 'Create a user authentication system with login, registration, and password reset')"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[120px] resize-none"
                            disabled={loading || result !== null}
                        />
                        <p className="text-xs text-slate-500">
                            {description.length} characters
                        </p>
                    </div>

                    {/* Technology */}
                    <div className="space-y-2">
                        <Label htmlFor="technology" className="flex items-center gap-2">
                            <span className="font-semibold">Technology Stack</span>
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                        </Label>
                        <Select
                            value={techPresetId}
                            onValueChange={setTechPresetId}
                            disabled={loading || result !== null}
                        >
                            <SelectTrigger id="technology">
                                <SelectValue placeholder="Select a technology stack..." />
                            </SelectTrigger>
                            <SelectContent>
                                {presets.map((preset) => (
                                    <SelectItem key={preset.id} value={preset.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{preset.name}</span>
                                            {preset.description && (
                                                <span className="text-xs text-slate-500">
                                                    - {preset.description}
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Choose the technology stack that best matches your requirement
                        </p>
                    </div>

                    {/* Result */}
                    {result !== null && (
                        <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                    <svg
                                        className="w-6 h-6 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Estimated Effort</h3>
                                    <p className="text-sm text-slate-600">Quick calculation complete</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600">Total Days</span>
                                    <span className="text-3xl font-bold text-emerald-600">
                                        {result.toFixed(1)}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                                    <p className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        This is a simplified estimate. For detailed breakdown with activities, drivers, and risks, use the full 5-step wizard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                    >
                        Close
                    </Button>
                    <div className="flex gap-2">
                        {result !== null && (
                            <Button
                                variant="outline"
                                onClick={handleReset}
                            >
                                New Estimate
                            </Button>
                        )}
                        <Button
                            onClick={handleCalculate}
                            disabled={!canCalculate || loading}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                            {loading ? 'Loading...' : result !== null ? 'Recalculate' : 'Calculate'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
