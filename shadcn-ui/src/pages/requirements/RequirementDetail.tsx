import { useState, useCallback, useMemo, useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useEstimationData } from '@/hooks/useEstimationData';
import { useEstimationState } from '@/hooks/useEstimationState';
import { useRequirement } from '@/hooks/useRequirement';
import { useEstimationHistory } from '@/hooks/useEstimationHistory';
import { useConsultantHistory } from '@/hooks/useConsultantHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText, Calculator, History, ClipboardCheck, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { getConsultantAnalysis } from '@/lib/consultant-api';
import { getLatestRequirementUnderstanding, saveRequirementUnderstanding, saveEstimationByIds } from '@/lib/api';
import {
    orchestrateWizardDomainSave,
    finalizeWizardSnapshot,
    resolveActivitiesById,
    resolveDriversById,
    resolveRisksById,
} from '@/lib/domain-save';
import { filterActivitiesByTechnology } from '@/lib/technology-helpers';
import { PageShell } from '@/components/layout/PageShell';
import type { Activity, EstimationWithDetails } from '@/types/database';
import type { SeniorConsultantAnalysis } from '@/types/estimation';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';

// New Components
import { RequirementHeader } from '@/components/requirements/detail/RequirementHeader';

// Tab Components
import { OverviewTab } from '@/components/requirements/detail/tabs/OverviewTab';
import { EstimationTab } from '@/components/requirements/detail/tabs/EstimationTab';
import { HistoryTab } from '@/components/requirements/detail/tabs/HistoryTab';
import { ActualHoursTab } from '@/components/requirements/detail/tabs/ActualHoursTab';
import { PipelineDebugTab } from '@/components/requirements/detail/tabs/PipelineDebugTab';

const HISTORY_PAGE_SIZE = 50;

