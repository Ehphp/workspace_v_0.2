import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useEstimationData } from '@/hooks/useEstimationData';
import { useEstimationState } from '@/hooks/useEstimationState';
import { useRequirement } from '@/hooks/useRequirement';
import { useEstimationHistory } from '@/hooks/useEstimationHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText, Calculator, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { suggestActivities } from '@/lib/openai';
import { Header } from '@/components/layout/Header';
import type { EstimationWithDetails } from '@/types/database';

// New Components
import { RequirementHeader } from '@/components/requirements/detail/RequirementHeader';

// Tab Components
import { OverviewTab } from '@/components/requirements/detail/tabs/OverviewTab';
import { EstimationTab } from '@/components/requirements/detail/tabs/EstimationTab';
import { HistoryTab } from '@/components/requirements/detail/tabs/HistoryTab';

const HISTORY_PAGE_SIZE = 50;

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
        assignedEstimation,
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
        aiSuggestedIds,
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
    // History State
    const [historyPage, setHistoryPage] = useState(1);
    const {
        history: estimationHistory,
        loading: historyLoading,
        totalCount: historyTotalCount,
        refetch: refetchHistory
    } = useEstimationHistory(requirement?.id, { page: historyPage, pageSize: HISTORY_PAGE_SIZE });

    // Combined refetch for when we need to update both requirement and history
    const refetchAll = useCallback(async () => {
        await Promise.all([refetchRequirement(), refetchHistory()]);
    }, [refetchRequirement, refetchHistory]);

    // UI State
    const [activeTab, setActiveTab] = useState('info');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Scenario naming handled automatically (no dialog)
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedEstimationId, setSelectedEstimationId] = useState<string | null>(null);

    // Quick Estimate State
    const [isQuickEstimating, setIsQuickEstimating] = useState(false);
    const [showQuickEstimateError, setShowQuickEstimateError] = useState(false);
    const [quickEstimateErrorData, setQuickEstimateErrorData] = useState<{ title: string; message: string; reasoning?: string } | null>(null);

    const fallbackPresetId = requirement?.tech_preset_id || list?.tech_preset_id || '';
    const activePresetId = selectedPresetId || fallbackPresetId;
    const activePreset = useMemo(
        () => presets.find((p) => p.id === activePresetId) || null,
        [presets, activePresetId]
    );

    const filterActivitiesForPreset = useCallback((presetToFilter: typeof activePreset) => {
        if (!presetToFilter) return activities;
        return activities.filter(
            (activity) =>
                activity.tech_category === presetToFilter.tech_category ||
                activity.tech_category === 'MULTI'
        );
    }, [activities]);

    const filteredActivities = useMemo(
        () => filterActivitiesForPreset(activePreset),
        [filterActivitiesForPreset, activePreset]
    );

    // Initialize preset when requirement loads
    useEffect(() => {
        if (!fallbackPresetId || selectedPresetId || presets.length === 0) return;

        setSelectedPresetId(fallbackPresetId);
        if (requirement?.tech_preset_id) {
            // Optionally apply defaults if no selections made yet
            const hasRequirementDrivers = (requirementDriverValues?.length || 0) > 0;
            if (!hasSelections && !hasRequirementDrivers) {
                applyPresetDefaults(fallbackPresetId);
            }
        }
    }, [fallbackPresetId, presets, selectedPresetId, hasSelections, applyPresetDefaults, requirementDriverValues, requirement?.tech_preset_id, setSelectedPresetId]);

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

    // Check for unsaved changes by comparing current estimation with last saved
    const hasUnsavedChanges = useMemo(() => {
        if (!estimationResult) return false;

        // If no history, any result is unsaved
        if (estimationHistory.length === 0) return true;

        // Compare with the most recent saved estimation
        const lastSaved = estimationHistory[0];

        // Compare key values (with tolerance for floating point)
        const totalDiff = Math.abs(estimationResult.totalDays - lastSaved.total_days);
        const multiplierDiff = Math.abs(estimationResult.driverMultiplier - lastSaved.driver_multiplier);
        const riskDiff = Math.abs(estimationResult.riskScore - lastSaved.risk_score);

        // If any significant difference, mark as unsaved
        if (totalDiff > 0.01 || multiplierDiff > 0.001 || riskDiff > 0) return true;

        // Compare selected activities - check both count AND actual IDs
        const savedActivityIds = (lastSaved.estimation_activities || []).map(a => a.activity_id);
        if (selectedActivityIds.length !== savedActivityIds.length) return true;
        const activityIdsMatch = selectedActivityIds.every(id => savedActivityIds.includes(id));
        if (!activityIdsMatch) return true;

        // Compare selected risks - check both count AND actual IDs
        const savedRiskIds = (lastSaved.estimation_risks || []).map(r => r.risk_id);
        if (selectedRiskIds.length !== savedRiskIds.length) return true;
        const riskIdsMatch = selectedRiskIds.every(id => savedRiskIds.includes(id));
        if (!riskIdsMatch) return true;

        return false;
    }, [estimationResult, estimationHistory, selectedActivityIds, selectedRiskIds]);

    // AI Suggestion Handler
    const handleAiSuggest = async () => {
        if (!requirement?.description) return;
        if (!activePreset) {
            toast.error('Seleziona una tecnologia per richiedere suggerimenti AI');
            return;
        }

        setIsAiLoading(true);
        try {
            const suggestion = await suggestActivities({
                description: requirement.description,
                preset: activePreset,
                activities: filteredActivities,
            });

            if (!selectedPresetId && activePreset.id) {
                setSelectedPresetId(activePreset.id);
            }

            if (suggestion.isValidRequirement) {
                const suggestedActivityIds = (suggestion.activityCodes || [])
                    .map((code) => filteredActivities.find((a) => a.code === code)?.id)
                    .filter((id): id is string => Boolean(id));

                const fallbackActivityIds = (activePreset.default_activity_codes || [])
                    .map((code) => filteredActivities.find((a) => a.code === code)?.id)
                    .filter((id): id is string => Boolean(id));

                const activityIdsToApply = suggestedActivityIds.length > 0 ? suggestedActivityIds : fallbackActivityIds;

                if (activityIdsToApply.length === 0) {
                    toast.error('Nessuna attivita compatibile trovata per la tecnologia selezionata.');
                    return;
                }

                applyAiSuggestions(activityIdsToApply, undefined, undefined); // Drivers/Risks handled manually or by defaults
                toast.success('AI suggestions applied', {
                    description: `Added ${activityIdsToApply.length} activities based on description.`
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
                throw new Error('No technology available for estimation.');
            }

            const selectedPreset = presets.find(p => p.id === presetIdToUse);
            if (!selectedPreset) throw new Error('Invalid technology selected.');

            const activitiesForPreset = filterActivitiesForPreset(selectedPreset);
            if (activitiesForPreset.length === 0) {
                throw new Error('No activities available for the selected technology.');
            }

            // 2. Call AI
            const suggestion = await suggestActivities({
                description: requirement.description,
                preset: selectedPreset,
                activities: activitiesForPreset,
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
            const suggestedActivityIds = (suggestion.activityCodes || [])
                .map((code) => activitiesForPreset.find((a) => a.code === code)?.id)
                .filter((id): id is string => Boolean(id));

            const fallbackActivityIds = (selectedPreset.default_activity_codes || [])
                .map((code) => activitiesForPreset.find((a) => a.code === code)?.id)
                .filter((id): id is string => Boolean(id));

            const activityIdsToApply = suggestedActivityIds.length > 0 ? suggestedActivityIds : fallbackActivityIds;

            if (activityIdsToApply.length === 0) {
                throw new Error('No compatible activities found for the selected technology.');
            }

            applyAiSuggestions(activityIdsToApply); // This triggers calculation via useEffect/useMemo in hook

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
        confirmSaveEstimation();
    }, [user, requirement, estimationResult, isEstimationValid]);

    const confirmSaveEstimation = async () => {
        if (!user || !requirement || !estimationResult) return;

        setIsSaving(true);
        try {
            const autoScenarioName = 'Manual Edit';
            // Prepare data for RPC
            const estimationData = {
                p_requirement_id: requirement.id,
                p_user_id: user.id,
                p_total_days: estimationResult.totalDays,
                p_base_hours: estimationResult.baseDays * 8, // Convert back to hours for storage if needed, OR if p_base_days was renamed to p_base_hours in RPC
                p_driver_multiplier: estimationResult.driverMultiplier,
                p_risk_score: estimationResult.riskScore,
                p_contingency_percent: estimationResult.contingencyPercent,
                p_scenario_name: autoScenarioName,
                p_activities: selectedActivityIds.map(id => ({
                    activity_id: id,
                    is_ai_suggested: aiSuggestedIds.includes(id),
                    notes: null
                })),
                p_drivers: Object.entries(selectedDriverValues).map(([driverId, value]) => ({
                    driver_id: driverId,
                    selected_value: value
                })),
                p_risks: selectedRiskIds.map(id => ({
                    risk_id: id
                })),
                p_ai_reasoning: null // Not from AI interview flow
            };

            const { error } = await supabase.rpc('save_estimation_atomic', estimationData);

            if (error) throw error;

            toast.success('Estimation saved successfully');
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
            navigate(`/dashboard/${listId}/requirements`);
            return;
        }
        navigate('/dashboard');
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
        <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Animated Background Blobs */}
            <motion.div
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, -100, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-20 w-[30rem] h-[30rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, 100, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-0 left-1/3 w-[25rem] h-[25rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />

            {/* Header - flex-shrink-0 */}
            <div className="flex-shrink-0 relative z-20 bg-white/70 backdrop-blur-xl border-b border-white/50">
                <Header />
            </div>

            {/* Page specific info bar - flex-shrink-0 */}
            <div className="flex-shrink-0 relative z-10 border-b border-white/50 bg-white/60 backdrop-blur-xl">
                <div className="container mx-auto px-6 py-4">
                    <RequirementHeader
                        requirement={requirement}
                        onBack={handleBack}
                        refetchRequirement={refetchRequirement}
                        presets={presets}
                    />
                </div>
            </div>

            {/* Content Area - Tab-based Layout (No Global Scroll) */}
            <div className="flex-1 relative z-10 flex flex-col min-h-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    {/* Tab Navigation */}
                    <div className="flex-shrink-0 border-b border-slate-200/50 bg-white/60 backdrop-blur-xl">
                        <div className="container mx-auto px-6">
                            <TabsList className="h-14 bg-transparent border-0 gap-2">
                                <TabsTrigger
                                    value="info"
                                    className="data-[state=active]:bg-white/90 data-[state=active]:shadow-md rounded-xl border-2 border-transparent data-[state=active]:border-blue-500/20 px-5 py-2.5 transition-all duration-200"
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Panoramica
                                </TabsTrigger>
                                <TabsTrigger
                                    value="estimation"
                                    className="data-[state=active]:bg-white/90 data-[state=active]:shadow-md rounded-xl border-2 border-transparent data-[state=active]:border-blue-500/20 px-5 py-2.5 transition-all duration-200"
                                >
                                    <Calculator className="w-4 h-4 mr-2" />
                                    Stima
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-white/90 data-[state=active]:shadow-md rounded-xl border-2 border-transparent data-[state=active]:border-blue-500/20 px-5 py-2.5 transition-all duration-200"
                                >
                                    <History className="w-4 h-4 mr-2" />
                                    Storico
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    {/* Tab Content - Each tab manages its own scroll */}
                    <TabsContent value="info" className="flex-1 min-h-0 m-0 focus-visible:outline-none h-full">
                        <OverviewTab
                            requirement={requirement}
                            presets={presets}
                            refetchRequirement={refetchAll}
                            latestEstimation={assignedEstimation || (estimationHistory[0] as unknown as EstimationWithDetails) || null}
                            activities={filteredActivities}
                        />
                    </TabsContent>

                    <TabsContent value="estimation" className="flex-1 min-h-0 m-0 focus-visible:outline-none h-full">
                        <EstimationTab
                            requirement={requirement}
                            estimationState={estimationState}
                            data={{ presets, activities: filteredActivities, drivers, risks }}
                            onSave={handleSaveEstimation}
                            isSaving={isSaving}
                            hasUnsavedChanges={hasUnsavedChanges}
                            onAiSuggest={handleAiSuggest}
                            isAiLoading={isAiLoading}
                            requirementDescription={requirement.description || ''}
                        />
                    </TabsContent>

                    <TabsContent value="history" className="flex-1 min-h-0 m-0 focus-visible:outline-none h-full">
                        <HistoryTab
                            history={estimationHistory}
                            loading={historyLoading}
                            totalCount={historyTotalCount}
                            page={historyPage}
                            pageSize={HISTORY_PAGE_SIZE}
                            onPageChange={setHistoryPage}
                            activities={activities}
                            drivers={drivers}
                            risks={risks}
                            assignedEstimationId={requirement.assigned_estimation_id}
                            onAssign={refetchRequirement}
                            requirementId={requirement.id}
                        />
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
                                                <span className="font-bold text-slate-900">{(selectedEst.base_hours / 8).toFixed(1)}d</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Driver Multiplier:</span>
                                                <span className="font-bold text-slate-900">{selectedEst.driver_multiplier.toFixed(3)}x</span>
                                            </div>
                                            <div className="border-t pt-2">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="text-slate-700">Subtotal:</span>
                                                    <span className="font-bold text-slate-900">
                                                        {((selectedEst.base_hours / 8) * selectedEst.driver_multiplier).toFixed(1)}d
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
                                                            <span className="font-mono font-semibold text-blue-700 ml-2">{activity?.base_hours.toFixed(1)}h</span>
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
                                            Subtotal = {(selectedEst.base_hours / 8).toFixed(1)} × {selectedEst.driver_multiplier.toFixed(3)} = {((selectedEst.base_hours / 8) * selectedEst.driver_multiplier).toFixed(1)}d
                                        </div>
                                        <div className="text-slate-700">
                                            Total = {((selectedEst.base_hours / 8) * selectedEst.driver_multiplier).toFixed(1)} × (1 + {selectedEst.contingency_percent}%) = {selectedEst.total_days.toFixed(1)}d
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </SheetContent>
            </Sheet>

            {/* Scenario Name Dialog */}
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
