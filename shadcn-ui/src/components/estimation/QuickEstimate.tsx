import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { MOCK_TECHNOLOGY_PRESETS, MOCK_ACTIVITIES, MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import { calculateEstimation } from '@/lib/estimationEngine';
import { suggestActivities } from '@/lib/openai';
import { useRequirementNormalization } from '@/hooks/useRequirementNormalization';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult, SelectedDriver, SelectedRisk } from '@/types/estimation';
import { ArrowLeft, Calculator, CheckCircle2, AlertTriangle, Sparkles, ListChecks, FileText, Zap, Wand2 } from 'lucide-react';

interface QuickEstimateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ViewState = 'input' | 'result';

export function QuickEstimate({ open, onOpenChange }: QuickEstimateProps) {
    // UI State
    const [view, setView] = useState<ViewState>('input');
    const [activeTab, setActiveTab] = useState('activities');

    // Data State
    const [description, setDescription] = useState('');
    const [techPresetId, setTechPresetId] = useState('');
    const [presets, setPresets] = useState<TechnologyPreset[]>([]);
    const [presetActivities, setPresetActivities] = useState<Record<string, { activity_id: string; position: number | null }[]>>({});

    // Processing State
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [result, setResult] = useState<EstimationResult | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedActivities, setSelectedActivities] = useState<Array<{ code: string; name: string; baseDays: number }>>([]);
    const [aiReasoning, setAiReasoning] = useState<string>('');

    // Normalization hook
    const { normalize, isNormalizing, normalizationResult, resetNormalization } = useRequirementNormalization();
    const [editedNormalizedDescription, setEditedNormalizedDescription] = useState<string>('');

    // Initialize edited description when normalization result changes
    useEffect(() => {
        if (normalizationResult?.normalizedDescription) {
            setEditedNormalizedDescription(normalizationResult.normalizedDescription);
        }
    }, [normalizationResult]);

    useEffect(() => {
        if (open) {
            loadPresets();
            // Reset to initial state when opening
            if (!result) {
                setView('input');
                setDescription('');
                setTechPresetId('');
                setError(null);
            }
        }
    }, [open]);

    const loadPresets = async () => {
        setLoading(true);
        try {
            type PivotRow = { tech_preset_id: string; activity_id: string; position: number | null };

            const [{ data: presetsData, error: presetsError }, { data: pivotData, error: pivotError }] = await Promise.all([
                supabase
                    .from('technology_presets')
                    .select('*')
                    .order('name'),
                supabase
                    .from('technology_preset_activities')
                    .select('tech_preset_id, activity_id, position'),
            ]);

            if (presetsError || !presetsData || presetsData.length === 0) {
                setPresets(MOCK_TECHNOLOGY_PRESETS);
                setIsDemoMode(true);
            } else {
                setPresets(presetsData);
                setIsDemoMode(false);
                if (!pivotError && pivotData) {
                    const grouped: Record<string, { activity_id: string; position: number | null }[]> = {};
                    (pivotData as PivotRow[]).forEach((row) => {
                        const position = row.position ?? null;
                        if (!grouped[row.tech_preset_id]) grouped[row.tech_preset_id] = [];
                        grouped[row.tech_preset_id].push({
                            activity_id: row.activity_id,
                            position,
                        });
                    });
                    setPresetActivities(grouped);
                }
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

            // Filter activities by preset tech category (allow MULTI)
            const allowedActivities = allActivities.filter(
                (a) => a.tech_category === selectedPreset.tech_category || a.tech_category === 'MULTI'
            );
            if (allowedActivities.length === 0) {
                setError('No activities available for the selected technology preset. Please choose another preset.');
                return;
            }

            const activityById = new Map(allowedActivities.map((a) => [a.id, a]));
            const defaultCodesFromPivot = (() => {
                const rows = presetActivities[selectedPreset.id] || [];
                if (rows.length === 0) return selectedPreset.default_activity_codes || [];
                return rows
                    .sort((a, b) => {
                        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                        return pa - pb;
                    })
                    .map((row) => activityById.get(row.activity_id)?.code)
                    .filter((code): code is string => Boolean(code));
            })();

            // Get AI suggestions
            const aiSuggestion = await suggestActivities({
                description,
                preset: selectedPreset,
                activities: allowedActivities,
            });

            if (!aiSuggestion.isValidRequirement) {
                setError(aiSuggestion.reasoning || 'The requirement description is not valid for estimation. Please provide a clearer technical target.');
                setResult(null);
                setSelectedActivities([]);
                setAiReasoning(aiSuggestion.reasoning || '');
                return;
            }

            // Determine which activity codes to use (AI suggestion or preset defaults as fallback)
            let chosenCodes: string[] = [];
            let reasoning = aiSuggestion.reasoning || '';

            if (aiSuggestion.activityCodes && aiSuggestion.activityCodes.length > 0) {
                chosenCodes = aiSuggestion.activityCodes.filter((code) =>
                    allowedActivities.some((a) => a.code === code)
                );
                if (chosenCodes.length === 0) {
                    reasoning = 'Suggested activities are not compatible with the selected technology. Falling back to preset defaults.';
                }
            }

            if (chosenCodes.length === 0) {
                chosenCodes = defaultCodesFromPivot;
                if (chosenCodes.length === 0) {
                    setError(
                        aiSuggestion.reasoning ||
                        'No compatible activities found for this preset. Please provide more details or choose another preset.'
                    );
                    return;
                }
            }

            // Prepare selected activities with base days
            const selectedActivitiesForCalc = chosenCodes.map((code) => {
                const activity = allowedActivities.find((a) => a.code === code);
                return {
                    code,
                    baseDays: activity?.base_days || 0,
                    isAiSuggested: aiSuggestion.isValidRequirement ?? false,
                };
            });

            // Store activities with full details for display
            const activitiesWithDetails = chosenCodes.map((code) => {
                const activity = allowedActivities.find((a) => a.code === code);
                return {
                    code,
                    name: activity?.name || code,
                    baseDays: activity?.base_days || 0,
                };
            });

            // NO drivers and risks - GPT suggests only activities
            const selectedDrivers: SelectedDriver[] = [];
            const selectedRisks: SelectedRisk[] = [];

            // Calculate estimation
            const estimationResult = calculateEstimation({
                activities: selectedActivitiesForCalc,
                drivers: selectedDrivers,
                risks: selectedRisks,
            });

            setResult(estimationResult);
            setSelectedActivities(activitiesWithDetails);
            setAiReasoning(reasoning);
            setView('result'); // Switch to result view
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
        setView('input');
    };

    const handleEditInputs = () => {
        setView('input');
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    const canCalculate = description.trim().length > 0 && techPresetId !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-0 shadow-2xl"
                onInteractOutside={(e) => e.preventDefault()}
            >
                {/* Header with Gradient */}
                <div className="px-6 py-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                        <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-bold text-white">Quick Estimate</DialogTitle>
                        <DialogDescription className="text-indigo-100">
                            AI-powered estimation engine
                        </DialogDescription>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {view === 'input' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {isDemoMode && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span><strong>Demo Mode:</strong> Using sample data.</span>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                                    What would you like to build?
                                </Label>
                                <div className="relative">
                                    <Textarea
                                        id="description"
                                        placeholder="e.g., A customer loyalty mobile app with QR code scanning, points tracking, and rewards redemption..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="min-h-[140px] resize-none text-base border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white shadow-sm"
                                        disabled={calculating}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 px-1 rounded">
                                        {description.length} chars
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Be as specific as possible for better accuracy
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => normalize(description)}
                                    disabled={isNormalizing || !description || description.length < 10}
                                    className="mt-2 w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                                >
                                    {isNormalizing ? (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            Analyze & Improve with AI
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Normalization Result */}
                            {normalizationResult && (
                                <div className="rounded-lg border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Wand2 className="w-4 h-4 text-white" />
                                            <span className="text-xs font-bold text-white">AI Analysis</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${normalizationResult.isValidRequirement
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                            }`}>
                                            {normalizationResult.isValidRequirement ? '✓ Valid' : '⚠ Issues'}
                                        </span>
                                    </div>

                                    <div className="p-3 space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-indigo-700 font-semibold">AI-Improved Version (Editable)</Label>
                                            <textarea
                                                value={editedNormalizedDescription}
                                                onChange={(e) => setEditedNormalizedDescription(e.target.value)}
                                                className="w-full bg-white p-2.5 rounded border-2 border-indigo-200 text-xs text-slate-800 leading-relaxed max-h-32 overflow-y-auto resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                rows={4}
                                            />
                                        </div>

                                        {normalizationResult.validationIssues?.length > 0 && (
                                            <div className="space-y-1.5">
                                                <Label className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Issues ({normalizationResult.validationIssues.length})
                                                </Label>
                                                <ul className="bg-amber-50 rounded border border-amber-200 p-2 text-[10px] text-amber-900 space-y-1">
                                                    {normalizationResult.validationIssues.slice(0, 3).map((issue, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <span className="mt-0.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                                                            {issue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={resetNormalization}
                                                className="text-xs h-7 text-slate-600 hover:text-slate-800"
                                            >
                                                Dismiss
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setDescription(editedNormalizedDescription);
                                                    resetNormalization();
                                                    setEditedNormalizedDescription('');
                                                }}
                                                className="text-xs h-7 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Use This
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label htmlFor="technology" className="text-sm font-semibold text-slate-700">
                                    Technology Stack
                                </Label>
                                <Select
                                    value={techPresetId}
                                    onValueChange={setTechPresetId}
                                    disabled={calculating}
                                >
                                    <SelectTrigger id="technology" className="h-12 border-slate-200 focus:ring-indigo-500 bg-white shadow-sm">
                                        <SelectValue placeholder="Select technology..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {presets.map((preset) => (
                                            <SelectItem key={preset.id} value={preset.id}>
                                                <span className="font-medium">{preset.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-3 shadow-sm">
                                    <div className="p-2 bg-red-100 rounded-full">
                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                    </div>
                                    <span className="mt-1">{error}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            {/* Result Header */}
                            <div className="text-center relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 to-transparent -z-10 rounded-xl" />
                                <div className="inline-flex items-center justify-center p-4 bg-white rounded-full mb-3 shadow-md ring-4 ring-emerald-50">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-4xl font-black text-slate-900 tracking-tight">
                                    {result?.totalDays.toFixed(1)} <span className="text-lg font-medium text-slate-500">Days</span>
                                </h3>
                                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider mt-1">Estimated Effort</p>
                            </div>

                            {/* Tabs for Details */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-200/50 p-1">
                                    <TabsTrigger value="activities" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <ListChecks className="w-4 h-4" /> Activities
                                    </TabsTrigger>
                                    <TabsTrigger value="breakdown" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <Calculator className="w-4 h-4" /> Breakdown
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="activities" className="mt-0 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {selectedActivities.map((activity, idx) => (
                                        <div key={idx} className="flex items-start justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-sm text-slate-900">{activity.name}</div>
                                                <Badge variant="secondary" className="text-[10px] font-normal bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100">
                                                    {activity.code}
                                                </Badge>
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg">
                                                {activity.baseDays.toFixed(1)} d
                                            </span>
                                        </div>
                                    ))}
                                </TabsContent>

                                <TabsContent value="breakdown" className="mt-0">
                                    <div className="bg-white rounded-xl p-5 space-y-4 shadow-sm border border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 text-sm">Base Effort</span>
                                            <span className="font-semibold text-slate-900">{result?.baseDays.toFixed(1)} d</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 text-sm">Multipliers</span>
                                            <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-sm">{result?.driverMultiplier.toFixed(2)}x</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 text-sm">Risk Factor</span>
                                            <span className="font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-sm">+{result?.riskScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 text-sm">Contingency</span>
                                            <span className="font-semibold text-slate-900">{result?.contingencyPercent}%</span>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                            <span className="font-bold text-slate-900">Total Estimate</span>
                                            <span className="font-black text-xl text-emerald-600">{result?.totalDays.toFixed(1)} Days</span>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {/* AI Analysis Note */}
                            {aiReasoning && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex gap-3 shadow-sm">
                                    <div className="p-2 bg-white rounded-lg shadow-sm h-fit">
                                        <Sparkles className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">AI Analysis</h4>
                                        <p className="text-xs text-blue-800 leading-relaxed">{aiReasoning}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center">
                    {view === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={handleClose} className="text-slate-500 hover:text-slate-900">Cancel</Button>
                            <Button
                                onClick={handleCalculate}
                                disabled={!canCalculate || loading || calculating}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all px-6"
                            >
                                {calculating ? (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                        Thinking...
                                    </>
                                ) : (
                                    <>
                                        Calculate Estimate
                                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-900">New</Button>
                            <Button onClick={handleClose} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200">
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