export default function RequirementDetail() {
    const navigate = useNavigate();
    const { projectId, reqId } = useParams<{ projectId: string; reqId: string }>();
    const { user } = useAuth();

    // Load requirement data
    const {
        requirement,
        project,
        preset,
        driverValues: requirementDriverValues,
        assignedEstimation,
        loading: requirementLoading,
        error: requirementError,
        refetch: refetchRequirement
    } = useRequirement(projectId, reqId, user?.id);

    // Load estimation master data
    const {
        data: { presets, activities: globalActivities, drivers, risks },
        loading: dataLoading,
        error: dataError
    } = useEstimationData();

    // Fetch project-scoped activities (PRJ_*) and merge with global catalog
    const [projectActivities, setProjectActivities] = useState<Activity[]>([]);
    const [projectActivitiesReady, setProjectActivitiesReady] = useState(false);
    useEffect(() => {
        console.log('[PRJ_ACT] effect fired — requirementLoading:', requirementLoading, 'project?.id:', project?.id);
        // Wait until requirement/project data is loaded before deciding
        if (requirementLoading) return;
        const pid = project?.id;
        if (!pid) {
            console.log('[PRJ_ACT] no project id — marking ready with 0 project activities');
            setProjectActivities([]);
            setProjectActivitiesReady(true);
            return;
        }
        setProjectActivitiesReady(false);
        Promise.resolve(
            supabase
                .from('project_activities')
                .select('id, code, name, base_hours, "group", intervention_type')
                .eq('project_id', pid)
                .eq('is_enabled', true)
        ).then(({ data: paRows }) => {
            console.log('[PRJ_ACT] fetched', paRows?.length ?? 0, 'rows:', paRows?.map((p: any) => p.code));
            if (paRows && paRows.length > 0) {
                setProjectActivities(paRows.map((pa: any) => ({
                    ...pa,
                    tech_category: 'PROJECT',
                })) as unknown as Activity[]);
            } else {
                setProjectActivities([]);
            }
        })
            .catch((err) => { console.error('[PRJ_ACT] fetch error:', err); setProjectActivities([]); })
            .finally(() => { console.log('[PRJ_ACT] marking ready'); setProjectActivitiesReady(true); });
    }, [requirementLoading, project?.id]);

    const activities = useMemo(
        () => [...globalActivities, ...projectActivities],
        [globalActivities, projectActivities],
    );

    // Estimation State Management
    const estimationState = useEstimationState({
        activities,
        drivers,
        risks,
        technologies: presets,
    });

    const {
        selectedPresetId,
        selectedActivityIds,
        aiSuggestedIds,
        selectedDriverValues,
        selectedRiskIds,
        setSelectedPresetId,
        applyPresetDefaults,
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
    const [isSaving, setIsSaving] = useState(false);
    // Scenario naming handled automatically (no dialog)
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedEstimationId, setSelectedEstimationId] = useState<string | null>(null);

    // Senior Consultant State
    const [isConsultantLoading, setIsConsultantLoading] = useState(false);
    const [consultantAnalysis, setConsultantAnalysis] = useState<SeniorConsultantAnalysis | null>(null);

    // Consultant Analysis History
    const {
        history: consultantHistory,
        loading: consultantHistoryLoading,
        saveAnalysis: saveConsultantAnalysis,
    } = useConsultantHistory(requirement?.id);

    // Requirement Understanding (loaded from DB for reopen path)
    const [requirementUnderstanding, setRequirementUnderstanding] = useState<RequirementUnderstanding | null>(null);

    useEffect(() => {
        if (!requirement?.id) return;
        getLatestRequirementUnderstanding(requirement.id)
            .then((row) => {
                if (row?.understanding) {
                    setRequirementUnderstanding(row.understanding as unknown as RequirementUnderstanding);
                }
            })
            .catch((err) => console.warn('Failed to load requirement understanding:', err));
    }, [requirement?.id]);

    // Save edited understanding (new version) and refresh local state
    const handleUnderstandingSave = useCallback(async (updated: RequirementUnderstanding) => {
        if (!requirement?.id) return;
        try {
            await saveRequirementUnderstanding({
                requirementId: requirement.id,
                understanding: updated as unknown as Record<string, unknown>,
                inputDescription: requirement.description || '',
                inputTechCategory: (requirement as any).tech_category || undefined,
            });
            setRequirementUnderstanding(updated);
            toast.success('Analisi AI aggiornata');
        } catch (err) {
            console.error('Failed to save understanding:', err);
            toast.error('Errore nel salvataggio dell\'analisi');
            throw err; // re-throw so OverviewTab keeps edit mode open
        }
    }, [requirement?.id, requirement?.description]);

    // Initialize consultantAnalysis from latest history record if available
    useEffect(() => {
        if (!consultantAnalysis && consultantHistory.length > 0) {
            setConsultantAnalysis(consultantHistory[0].analysis);
        }
    }, [consultantHistory, consultantAnalysis]);


    const fallbackTechnologyId = requirement?.technology_id || requirement?.tech_preset_id || project?.technology_id || project?.tech_preset_id || '';
    const activeTechnologyId = selectedPresetId || fallbackTechnologyId;
    const activeTechnology = useMemo(
        () => presets.find((p) => p.id === activeTechnologyId) || null,
        [presets, activeTechnologyId]
    );

    // Filter activities by technology (canonical FK, fallback to tech_category)
    const filteredActivities = useMemo(() => {
        return filterActivitiesByTechnology(activities, activeTechnology, presets);
    }, [activities, activeTechnology, presets]);

    // Initialize preset when requirement loads (only sets preset ID, does NOT auto-select activities)
    // User can manually select activities or use AI suggestion / "Applica Template" button
    useEffect(() => {
        if (!fallbackTechnologyId || selectedPresetId || presets.length === 0) return;
        setSelectedPresetId(fallbackTechnologyId);
    }, [fallbackTechnologyId, presets, selectedPresetId, setSelectedPresetId]);

    // Hydrate estimation state from assigned/latest saved estimation
    // Uses the same logic as OverviewTab: assigned estimation first, then latest history
    useEffect(() => {
        console.log('[HYDRATE] effect fired — activities:', activities.length,
            'projReady:', projectActivitiesReady,
            'hasSelections:', hasSelections,
            'assignedEst:', !!assignedEstimation,
            'historyLen:', estimationHistory.length,
            'projActivities in merge:', activities.filter(a => (a as any).tech_category === 'PROJECT').length);
        // Wait for master data AND project activities to be loaded
        if (activities.length === 0) { console.log('[HYDRATE] skip: no activities'); return; }
        if (!projectActivitiesReady) { console.log('[HYDRATE] skip: project activities not ready'); return; }
        // Don't overwrite user's in-progress selections
        if (hasSelections) { console.log('[HYDRATE] skip: hasSelections=true'); return; }

        const savedEstimation = assignedEstimation || (estimationHistory[0] as unknown as EstimationWithDetails) || null;
        if (!savedEstimation?.estimation_activities?.length) { console.log('[HYDRATE] skip: no savedEstimation or no activities in it'); return; }

        const activityIds = savedEstimation.estimation_activities
            .map(a => a.activity_id ?? a.project_activity_id)
            .filter((id): id is string => id != null);
        const aiSuggestedActivityIds = savedEstimation.estimation_activities
            .filter(a => a.is_ai_suggested && (a.activity_id != null || a.project_activity_id != null))
            .map(a => (a.activity_id ?? a.project_activity_id) as string);
        const driverValues: Record<string, string> = {};
        (savedEstimation.estimation_drivers || []).forEach(d => {
            driverValues[d.driver_id] = d.selected_value;
        });
        const riskIds = (savedEstimation.estimation_risks || []).map(r => r.risk_id);

        console.log('[HYDRATE] calling hydrateFromEstimation with', activityIds.length, 'IDs:', activityIds,
            '— activities array has', activities.length, 'items,',
            'matching:', activityIds.map(id => activities.find(a => a.id === id)?.code ?? 'NOT_FOUND'));

        estimationState.hydrateFromEstimation({ activityIds, aiSuggestedActivityIds, driverValues, riskIds }, activities);
    }, [assignedEstimation, estimationHistory, activities, projectActivitiesReady, hasSelections, estimationState]);

    // Apply requirement-scoped driver defaults when available (only if no saved estimation to hydrate from)
    useEffect(() => {
        if (!requirementDriverValues || requirementDriverValues.length === 0) return;
        if (Object.keys(selectedDriverValues).length > 0) return;
        // Skip if there's a saved estimation — hydration useEffect above handles drivers
        const savedEstimation = assignedEstimation || estimationHistory[0];
        if (savedEstimation) return;
        const map: Record<string, string> = {};
        requirementDriverValues.forEach((rv) => {
            map[rv.driver_id] = rv.selected_value;
        });
        setDriverValues(map);
    }, [requirementDriverValues, selectedDriverValues, setDriverValues, assignedEstimation, estimationHistory]);

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

        // Compare selected activities - check both count AND actual IDs (exclude PRJ_* which use project_activity_id)
        const savedActivityIds = (lastSaved.estimation_activities || []).map(a => a.activity_id).filter(Boolean) as string[];
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

    // Senior Consultant Analysis Handler
    // Reads activities & drivers from the saved (assigned) estimation, NOT from the Estimation tab state
    const handleRequestConsultant = async () => {
        if (!requirement || !project || !activeTechnology) {
            toast.error('Dati mancanti per l\'analisi del consulente');
            return;
        }

        // Use the assigned estimation stored in DB (shown in the Overview tab)
        const currentEstimation = assignedEstimation || (estimationHistory[0] as unknown as EstimationWithDetails) || null;

        if (!currentEstimation || !currentEstimation.estimation_activities || currentEstimation.estimation_activities.length === 0) {
            toast.error('Nessuna stima salvata disponibile', {
                description: 'Salva prima una stima dal tab Stima per richiedere l\'analisi del consulente.'
            });
            return;
        }

        setIsConsultantLoading(true);
        try {
            // Get auth token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Build activities data from saved estimation
            const savedActivitiesData = currentEstimation.estimation_activities.map(ea => {
                const activity = activities.find(a => a.id === ea.activity_id);
                return {
                    code: activity?.code || '',
                    name: activity?.name || '',
                    description: activity?.description || '',
                    base_hours: activity?.base_hours || 0,
                    group: activity?.group || '',
                };
            }).filter(a => a.code);

            // Build drivers data from saved estimation
            const savedDriversData = (currentEstimation.estimation_drivers || []).map(ed => {
                const driver = drivers.find(d => d.id === ed.driver_id);
                const option = driver?.options.find((o: { value: string; multiplier: number }) => o.value === ed.selected_value);
                return {
                    code: driver?.code || '',
                    name: driver?.name || '',
                    selectedValue: ed.selected_value,
                    multiplier: option?.multiplier || 1.0,
                };
            }).filter(d => d.code);

            const analysis = await getConsultantAnalysis({
                requirementTitle: requirement.title,
                requirementDescription: requirement.description || '',
                activities: savedActivitiesData,
                drivers: savedDriversData,
                projectContext: {
                    name: project.name,
                    description: project.description || '',
                    owner: project.owner || undefined,
                },
                technologyName: activeTechnology.name,
                technologyCategory: activeTechnology.code,
            }, token);

            setConsultantAnalysis(analysis);

            // Save analysis to history with requirement/estimation snapshots
            try {
                await saveConsultantAnalysis({
                    requirementId: requirement.id,
                    estimationId: currentEstimation.id || null,
                    userId: user!.id,
                    analysis,
                    requirementSnapshot: {
                        title: requirement.title,
                        description: requirement.description || '',
                        priority: requirement.priority,
                        state: requirement.state,
                        technology_id: activeTechnology.id,
                        technology_name: activeTechnology.name,
                    },
                    estimationSnapshot: {
                        estimation_id: currentEstimation.id || null,
                        total_days: currentEstimation.total_days,
                        base_hours: currentEstimation.base_hours,
                        driver_multiplier: currentEstimation.driver_multiplier,
                        risk_score: currentEstimation.risk_score,
                        contingency_percent: currentEstimation.contingency_percent,
                        scenario_name: currentEstimation.scenario_name,
                        activities: savedActivitiesData.map(a => ({
                            code: a.code,
                            name: a.name,
                            base_hours: a.base_hours,
                            group: a.group,
                        })),
                        drivers: savedDriversData.map(d => ({
                            code: d.code,
                            name: d.name,
                            selected_value: d.selectedValue,
                            multiplier: d.multiplier,
                        })),
                    },
                });
            } catch (saveErr) {
                // Non-blocking: analysis was still generated, just couldn't save history
                console.warn('Failed to save consultant analysis to history:', saveErr);
            }

            toast.success('Analisi completata', {
                description: `Valutazione: ${analysis.overallAssessment === 'approved' ? 'Approvato' : analysis.overallAssessment === 'needs_review' ? 'Da rivedere' : 'Criticità'}`
            });
        } catch (error) {
            console.error('Consultant analysis error:', error);
            toast.error('Errore nell\'analisi', {
                description: error instanceof Error ? error.message : 'Impossibile completare l\'analisi'
            });
        } finally {
            setIsConsultantLoading(false);
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
            // 1. Resolve current UI selections into domain-ready objects
            const resolvedActivities = resolveActivitiesById(
                selectedActivityIds,
                aiSuggestedIds,
                activities,
            );
            const resolvedDrivers = resolveDriversById(
                selectedDriverValues,
                drivers,
            );
            const resolvedRisks = resolveRisksById(
                selectedRiskIds,
                risks,
            );

            // 2. Domain orchestration: Analysis → ImpactMap → CandidateSet → Decision
            const domainResult = await orchestrateWizardDomainSave({
                requirementId: requirement.id,
                userId: user.id,
                description: requirement.description || '',
                techCategory: activeTechnology?.code ?? null,
                technologyId: activeTechnologyId || null,
                blueprintId: null,
                understanding: requirementUnderstanding
                    ? (requirementUnderstanding as unknown as Record<string, unknown>)
                    : null,
                impactMapData: null,
                activities: resolvedActivities,
                drivers: resolvedDrivers,
                risks: resolvedRisks,
            });

            // 3. Save estimation via RPC — domain engine result is the canonical source
            const estimationId = await saveEstimationByIds({
                requirementId: requirement.id,
                userId: user.id,
                totalDays: domainResult.estimation.totalDays,
                baseHours: domainResult.estimation.baseDays * 8,
                driverMultiplier: domainResult.estimation.driverMultiplier,
                riskScore: domainResult.estimation.riskScore,
                contingencyPercent: domainResult.estimation.contingencyPercent,
                scenarioName: 'Manual Edit',
                analysisId: domainResult.analysisId,
                decisionId: domainResult.decisionId,
                activities: (() => {
                    const projIds = new Set(projectActivities.map(pa => pa.id));
                    return selectedActivityIds.map(id => {
                        const isProject = projIds.has(id);
                        return {
                            activity_id: isProject ? null : id,
                            project_activity_id: isProject ? id : null,
                            is_ai_suggested: aiSuggestedIds.includes(id),
                            notes: null,
                        };
                    });
                })(),
                drivers: Object.entries(selectedDriverValues).map(([driverId, value]) => ({
                    driver_id: driverId,
                    selected_value: value,
                })),
                risks: selectedRiskIds.map(id => ({
                    risk_id: id,
                })),
                seniorConsultantAnalysis: (consultantAnalysis as unknown as Record<string, unknown>) || null,
            });

            // 4. Finalize snapshot (non-blocking — estimation is already saved)
            try {
                await finalizeWizardSnapshot({
                    estimationId,
                    userId: user.id,
                    analysisId: domainResult.analysisId,
                    decisionId: domainResult.decisionId,
                    blueprintId: null,
                    activities: resolvedActivities,
                    drivers: resolvedDrivers,
                    risks: resolvedRisks,
                    estimation: domainResult.estimation,
                });
            } catch (snapshotErr) {
                console.error('Failed to create estimation snapshot (non-blocking):', snapshotErr);
            }

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
        if (projectId) {
            navigate(`/dashboard/${projectId}/requirements`);
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
        <PageShell
            fullHeight
            noContainer
            headerClassName="relative z-20 bg-white border-b border-slate-200"
            className="bg-slate-50"
            contentClassName="flex flex-col overflow-hidden"
        >

            {/* Header — compact */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="container mx-auto px-6 py-3">
                    <RequirementHeader
                        requirement={requirement}
                        onBack={handleBack}
                        refetchRequirement={refetchRequirement}
                        presets={presets}
                        latestEstimation={assignedEstimation || (estimationHistory[0] as unknown as EstimationWithDetails) || null}
                        activities={activities}
                        drivers={drivers}
                        risks={risks}
                    />
                </div>
            </div>

            {/* Content Area - Tab-based Layout */}
            <div className="flex-1 flex flex-col min-h-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    {/* Tab Navigation — underline style */}
                    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                        <div className="container mx-auto px-6">
                            <TabsList className="h-11 bg-transparent border-0 gap-1 p-0">
                                <TabsTrigger
                                    value="info"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <FileText className="w-4 h-4 mr-1.5" />
                                    Panoramica
                                </TabsTrigger>
                                <TabsTrigger
                                    value="estimation"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <Calculator className="w-4 h-4 mr-1.5" />
                                    Stima
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <History className="w-4 h-4 mr-1.5" />
                                    Timeline
                                </TabsTrigger>
                                <TabsTrigger
                                    value="actuals"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <ClipboardCheck className="w-4 h-4 mr-1.5" />
                                    Consuntivo
                                </TabsTrigger>
                                {import.meta.env.DEV && (
                                    <TabsTrigger
                                        value="pipeline-debug"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-indigo-700 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        <FlaskConical className="w-4 h-4 mr-1.5" />
                                        Pipeline Debug
                                    </TabsTrigger>
                                )}
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
                            activities={activities}
                            onRequestConsultant={handleRequestConsultant}
                            isConsultantLoading={isConsultantLoading}
                            consultantAnalysis={consultantAnalysis}
                            requirementUnderstanding={requirementUnderstanding}
                            onNavigateToTab={setActiveTab}
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

                    <TabsContent value="actuals" className="flex-1 min-h-0 m-0 focus-visible:outline-none h-full">
                        <ActualHoursTab
                            assignedEstimation={assignedEstimation || null}
                            estimationHistory={estimationHistory as unknown as EstimationWithDetails[]}
                            userId={user?.id}
                            onRefetch={refetchAll}
                        />
                    </TabsContent>

                    {import.meta.env.DEV && (
                        <TabsContent value="pipeline-debug" className="flex-1 min-h-0 m-0 focus-visible:outline-none h-full">
                            <PipelineDebugTab
                                requirementId={requirement.id}
                                description={requirement.description || ''}
                                projectId={projectId || project?.id}
                                techCategory={activeTechnology?.code}
                            />
                        </TabsContent>
                    )}
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


        </PageShell>
    );
}
