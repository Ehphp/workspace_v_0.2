import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useEstimationData } from '@/hooks/useEstimationData';
import { useEstimationState } from '@/hooks/useEstimationState';
import { useRequirement } from '@/hooks/useRequirement';
import { useEstimationHistory } from '@/hooks/useEstimationHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText, Calculator, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { suggestActivities } from '@/lib/openai';
import { Header } from '@/components/layout/Header';
import { HistorySection } from '@/components/requirements/detail/HistorySection';
import { EstimationComparison } from '@/components/estimation/EstimationComparison';

// New Components
import { RequirementHeader } from '@/components/requirements/detail/RequirementHeader';
import { RequirementDescription } from '@/components/requirements/detail/RequirementDescription';
import { RequirementInfo } from '@/components/requirements/detail/RequirementInfo';
import { RequirementEstimation } from '@/components/requirements/detail/RequirementEstimation';
import { RequirementDriversCard } from '@/components/requirements/detail/RequirementDriversCard';

const HISTORY_PAGE_SIZE = 5;

export default function RequirementDetail() {
    const navigate = useNavigate();
    const { listId, reqId } = useParams<{ listId: string; reqId: string }>();
    const { user } = useAuth();

    // Load requirement data
    const {
        requirement,
        list,
        preset,
        driverValues: requirementDriverValues,
        loading: requirementLoading,
        error: requirementError,
        refetch: refetchRequirement
    } = useRequirement(listId, reqId, user?.id);

    // Load estimation master data
    const {
        data: { presets, activities, drivers, risks },
        loading: dataLoading,
        error: dataError
    } = useEstimationData();

    // Estimation State Management
    const estimationState = useEstimationState({
        activities,
        drivers,
        risks,
        presets,
    });

    const {
        selectedPresetId,
        selectedActivityIds,
        selectedDriverValues,
        selectedRiskIds,
        setSelectedPresetId,
        applyPresetDefaults,
        applyAiSuggestions,
        setDriverValues,
        estimationResult,
        hasSelections,
        isValid: isEstimationValid
    } = estimationState;

    // History State
    const {
        history: estimationHistory,
        loading: historyLoading,
        totalCount: historyTotalCount,
        page: historyPage,
        setPage: setHistoryPage,
        refetch: refetchHistory
    } = useEstimationHistory(requirement?.id);

    // UI State
    const [activeTab, setActiveTab] = useState('info');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showScenarioDialog, setShowScenarioDialog] = useState(false);
    const [scenarioName, setScenarioName] = useState('Default');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedEstimationId, setSelectedEstimationId] = useState<string | null>(null);

    // Quick Estimate State
    const [isQuickEstimating, setIsQuickEstimating] = useState(false);
    const [showQuickEstimateError, setShowQuickEstimateError] = useState(false);
    const [quickEstimateErrorData, setQuickEstimateErrorData] = useState<{ title: string; message: string; reasoning?: string } | null>(null);

    // Initialize preset when requirement loads
    useEffect(() => {
        if (requirement?.tech_preset_id && !selectedPresetId && presets.length > 0) {
            setSelectedPresetId(requirement.tech_preset_id);
            // Optionally apply defaults if no selections made yet
            const hasRequirementDrivers = (requirementDriverValues?.length || 0) > 0;
            if (!hasSelections && !hasRequirementDrivers) {
                applyPresetDefaults(requirement.tech_preset_id);
            }
        }
    }, [requirement, presets, selectedPresetId, hasSelections, setSelectedPresetId, applyPresetDefaults, requirementDriverValues]);

    // Apply requirement-scoped driver defaults when available
    useEffect(() => {
        if (!requirementDriverValues || requirementDriverValues.length === 0) return;
        if (Object.keys(selectedDriverValues).length > 0) return;
        const map: Record<string, string> = {};
        requirementDriverValues.forEach((rv) => {
            map[rv.driver_id] = rv.selected_value;
        });
        setDriverValues(map);
    }, [requirementDriverValues, selectedDriverValues, setDriverValues]);

    // Check for unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (!estimationResult) return false;
        // Simple check: if we have a result but it's not in history (by exact match)
        // For MVP, just checking if we have a result is enough to show "Save" button enabled
        return true;
    }, [estimationResult]);

    // AI Suggestion Handler
    const handleAiSuggest = async () => {
        if (!requirement?.description || !selectedPresetId) return;

        setIsAiLoading(true);
        try {
            const selectedPreset = presets.find(p => p.id === selectedPresetId);
            if (!selectedPreset) throw new Error('Preset not found');

            const suggestion = await suggestActivities({
                description: requirement.description,
                preset: selectedPreset,
                activities: activities,
            });

            if (suggestion.isValidRequirement) {
                applyAiSuggestions(suggestion.activityCodes, undefined, undefined); // Drivers/Risks handled manually or by defaults
                toast.success('AI suggestions applied', {
                    description: `Added ${suggestion.activityCodes.length} activities based on description.`
                });
            } else {
                toast.warning('AI Suggestion', {
                    description: suggestion.reasoning || 'Could not generate suggestions.'
                });
            }
        } catch (error) {
            console.error('AI Suggest error:', error);
            toast.error('Failed to get AI suggestions');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Quick Estimate Handler
    const handleQuickEstimate = async () => {
        if (!requirement?.description) return;

        setIsQuickEstimating(true);
        try {
            // 1. Determine Preset (use selected or requirement's or list's default)
            let presetIdToUse = selectedPresetId;
            if (!presetIdToUse) {
                presetIdToUse = requirement.tech_preset_id || list?.tech_preset_id || '';
            }

            // If still no preset, try to find a "General" or "Multi" one, or just pick the first one
            if (!presetIdToUse && presets.length > 0) {
                const defaultPreset = presets.find(p => p.code === 'MULTI' || p.code === 'GENERAL') || presets[0];
                presetIdToUse = defaultPreset.id;
            }

            if (!presetIdToUse) {
                throw new Error('No technology preset available for estimation.');
            }

            const selectedPreset = presets.find(p => p.id === presetIdToUse);
            if (!selectedPreset) throw new Error('Invalid preset selected.');

            // 2. Call AI
            const suggestion = await suggestActivities({
                description: requirement.description,
                preset: selectedPreset,
                activities: activities,
            });

            if (!suggestion.isValidRequirement) {
                setQuickEstimateErrorData({
                    title: 'Estimation Not Possible',
                    message: 'The AI determined that this requirement description is not sufficient or valid for estimation.',
                    reasoning: suggestion.reasoning
                });
                setShowQuickEstimateError(true);
                return;
            }

            // 3. Apply selections
            setSelectedPresetId(presetIdToUse);
            applyAiSuggestions(suggestion.activityCodes); // This triggers calculation via useEffect/useMemo in hook

            // 4. Switch to Estimation tab
            setActiveTab('estimation');
            toast.success('Quick Estimate Generated', {
                description: 'Review the suggested activities and save the estimation.'
            });

        } catch (error) {
            console.error('Quick Estimate error:', error);
            toast.error('Quick Estimate Failed', {
                description: error instanceof Error ? error.message : 'An unexpected error occurred.'
            });
        } finally {
            setIsQuickEstimating(false);
        }
    };

    // Save Estimation Logic
    const handleSaveEstimation = useCallback(() => {
        if (!user || !requirement || !estimationResult) return;
        if (!isEstimationValid) {
            toast.error('Cannot save invalid estimation');
            return;
        }
        setShowScenarioDialog(true);
    }, [user, requirement, estimationResult, isEstimationValid]);

    const confirmSaveEstimation = async () => {
        if (!user || !requirement || !estimationResult) return;

        setIsSaving(true);
        try {
            // Prepare data for RPC
            const estimationData = {
                p_requirement_id: requirement.id,
                p_user_id: user.id,
                p_total_days: estimationResult.totalDays,
                p_base_days: estimationResult.baseDays,
                p_driver_multiplier: estimationResult.driverMultiplier,
                p_risk_score: estimationResult.riskScore,
                p_contingency_percent: estimationResult.contingencyPercent,
                p_scenario_name: scenarioName,
                p_activities: selectedActivityIds.map(id => ({
                    activity_id: id,
                    is_ai_suggested: false, // We don't track this granularly in state yet, simplified
                    notes: null
                })),
                p_drivers: Object.entries(selectedDriverValues).map(([driverId, value]) => ({
                    driver_id: driverId,
                    selected_value: value
                })),
                p_risks: selectedRiskIds.map(id => ({
                    risk_id: id
                }))
            };

            const { error } = await supabase.rpc('save_estimation_atomic', estimationData);

            if (error) throw error;

            toast.success('Estimation saved successfully');
            setShowScenarioDialog(false);
            setScenarioName('Default'); // Reset name
            refetchHistory(); // Refresh history
        } catch (error) {
            console.error('Error saving estimation:', error);
            toast.error('Failed to save estimation');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        if (listId) {
            navigate(`/lists/${listId}/requirements`);
            return;
        }
        navigate('/lists');
    };

    if (requirementLoading || dataLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (requirementError || dataError || !requirement) {
        return (
            <div className="h-screen flex items-center justify-center flex-col gap-4">
                <div className="text-red-500 text-xl font-semibold">Error loading requirement</div>
                <div className="text-slate-600">{requirementError?.message || dataError?.message || 'Requirement not found'}</div>
                <button onClick={handleBack} className="text-blue-600 hover:underline">Go back</button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Header - flex-shrink-0 */}
            <div className="flex-shrink-0">
                <Header />
            </div>

            {/* Page specific info bar - flex-shrink-0 */}
            <div className="flex-shrink-0 relative border-b border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-sm">
                <div className="container mx-auto px-6 py-3">
                    <RequirementHeader
                        requirement={requirement}
                        onBack={handleBack}
                        refetchRequirement={refetchRequirement}
                        onQuickEstimate={handleQuickEstimate}
                        isQuickEstimating={isQuickEstimating}
                    />
                </div>
            </div>

            {/* Content Area with Tabs - flex-1 with internal scroll */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    {/* Tabs Navigation - flex-shrink-0 */}
                    <div className="flex-shrink-0 border-b border-white/20 bg-white/60 backdrop-blur-sm shadow-sm z-10">
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

                    {/* Info Tab - Scrollable */}
                    <TabsContent value="info" className="mt-0 flex-1 overflow-y-auto">
                        <div className="container mx-auto px-6 py-6 h-full">
                            <div className="max-w-7xl mx-auto h-full flex flex-col">
                                <div className="grid lg:grid-cols-2 gap-6 h-full min-h-0">
                                    {/* Left Column */}
                                    <div className="space-y-6 min-h-0 flex flex-col">
                                        {/* Estimation Summary Card */}
                                        {estimationHistory.length > 0 && (
                                            <Card className="rounded-xl shadow-lg border-white/50 bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-sm flex-none">
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

                                        <RequirementDescription
                                            requirement={requirement}
                                            refetchRequirement={refetchRequirement}
                                        />
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4 min-h-0 flex flex-col">
                                        <RequirementInfo
                                            requirement={requirement}
                                            presets={presets}
                                            refetchRequirement={refetchRequirement}
                                        />
                                        <RequirementDriversCard
                                            requirementId={requirement.id}
                                            drivers={drivers}
                                            driverValues={requirementDriverValues}
                                            onSaved={refetchRequirement}
                                            onApplyToEstimate={(map) => setDriverValues(map)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Estimation Tab - Scrollable */}
                    <TabsContent value="estimation" className="mt-0 flex-1 overflow-y-auto">
                        <div className="container mx-auto px-6 py-6">
                            <RequirementEstimation
                                estimationState={estimationState}
                                data={{ presets, activities, drivers, risks }}
                                onSave={handleSaveEstimation}
                                isSaving={isSaving}
                                hasUnsavedChanges={hasUnsavedChanges}
                                onAiSuggest={handleAiSuggest}
                                isAiLoading={isAiLoading}
                                requirementDescription={requirement.description || ''}
                            />
                        </div>
                    </TabsContent>

                    {/* History Tab - Scrollable */}
                    <TabsContent value="history" className="mt-0 flex-1 overflow-y-auto">
                        <div className="container mx-auto px-6 py-6">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <HistorySection
                                    history={estimationHistory}
                                    loading={historyLoading}
                                    totalCount={historyTotalCount}
                                    page={historyPage}
                                    pageSize={HISTORY_PAGE_SIZE}
                                    onPageChange={setHistoryPage}
                                />

                                <Card className="rounded-2xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg font-bold">Compare Estimations</CardTitle>
                                        <CardDescription className="text-xs text-slate-600">Select two saved estimations to analyze differences</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <EstimationComparison
                                            estimations={estimationHistory}
                                            activities={activities}
                                            drivers={drivers}
                                            risks={risks}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Sheet Drawer for Full Estimation Details (History) */}
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

            {/* Quick Estimate Error Dialog */}
            <AlertDialog open={showQuickEstimateError} onOpenChange={setShowQuickEstimateError}>
                <AlertDialogContent className="bg-white/95 backdrop-blur-lg border-white/50 shadow-2xl max-w-lg">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                                <AlertTriangle className="h-6 w-6 text-white" />
                            </div>
                            <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                {quickEstimateErrorData?.title || 'Quick Estimate Failed'}
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-slate-700 text-base leading-relaxed">
                            {quickEstimateErrorData?.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* AI Reasoning Box */}
                    {quickEstimateErrorData?.reasoning && (
                        <div className="my-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                            <div className="flex items-start gap-2">
                                <div className="w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500 rounded-full flex-shrink-0 mt-1"></div>
                                <div>
                                    <h4 className="text-sm font-semibold text-purple-900 mb-1">AI Analysis:</h4>
                                    <p className="text-sm text-purple-800 leading-relaxed">
                                        {quickEstimateErrorData.reasoning}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={() => setShowQuickEstimateError(false)}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
