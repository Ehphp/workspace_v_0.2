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
import { motion, AnimatePresence } from 'framer-motion';

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
                className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-2xl border-white/40 shadow-2xl ring-1 ring-white/50"
                onInteractOutside={(e) => e.preventDefault()}
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl -z-10 pointer-events-none" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100/60 flex items-center gap-5 relative z-10 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/40">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/50">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                            Quick Estimate
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            AI-powered estimation engine
                        </DialogDescription>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 relative z-10">
                    <AnimatePresence mode="wait">
                        {view === 'input' ? (
                            <motion.div
                                key="input"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
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
                                            onChange={(e) => setDescription(e.target.value)}
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
                                            <Badge variant={normalizationResult.isValidRequirement ? "success" : "destructive"} className="text-[10px] py-0.5 h-5 font-semibold shadow-sm">
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
                                                        setDescription(editedNormalizedDescription);
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
                                        onValueChange={setTechPresetId}
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
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Result Header */}
                                <div className="text-center relative py-8">
                                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-transparent -z-10 rounded-3xl" />
                                    <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-xl shadow-emerald-100 ring-4 ring-emerald-50">
                                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                    </div>
                                    <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-2 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                        {result?.totalDays.toFixed(1)} <span className="text-2xl font-bold text-slate-400 tracking-normal">Days</span>
                                    </h3>
                                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2">
                                        <span className="w-8 h-[1px] bg-emerald-200"></span>
                                        Estimated Effort
                                        <span className="w-8 h-[1px] bg-emerald-200"></span>
                                    </p>
                                </div>

                                {/* Tabs for Details */}
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/80 p-1.5 rounded-2xl h-auto">
                                        <TabsTrigger value="activities" className="rounded-xl py-2.5 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-medium">
                                            <ListChecks className="w-4 h-4" /> Activities
                                        </TabsTrigger>
                                        <TabsTrigger value="breakdown" className="rounded-xl py-2.5 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-medium">
                                            <Calculator className="w-4 h-4" /> Breakdown
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="activities" className="mt-0 space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedActivities.map((activity, idx) => (
                                            <div key={idx} className="flex items-start justify-between p-4 bg-white/80 hover:bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group">
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">{activity.name}</div>
                                                    <Badge variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 px-2 py-0.5">
                                                        {activity.code}
                                                    </Badge>
                                                </div>
                                                <span className="font-bold text-slate-700 text-sm whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
                                                    {activity.baseDays.toFixed(1)} h
                                                </span>
                                            </div>
                                        ))}
                                    </TabsContent>

                                    <TabsContent value="breakdown" className="mt-0">
                                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 space-y-5 shadow-sm border border-slate-100">
                                            <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                                                <span className="text-slate-500 text-sm font-medium">Base Effort</span>
                                                <span className="font-bold text-slate-900 text-lg">{result?.baseDays.toFixed(1)} d</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                        Multipliers
                                                    </span>
                                                    <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg text-xs border border-blue-100">{result?.driverMultiplier.toFixed(2)}x</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                        Risk Factor
                                                    </span>
                                                    <span className="font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg text-xs border border-orange-100">+{result?.riskScore}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        Contingency
                                                    </span>
                                                    <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs border border-slate-200">{result?.contingencyPercent}%</span>
                                                </div>
                                            </div>
                                            <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                                                <span className="font-bold text-slate-900 text-base">Total Estimate</span>
                                                <span className="font-black text-2xl text-emerald-600 tracking-tight">{result?.totalDays.toFixed(1)} Days</span>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>

                                {/* AI Analysis Note */}
                                {aiReasoning && (
                                    <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-4 flex gap-3 shadow-sm">
                                        <div className="p-2 bg-white rounded-lg shadow-sm h-fit ring-1 ring-blue-50">
                                            <Sparkles className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">AI Analysis</h4>
                                            <p className="text-xs text-blue-800 leading-relaxed opacity-90">{aiReasoning}</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100/60 bg-white/80 backdrop-blur-md flex justify-between items-center relative z-10">
                    {view === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={handleClose} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">Cancel</Button>
                            <Button
                                onClick={handleCalculate}
                                disabled={!canCalculate || loading || calculating}
                                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-700 hover:via-indigo-700 hover:to-fuchsia-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all px-8 h-11 rounded-xl font-medium"
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
                        <div className="flex gap-3 w-full justify-end">
                            <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                New Estimate
                            </Button>
                            <Button onClick={handleClose} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 px-8 h-11 rounded-xl">
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
