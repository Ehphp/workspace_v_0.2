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
import { MOCK_TECHNOLOGY_PRESETS, MOCK_ACTIVITIES, MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import { calculateEstimation } from '@/lib/estimationEngine';
import { suggestActivities } from '@/lib/openai';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';

interface QuickEstimateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QuickEstimate({ open, onOpenChange }: QuickEstimateProps) {
    const [description, setDescription] = useState('');
    const [techPresetId, setTechPresetId] = useState('');
    const [presets, setPresets] = useState<TechnologyPreset[]>([]);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [result, setResult] = useState<EstimationResult | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedActivities, setSelectedActivities] = useState<Array<{ code: string; name: string; baseDays: number }>>([]);
    const [aiReasoning, setAiReasoning] = useState<string>('');

    useEffect(() => {
        if (open) {
            loadPresets();
            // Reset form when dialog opens
            setDescription('');
            setTechPresetId('');
            setResult(null);
            setError(null);
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

    const handleCalculate = async () => {
        if (!description.trim() || !techPresetId) return;

        // Validate minimum description length
        if (description.trim().length < 10) {
            setError('Please provide a more detailed description (at least 10 characters).');
            return;
        }

        const selectedPreset = presets.find(p => p.id === techPresetId);
        if (!selectedPreset) return;

        setCalculating(true);
        setError(null);

        try {
            // Load activities, drivers, and risks
            const [activitiesResult, driversResult, risksResult] = await Promise.all([
                supabase.from('activities').select('*').eq('active', true),
                supabase.from('drivers').select('*'),
                supabase.from('risks').select('*'),
            ]);

            let allActivities: Activity[];
            let allDrivers: Driver[];
            let allRisks: Risk[];

            // Use mock data if database is not available
            if (activitiesResult.error || !activitiesResult.data || activitiesResult.data.length === 0 ||
                driversResult.error || !driversResult.data || driversResult.data.length === 0 ||
                risksResult.error || !risksResult.data || risksResult.data.length === 0) {
                allActivities = MOCK_ACTIVITIES;
                allDrivers = MOCK_DRIVERS;
                allRisks = MOCK_RISKS;
            } else {
                allActivities = activitiesResult.data;
                allDrivers = driversResult.data;
                allRisks = risksResult.data;
            }

            // Get AI suggestions
            const aiSuggestion = await suggestActivities({
                description,
                preset: selectedPreset,
                activities: allActivities,
                drivers: allDrivers,
                risks: allRisks,
            });

            // Check if the requirement is valid
            if (!aiSuggestion.isValidRequirement) {
                setError(
                    aiSuggestion.reasoning ||
                    'The requirement description is not valid or clear enough. Please provide a meaningful description of what needs to be developed.'
                );
                return;
            }

            // Check if GPT suggested any activities
            if (!aiSuggestion.activityCodes || aiSuggestion.activityCodes.length === 0) {
                setError(
                    aiSuggestion.reasoning ||
                    'The description is too short or unclear. Please provide more details about the requirement.'
                );
                return;
            }

            // Prepare selected activities with base days
            const selectedActivitiesForCalc = aiSuggestion.activityCodes.map((code) => {
                const activity = allActivities.find((a) => a.code === code);
                return {
                    code,
                    baseDays: activity?.base_days || 0,
                    isAiSuggested: true,
                };
            });

            // Store activities with full details for display
            const activitiesWithDetails = aiSuggestion.activityCodes.map((code) => {
                const activity = allActivities.find((a) => a.code === code);
                return {
                    code,
                    name: activity?.name || code,
                    baseDays: activity?.base_days || 0,
                };
            });

            // NO drivers and risks - GPT suggests only activities
            // Users will add drivers and risks manually if needed
            const selectedDrivers: any[] = [];
            const selectedRisks: any[] = [];

            // Calculate estimation with only activities (no multipliers or risks)
            const estimationResult = calculateEstimation({
                activities: selectedActivitiesForCalc,
                drivers: selectedDrivers,
                risks: selectedRisks,
            });

            setResult(estimationResult);
            setSelectedActivities(activitiesWithDetails);
            setAiReasoning(aiSuggestion.reasoning || '');
        } catch (err) {
            console.error('Error calculating quick estimate:', err);
            setError(err instanceof Error ? err.message : 'Failed to calculate estimate');
        } finally {
            setCalculating(false);
        }
    };

    const handleReset = () => {
        setDescription('');
        setTechPresetId('');
        setResult(null);
        setError(null);
        setSelectedActivities([]);
        setAiReasoning('');
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    const canCalculate = description.trim().length > 0 && techPresetId !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
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

                <div className="overflow-y-auto flex-1 -mx-6 px-6">
                    {isDemoMode && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2 mb-4">
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

                        {/* Error */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>
                                    <strong>Error:</strong> {error}
                                </span>
                            </div>
                        )}

                        {/* Result */}
                        {result !== null && (
                            <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 space-y-4">
                                <div className="flex items-center gap-3">
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
                                        <p className="text-sm text-slate-600">AI-powered calculation complete</p>
                                    </div>
                                </div>

                                {/* Total Days - Highlighted */}
                                <div className="bg-white rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-slate-600">Total Days</span>
                                        <span className="text-3xl font-bold text-emerald-600">
                                            {result.totalDays.toFixed(1)}
                                        </span>
                                    </div>
                                </div>

                                {/* Activities Breakdown */}
                                <div className="bg-white rounded-lg p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        AI-Selected Activities ({selectedActivities.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedActivities.map((activity, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-sm py-2 border-b border-slate-100 last:border-0">
                                                <div className="flex-1">
                                                    <Badge variant="secondary" className="text-xs mb-1">{activity.code}</Badge>
                                                    <p className="text-slate-700">{activity.name}</p>
                                                </div>
                                                <span className="font-semibold text-slate-900 ml-2">{activity.baseDays.toFixed(1)}d</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Calculation Details */}
                                <div className="bg-white rounded-lg p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Calculation Breakdown
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-600">Base Days (sum of activities)</span>
                                            <span className="font-semibold text-slate-900">{result.baseDays.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-600">Driver Multiplier</span>
                                            <span className="font-semibold text-slate-900">{result.driverMultiplier.toFixed(2)}x</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-t border-slate-200 pt-2">
                                            <span className="text-slate-600">Subtotal</span>
                                            <span className="font-semibold text-slate-900">{result.subtotal.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-600">Risk Score</span>
                                            <span className="font-semibold text-slate-900">{result.riskScore}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-600">Contingency</span>
                                            <span className="font-semibold text-slate-900">{result.contingencyPercent}% (+{result.contingencyDays.toFixed(1)} days)</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-t-2 border-emerald-200 pt-3">
                                            <span className="text-slate-700 font-semibold">Total Estimation</span>
                                            <span className="font-bold text-emerald-600 text-lg">{result.totalDays.toFixed(1)} days</span>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Reasoning (if available) */}
                                {aiReasoning && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
                                            </svg>
                                            AI Analysis
                                        </h4>
                                        <p className="text-xs text-blue-700">{aiReasoning}</p>
                                    </div>
                                )}

                                {/* Note */}
                                <div className="text-xs text-slate-500 bg-slate-50 rounded p-3">
                                    <p className="flex items-start gap-2">
                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <span>Quick Estimate uses only AI-suggested activities. No drivers or risks are applied (multiplier = 1.0, risk = 0). For more control, use the detailed estimation wizard.</span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t flex-shrink-0">
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
                            disabled={!canCalculate || loading || calculating}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                            {calculating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Calculating with AI...
                                </>
                            ) : loading ? 'Loading...' : result !== null ? 'Recalculate' : 'Calculate'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
