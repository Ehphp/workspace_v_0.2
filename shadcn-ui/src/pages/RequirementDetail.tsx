import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useEstimationData } from '@/hooks/useEstimationData';
import { useEstimationState } from '@/hooks/useEstimationState';
import { useRequirement } from '@/hooks/useRequirement';
import { useEstimationHistory } from '@/hooks/useEstimationHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ArrowLeft, FileText, Calculator, History, Clock, Eye, Copy, RotateCcw, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import { suggestActivities } from '@/lib/openai';
import { TechnologySection } from '@/components/estimation/TechnologySection';
import { ActivitiesSection } from '@/components/estimation/ActivitiesSection';
import { DriversSection } from '@/components/estimation/DriversSection';
import { RisksSection } from '@/components/estimation/RisksSection';
import { CalculationSummary } from '@/components/estimation/CalculationSummary';
import { EstimationComparison } from '@/components/estimation/EstimationComparison';
import { EstimationTimeline } from '@/components/estimation/EstimationTimeline';

export default function RequirementDetail() {
    const navigate = useNavigate();
    const { listId, reqId } = useParams<{ listId: string; reqId: string }>();
    const { user } = useAuth();

    // Load requirement data
    const {
        requirement,
        preset,
        loading: requirementLoading,
        error: requirementError
    } = useRequirement(listId, reqId, user?.id);

    // Load estimation master data
    const {
        data: { presets, activities, drivers, risks },
        loading: dataLoading,
        error: dataError
    } = useEstimationData();

    // Load estimation history
    const {
        history: estimationHistory,
        loading: historyLoading,
        refetch: refetchHistory
    } = useEstimationHistory(reqId);

    // Manage estimation state
    const {
        selectedPresetId,
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,
        setSelectedPresetId,
        toggleActivity,
        setDriverValue,
        toggleRisk,
        applyPreset,
        applyPresetDefaults,
        applyAiSuggestions,
        estimationResult,
        isValid: isEstimationValid,
        hasSelections,
    } = useEstimationState({
        activities,
        drivers,
        risks,
        presets,
    });

    // Local UI state
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showScenarioDialog, setShowScenarioDialog] = useState(false);
    const [scenarioName, setScenarioName] = useState('Default');
    const [selectedEstimationId, setSelectedEstimationId] = useState<string | null>(null);
    const [expandedEstimationId, setExpandedEstimationId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('info');
    const [expandedSection, setExpandedSection] = useState<'technology' | 'activities' | 'drivers' | 'risks' | null>('technology');

    // Track unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        const result = hasSelections && estimationResult !== null;
        console.log('🔄 hasUnsavedChanges computed:', {
            hasSelections,
            hasEstimationResult: estimationResult !== null,
            result,
            selectedActivityIds: selectedActivityIds.length,
            selectedPresetId
        });
        return result;
    }, [hasSelections, estimationResult, selectedActivityIds, selectedPresetId]);

    // Copy estimation to clipboard
    const handleCopyEstimation = useCallback((est: typeof estimationHistory[0]) => {
        const summary = `Estimation: ${est.scenario_name}
Total Days: ${est.total_days.toFixed(1)}
Base Days: ${est.base_days.toFixed(1)}
Multiplier: ${est.driver_multiplier.toFixed(3)}x
Risk Score: ${est.risk_score}
Contingency: ${est.contingency_percent}%
Activities: ${est.estimation_activities?.length || 0}
Drivers: ${est.estimation_drivers?.length || 0}
Risks: ${est.estimation_risks?.length || 0}`;

        navigator.clipboard.writeText(summary);
        toast.success('Estimation copied to clipboard');
    }, []);

    // Restore estimation (apply to current form)
    const handleRestoreEstimation = useCallback((est: typeof estimationHistory[0]) => {
        console.log('🔄 Restoring estimation:', est.scenario_name);

        // Apply activities
        const activityIds = est.estimation_activities?.map(ea => ea.activity_id) || [];
        console.log('📋 Activities to restore:', activityIds.length);

        // Apply drivers - now using ID directly (no conversion needed)
        const driverValues: Record<string, string> = {};
        est.estimation_drivers?.forEach(ed => {
            driverValues[ed.driver_id] = ed.selected_value; // ID-based, no conversion
        });
        console.log('🎛️ Drivers to restore:', Object.keys(driverValues).length, driverValues);

        // Apply risks
        const riskIds = est.estimation_risks?.map(er => er.risk_id) || [];
        console.log('⚠️ Risks to restore:', riskIds.length);

        // Apply all selections using applyAiSuggestions
        applyAiSuggestions(activityIds, driverValues, riskIds);

        setScenarioName(est.scenario_name + ' (Restored)');

        // Switch to Estimation tab to see restored values
        setActiveTab('estimation');

        toast.success(`Restored estimation: ${est.scenario_name}`);
        console.log('✅ Restoration complete, switched to Estimation tab');
    }, [applyAiSuggestions, drivers]);

    // Combined loading state
    const loading = requirementLoading || dataLoading;

    const handlePresetChange = useCallback((presetId: string) => {
        applyPreset(presetId);
    }, [applyPreset]);

    const handleApplyTemplate = useCallback(() => {
        if (!selectedPresetId) return;
        applyPresetDefaults(selectedPresetId);
        toast.success('Template applied', {
            description: 'Default activities, drivers and risks loaded from preset'
        });
    }, [selectedPresetId, applyPresetDefaults]);

    const handleAiSuggest = useCallback(async () => {
        if (!requirement?.description || !selectedPresetId) {
            toast.error('Please select a technology preset first');
            return;
        }

        setIsAiLoading(true);
        try {
            const selectedPreset = presets.find((p) => p.id === selectedPresetId);
            if (!selectedPreset) {
                throw new Error('Selected preset not found');
            }

            const suggestions = await suggestActivities({
                description: requirement.description,
                preset: selectedPreset,
                activities,
                drivers,
                risks,
            });

            // Check if the requirement is valid
            if (!suggestions.isValidRequirement) {
                toast.error('Invalid requirement', {
                    description: suggestions.reasoning || 'The requirement description is not valid or clear enough.',
                });
                setIsAiLoading(false);
                return;
            }

            // Check if GPT suggested any activities
            if (!suggestions.activityCodes || suggestions.activityCodes.length === 0) {
                toast.warning('No activities suggested', {
                    description: suggestions.reasoning || 'The description may be too short or unclear. Please provide more details.',
                });
                setIsAiLoading(false);
                return;
            }

            // Map activity codes to IDs
            const suggestedActivityIds = activities
                .filter((a) => suggestions.activityCodes.includes(a.code))
                .map((a) => a.id);

            // NO drivers and risks - GPT suggests only activities
            applyAiSuggestions(
                suggestedActivityIds,
                undefined, // no driver suggestions
                undefined  // no risk suggestions
            );

            toast.success('AI suggestions applied successfully');
        } catch (error) {
            console.error('AI suggestion error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to get AI suggestions', {
                description: errorMessage,
            });
        } finally {
            setIsAiLoading(false);
        }
    }, [requirement, selectedPresetId, presets, activities, drivers, risks, applyAiSuggestions]);

    const handleSaveEstimation = useCallback(() => {
        console.log('🔘 Save button clicked', {
            user: !!user,
            requirement: !!requirement,
            estimationResult: !!estimationResult,
            isEstimationValid,
            hasUnsavedChanges,
            selectedActivityIds: selectedActivityIds.length,
        });

        if (!user || !requirement || !estimationResult) {
            console.error('❌ Missing data:', { user: !!user, requirement: !!requirement, estimationResult: !!estimationResult });
            toast.error('Cannot save estimation', {
                description: 'Missing required data',
            });
            return;
        }

        if (!isEstimationValid) {
            console.error('❌ Invalid estimation:', { isEstimationValid, selectedPresetId, activityCount: selectedActivityIds.length });
            toast.error('Invalid estimation', {
                description: 'Please select a preset and at least one activity',
            });
            return;
        }

        console.log('✅ Opening scenario dialog');
        setShowScenarioDialog(true);
    }, [user, requirement, estimationResult, isEstimationValid, hasUnsavedChanges, selectedActivityIds, selectedPresetId]);

    const confirmSaveEstimation = useCallback(async () => {
        if (!user || !requirement || !estimationResult) return;

        setIsSaving(true);
        setShowScenarioDialog(false);

        console.log('💾 Saving estimation with:', {
            activities: selectedActivityIds.length,
            drivers: Object.keys(selectedDriverValues).length,
            risks: selectedRiskIds.length,
            multiplier: estimationResult.driverMultiplier,
            riskScore: estimationResult.riskScore,
            contingency: estimationResult.contingencyPercent,
        });

        try {
            // Prepare data for atomic RPC call
            const activitiesData = selectedActivityIds.map((activityId) => ({
                activity_id: activityId,
                is_ai_suggested: aiSuggestedIds.includes(activityId),
                notes: ''
            }));

            const driversData = Object.entries(selectedDriverValues).map(([driverId, value]) => ({
                driver_id: driverId,
                selected_value: value
            }));

            const risksData = selectedRiskIds.map((riskId) => ({
                risk_id: riskId
            }));

            // ✅ SINGLE ATOMIC RPC CALL - all-or-nothing transaction
            const { data, error } = await supabase.rpc('save_estimation_atomic', {
                p_requirement_id: requirement.id,
                p_user_id: user.id,
                p_total_days: estimationResult.totalDays,
                p_base_days: estimationResult.baseDays,
                p_driver_multiplier: estimationResult.driverMultiplier,
                p_risk_score: estimationResult.riskScore,
                p_contingency_percent: estimationResult.contingencyPercent,
                p_scenario_name: scenarioName || 'Default',
                p_activities: activitiesData,
                p_drivers: driversData.length > 0 ? driversData : null,
                p_risks: risksData.length > 0 ? risksData : null
            });

            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No data returned from save operation');

            const result = data[0];
            console.log('✅ Estimation saved atomically:', {
                estimationId: result.estimation_id,
                activities: result.activities_count,
                drivers: result.drivers_count,
                risks: result.risks_count
            });

            setScenarioName('Default');
            toast.success('Estimation saved successfully', {
                description: `${result.activities_count} activities, ${result.drivers_count} drivers, ${result.risks_count} risks`
            });

            // Reload history
            await refetchHistory();
        } catch (error) {
            console.error('Error saving estimation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to save estimation', {
                description: errorMessage,
            });
        } finally {
            setIsSaving(false);
        }
    }, [
        user,
        requirement,
        estimationResult,
        scenarioName,
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,
        refetchHistory,
    ]);

    const getPriorityBadge = useCallback((priority: string) => {
        const variants = {
            HIGH: 'destructive',
            MEDIUM: 'default',
            LOW: 'secondary',
        } as const;
        return (
            <Badge variant={variants[priority as keyof typeof variants] || 'secondary'}>
                {priority}
            </Badge>
        );
    }, []);

    const getStateBadge = useCallback((state: string) => {
        const variants = {
            PROPOSED: 'outline',
            SELECTED: 'secondary',
            SCHEDULED: 'default',
            DONE: 'default',
        } as const;
        return (
            <Badge variant={variants[state as keyof typeof variants] || 'outline'}>
                {state}
            </Badge>
        );
    }, []);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!requirement) {
        return null;
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSkgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>

            {/* Header with glassmorphism */}
            <header className="relative border-b border-white/20 backdrop-blur-md bg-white/80 shadow-sm">
                <div className="container mx-auto px-6 h-16 flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/lists/${listId}/requirements`)}
                        className="hover:bg-white/60 transition-all duration-300 -ml-2"
                        aria-label="Back to requirements"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-600 font-semibold">{requirement.req_id}</span>
                            {getPriorityBadge(requirement.priority)}
                            {getStateBadge(requirement.state)}
                        </div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent truncate">
                            {requirement.title}
                        </h1>
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/80 backdrop-blur-sm shadow-sm border-slate-300 hover:bg-white hover:border-blue-400 transition-all duration-300"
                    >
                        Edit
                    </Button>
                </div>
            </header>

            {/* Content Area with Tabs */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-auto">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-auto">
                        {/* Tabs Navigation */}
                        <div className="border-b border-white/20 bg-white/60 backdrop-blur-sm flex-none shadow-sm sticky top-0 z-10">
                            <div className="container mx-auto px-6">
                                <TabsList className="h-12 bg-transparent justify-start gap-2">
                                    <TabsTrigger
                                        value="info"
                                        className="gap-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300"
                                    >
                                        <FileText className="h-4 w-4" />
                                        Info
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="estimation"
                                        className="gap-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300"
                                    >
                                        <Calculator className="h-4 w-4" />
                                        Estimation
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="history"
                                        className="gap-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300"
                                    >
                                        <History className="h-4 w-4" />
                                        History
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </div>
                        {/* Info Tab */}
                        <TabsContent value="info" className="mt-0">
                            <div className="container mx-auto px-6 py-12">
                                <div className="max-w-7xl mx-auto">
                                    {/* Layout a 2 colonne per ottimizzare lo spazio */}
                                    <div className="grid lg:grid-cols-2 gap-6">
                                        {/* Colonna Sinistra */}
                                        <div className="space-y-6">
                                            {/* Estimation Summary Card - compatta */}
                                            {estimationHistory.length > 0 && (
                                                <Card className="rounded-xl shadow-lg border-white/50 bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-sm">
                                                    <CardHeader className="pb-2 pt-3 px-4">
                                                        <CardTitle className="text-sm font-semibold text-slate-900">Estimation Summary</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="px-4 pb-3">
                                                        <div className="grid grid-cols-3 gap-2 text-center">
                                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2">
                                                                <div className="text-2xl font-bold text-blue-600">
                                                                    {estimationHistory.length}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600 mt-0.5 font-medium">Total</div>
                                                            </div>
                                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2">
                                                                <div className="text-2xl font-bold text-indigo-600">
                                                                    {estimationHistory[0]?.total_days.toFixed(1)}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600 mt-0.5 font-medium">Latest</div>
                                                            </div>
                                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2">
                                                                <div className="text-2xl font-bold text-purple-600">
                                                                    {(estimationHistory.reduce((sum, est) => sum + est.total_days, 0) / estimationHistory.length).toFixed(1)}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600 mt-0.5 font-medium">Average</div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Description Card - altezza limitata con scroll */}
                                            <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm flex flex-col" style={{ maxHeight: estimationHistory.length > 0 ? 'calc(100vh - 320px)' : 'calc(100vh - 220px)' }}>
                                                <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50 flex-none">
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Description</CardTitle>
                                                </CardHeader>
                                                <CardContent className="px-4 pb-3 overflow-y-auto flex-1">
                                                    <p className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
                                                        {requirement.description || 'No description provided'}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Colonna Destra */}
                                        <div className="space-y-4">
                                            {/* Details Card - compatta */}
                                            <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm">
                                                <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50">
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Details</CardTitle>
                                                </CardHeader>
                                                <CardContent className="px-4 pb-3">
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div>
                                                            <span className="text-slate-600 font-medium">Priority:</span>
                                                            <div className="mt-1">{getPriorityBadge(requirement.priority)}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-600 font-medium">State:</span>
                                                            <div className="mt-1">{getStateBadge(requirement.state)}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-600 font-medium">Business Owner:</span>
                                                            <div className="mt-1 font-semibold text-slate-900">{requirement.business_owner || 'N/A'}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-600 font-medium">Technology:</span>
                                                            <div className="mt-1 font-semibold text-slate-900">{preset?.name || 'N/A'}</div>
                                                        </div>
                                                        {requirement.labels && requirement.labels.length > 0 && (
                                                            <div className="col-span-2">
                                                                <span className="text-slate-600 font-medium">Labels:</span>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {requirement.labels.map((label, idx) => (
                                                                        <Badge key={idx} variant="outline" className="text-[10px] border-slate-300 bg-white/80 px-1.5 py-0">
                                                                            {label}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* Timeline Card - compatta */}
                                            <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm">
                                                <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50">
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Timeline</CardTitle>
                                                </CardHeader>
                                                <CardContent className="px-4 pb-3">
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                                <Clock className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-600 font-medium">Created</span>
                                                                <div className="mt-0.5 font-semibold text-slate-900">
                                                                    {new Date(requirement.created_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {new Date(requirement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                                <Clock className="h-4 w-4 text-indigo-600" />
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-600 font-medium">Updated</span>
                                                                <div className="mt-0.5 font-semibold text-slate-900">
                                                                    {new Date(requirement.updated_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {new Date(requirement.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Estimation Tab */}
                        <TabsContent value="estimation" className="mt-0">
                            <div className="container mx-auto px-6 py-12">
                                {/* Header Sezione */}
                                <div className="mb-6 px-4 py-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-md">
                                    <h2 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                        Configure Estimation
                                    </h2>
                                    <p className="text-xs text-slate-600 mt-1">Select technology, activities, drivers and risks to calculate the estimation</p>
                                </div>

                                <div className="grid lg:grid-cols-[1fr_360px] gap-6 pb-12">
                                    {/* Left Column - Configuration */}
                                    <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                                        <TechnologySection
                                            presets={presets}
                                            selectedPresetId={selectedPresetId}
                                            onPresetChange={handlePresetChange}
                                            onApplyTemplate={handleApplyTemplate}
                                            onAiRecalculate={handleAiSuggest}
                                            isAiLoading={isAiLoading}
                                            requirementDescription={requirement?.description || ''}
                                            isExpanded={expandedSection === 'technology'}
                                            onToggle={() => setExpandedSection(expandedSection === 'technology' ? null : 'technology')}
                                        />

                                        <ActivitiesSection
                                            activities={activities}
                                            selectedActivityIds={selectedActivityIds}
                                            aiSuggestedIds={aiSuggestedIds}
                                            onActivityToggle={toggleActivity}
                                            isExpanded={expandedSection === 'activities'}
                                            onToggle={() => setExpandedSection(expandedSection === 'activities' ? null : 'activities')}
                                        />

                                        <DriversSection
                                            drivers={drivers}
                                            selectedDriverValues={selectedDriverValues}
                                            onDriverChange={setDriverValue}
                                            currentMultiplier={estimationResult?.driverMultiplier || 1.0}
                                            isExpanded={expandedSection === 'drivers'}
                                            onToggle={() => setExpandedSection(expandedSection === 'drivers' ? null : 'drivers')}
                                        />

                                        <RisksSection
                                            risks={risks}
                                            selectedRiskIds={selectedRiskIds}
                                            onRiskToggle={toggleRisk}
                                            currentRiskScore={estimationResult?.riskScore || 0}
                                            isExpanded={expandedSection === 'risks'}
                                            onToggle={() => setExpandedSection(expandedSection === 'risks' ? null : 'risks')}
                                        />
                                    </div>

                                    {/* Right Column - Summary (Sticky) */}
                                    <div className="lg:sticky lg:top-6 lg:self-start lg:h-fit">
                                        <CalculationSummary
                                            result={estimationResult}
                                            onSave={handleSaveEstimation}
                                            isSaving={isSaving}
                                            hasUnsavedChanges={hasUnsavedChanges}
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* History Tab */}
                        <TabsContent value="history" className="mt-0">
                            <div className="container mx-auto px-6 py-12">
                                <div className="max-w-7xl mx-auto">
                                    {/* Timeline compatta - sempre visibile */}
                                    {estimationHistory.length > 0 && (
                                        <div className="mb-4 flex-none">
                                            <EstimationTimeline estimations={estimationHistory} />
                                        </div>
                                    )}

                                    {/* Compact History Cards - layout ottimizzato */}
                                    <div className="flex-1 overflow-y-auto">
                                        <div className="max-w-6xl mx-auto">
                                            {historyLoading ? (
                                                <div className="text-center py-12">
                                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                                                </div>
                                            ) : estimationHistory.length === 0 ? (
                                                <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm">
                                                    <CardContent className="text-center py-12 text-slate-600">
                                                        <History className="h-12 w-12 mx-auto mb-4 opacity-40 text-slate-400" />
                                                        <p className="text-sm font-medium">No estimation history yet</p>
                                                        <p className="text-xs mt-2 text-slate-500">Save an estimation to start building history</p>
                                                    </CardContent>
                                                </Card>
                                            ) : (
                                                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {estimationHistory.map((est) => {
                                                        const hasActivities = (est.estimation_activities?.length || 0) > 0;
                                                        const hasDrivers = (est.estimation_drivers?.length || 0) > 0;
                                                        const hasRisks = (est.estimation_risks?.length || 0) > 0;

                                                        return (
                                                            <Card key={est.id} className="rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 bg-white/90 backdrop-blur-sm">
                                                                <CardContent className="p-4">
                                                                    {/* Header */}
                                                                    <div className="mb-3">
                                                                        <h4 className="font-bold text-sm text-slate-900 truncate mb-1">
                                                                            {est.scenario_name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                                            <Clock className="h-3 w-3" />
                                                                            {new Date(est.created_at).toLocaleDateString()} {new Date(est.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </div>

                                                                    {/* Key Metric - Total Days */}
                                                                    <div className="text-center mb-3 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                                                                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                                            {est.total_days.toFixed(1)}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-600 font-medium uppercase mt-1">days</div>
                                                                    </div>

                                                                    {/* Metrics Grid */}
                                                                    <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
                                                                        <div className="text-center bg-slate-50 rounded px-2 py-1">
                                                                            <div className="text-slate-600">Base</div>
                                                                            <div className="font-bold text-slate-900">{est.base_days.toFixed(1)}</div>
                                                                        </div>
                                                                        <div className="text-center bg-purple-50 rounded px-2 py-1">
                                                                            <div className="text-slate-600">Mult</div>
                                                                            <div className="font-bold text-purple-700">{est.driver_multiplier.toFixed(2)}x</div>
                                                                        </div>
                                                                        <div className="text-center bg-orange-50 rounded px-2 py-1">
                                                                            <div className="text-slate-600">Cont</div>
                                                                            <div className="font-bold text-orange-700">{est.contingency_percent}%</div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Counts */}
                                                                    <div className="flex gap-1.5 mb-3 text-[10px]">
                                                                        <span className={`px-2 py-1 rounded-md flex-1 text-center ${hasActivities ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {est.estimation_activities?.length || 0} act
                                                                        </span>
                                                                        <span className={`px-2 py-1 rounded-md flex-1 text-center ${hasDrivers ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {est.estimation_drivers?.length || 0} drv
                                                                        </span>
                                                                        <span className={`px-2 py-1 rounded-md flex-1 text-center ${hasRisks ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {est.estimation_risks?.length || 0} rsk
                                                                        </span>
                                                                    </div>

                                                                    {/* Action Buttons */}
                                                                    <div className="flex gap-1.5">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="flex-1 text-[10px] h-7"
                                                                            onClick={() => {
                                                                                setSelectedEstimationId(est.id);
                                                                                setDrawerOpen(true);
                                                                            }}
                                                                        >
                                                                            <Eye className="h-3 w-3 mr-1" />
                                                                            View
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0"
                                                                            title="Copy to clipboard"
                                                                            onClick={() => handleCopyEstimation(est)}
                                                                        >
                                                                            <Copy className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0"
                                                                            title="Restore estimation"
                                                                            onClick={() => handleRestoreEstimation(est)}
                                                                        >
                                                                            <RotateCcw className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Sheet Drawer for Full Estimation Details */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                    {(() => {
                        const selectedEst = estimationHistory.find(e => e.id === selectedEstimationId);
                        if (!selectedEst) return null;

                        return (
                            <>
                                <SheetHeader>
                                    <SheetTitle className="text-xl font-bold text-slate-900">
                                        {selectedEst.scenario_name}
                                    </SheetTitle>
                                    <SheetDescription className="text-xs text-slate-600">
                                        {new Date(selectedEst.created_at).toLocaleString()}
                                    </SheetDescription>
                                </SheetHeader>

                                <div className="mt-6 space-y-6">
                                    {/* Total Days - Big Number */}
                                    <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                                        <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                            {selectedEst.total_days.toFixed(1)}
                                        </div>
                                        <div className="text-sm text-slate-600 font-medium uppercase tracking-wider mt-2">
                                            Total Days
                                        </div>
                                    </div>

                                    {/* Calculation Breakdown */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm text-slate-900">Calculation Breakdown</h4>
                                        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Base Days:</span>
                                                <span className="font-bold text-slate-900">{selectedEst.base_days.toFixed(1)}d</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Driver Multiplier:</span>
                                                <span className="font-bold text-slate-900">{selectedEst.driver_multiplier.toFixed(3)}x</span>
                                            </div>
                                            <div className="border-t pt-2">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="text-slate-700">Subtotal:</span>
                                                    <span className="font-bold text-slate-900">
                                                        {(selectedEst.base_days * selectedEst.driver_multiplier).toFixed(1)}d
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Risk Score:</span>
                                                <span className="font-bold text-orange-700">{selectedEst.risk_score}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Contingency:</span>
                                                <span className="font-bold text-orange-700">{selectedEst.contingency_percent}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Activities List */}
                                    {selectedEst.estimation_activities && selectedEst.estimation_activities.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                                                Activities ({selectedEst.estimation_activities.length})
                                            </h4>
                                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                                {selectedEst.estimation_activities.map((estAct, idx) => {
                                                    const activity = activities.find(a => a.id === estAct.activity_id);
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between text-xs bg-blue-50 rounded px-3 py-2">
                                                            <span className="text-slate-700 flex-1">{activity?.name || 'Unknown'}</span>
                                                            <span className="font-mono font-semibold text-blue-700 ml-2">{activity?.base_days.toFixed(1)}d</span>
                                                            {estAct.is_ai_suggested && (
                                                                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">AI</Badge>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Drivers List */}
                                    {selectedEst.estimation_drivers && selectedEst.estimation_drivers.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                                                Drivers ({selectedEst.estimation_drivers.length})
                                            </h4>
                                            <div className="space-y-1">
                                                {selectedEst.estimation_drivers.map((estDrv, idx) => {
                                                    const driver = drivers.find(d => d.id === estDrv.driver_id);
                                                    const option = driver?.options.find(o => o.value === estDrv.selected_value);
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between text-xs bg-purple-50 rounded px-3 py-2">
                                                            <span className="text-slate-700 flex-1">{driver?.name || 'Unknown'}</span>
                                                            <span className="text-slate-600 text-[11px] mx-2">{option?.label || estDrv.selected_value}</span>
                                                            <span className="font-mono font-semibold text-purple-700">{option?.multiplier.toFixed(2)}x</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Risks List */}
                                    {selectedEst.estimation_risks && selectedEst.estimation_risks.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                <span className="inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
                                                Risks ({selectedEst.estimation_risks.length})
                                            </h4>
                                            <div className="space-y-1">
                                                {selectedEst.estimation_risks.map((estRisk, idx) => {
                                                    const risk = risks.find(r => r.id === estRisk.risk_id);
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between text-xs bg-orange-50 rounded px-3 py-2">
                                                            <span className="text-slate-700 flex-1">{risk?.name || 'Unknown'}</span>
                                                            <span className="font-mono font-semibold text-orange-700">+{risk?.weight || 0}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Formula Display */}
                                    <div className="bg-slate-100 rounded-lg p-4 text-xs font-mono space-y-1">
                                        <div className="font-semibold text-sm text-slate-900 mb-2">Formula:</div>
                                        <div className="text-slate-700">
                                            Subtotal = {selectedEst.base_days.toFixed(1)} × {selectedEst.driver_multiplier.toFixed(3)} = {(selectedEst.base_days * selectedEst.driver_multiplier).toFixed(1)}d
                                        </div>
                                        <div className="text-slate-700">
                                            Total = {(selectedEst.base_days * selectedEst.driver_multiplier).toFixed(1)} × (1 + {selectedEst.contingency_percent}%) = {selectedEst.total_days.toFixed(1)}d
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </SheetContent>
            </Sheet>

            {/* Scenario Name Dialog */}
            <AlertDialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
                <AlertDialogContent className="bg-white/95 backdrop-blur-lg border-white/50 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-slate-900">Save Estimation</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600">
                            Give this estimation a name to identify it in the history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label htmlFor="scenario-name" className="text-sm font-medium text-slate-700">Scenario Name</Label>
                        <Input
                            id="scenario-name"
                            placeholder="e.g., Base Estimate, With Integration, Optimistic"
                            value={scenarioName}
                            onChange={(e) => setScenarioName(e.target.value)}
                            className="mt-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setScenarioName('Default')}
                            className="border-slate-300 hover:bg-slate-100"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmSaveEstimation}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                        >
                            {isSaving ? 'Saving...' : 'Save Estimation'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Comparison Dialog - Fullscreen with scroll */}
            <Dialog open={comparisonDialogOpen} onOpenChange={setComparisonDialogOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <GitCompare className="h-5 w-5" />
                            Compare Estimations
                        </DialogTitle>
                        <DialogDescription>
                            Select and compare two estimations to see their differences
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <EstimationComparison
                            estimations={estimationHistory}
                            activities={activities}
                            drivers={drivers}
                            risks={risks}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
