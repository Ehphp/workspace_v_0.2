import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, Calculator, History, User, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Requirement, TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import type { EstimationResult } from '@/types/estimation';
import { calculateEstimation } from '@/lib/estimationEngine';
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
    const [requirement, setRequirement] = useState<Requirement | null>(null);
    const [preset, setPreset] = useState<TechnologyPreset | null>(null);
    const [loading, setLoading] = useState(true);

    // Estimation state
    const [presets, setPresets] = useState<TechnologyPreset[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);

    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
    const [aiSuggestedIds, setAiSuggestedIds] = useState<string[]>([]);
    const [selectedDriverValues, setSelectedDriverValues] = useState<Record<string, string>>({});
    const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

    const [estimationResult, setEstimationResult] = useState<EstimationResult | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // History state
    const [estimationHistory, setEstimationHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showScenarioDialog, setShowScenarioDialog] = useState(false);
    const [scenarioName, setScenarioName] = useState('Default');

    useEffect(() => {
        if (user && listId && reqId) {
            loadData();
            loadEstimationData();
            loadEstimationHistory();
        }
    }, [user, listId, reqId]);

    useEffect(() => {
        // Recalculate estimation whenever selections change
        if (activities.length > 0 && drivers.length > 0 && risks.length > 0) {
            calculateCurrentEstimation();
        }
    }, [selectedActivityIds, selectedDriverValues, selectedRiskIds, activities, drivers, risks]);

    const loadData = async () => {
        if (!user || !listId || !reqId) return;

        // Load requirement
        const { data: reqData, error: reqError } = await supabase
            .from('requirements')
            .select('*')
            .eq('id', reqId)
            .eq('list_id', listId)
            .single();

        if (reqError) {
            console.error('Error loading requirement:', reqError);
            navigate(`/lists/${listId}/requirements`);
            return;
        }

        setRequirement(reqData);

        // Load technology preset
        if (reqData.tech_preset_id) {
            const { data: presetData } = await supabase
                .from('technology_presets')
                .select('*')
                .eq('id', reqData.tech_preset_id)
                .single();

            if (presetData) {
                setPreset(presetData);
            }
        }

        setLoading(false);
    };

    const loadEstimationData = async () => {
        // Load all presets
        const { data: presetsData } = await supabase
            .from('technology_presets')
            .select('*')
            .order('name');
        if (presetsData) setPresets(presetsData);

        // Load all activities
        const { data: activitiesData } = await supabase
            .from('activities')
            .select('*')
            .eq('active', true)
            .order('group, name');
        if (activitiesData) setActivities(activitiesData);

        // Load all drivers
        const { data: driversData } = await supabase
            .from('drivers')
            .select('*')
            .order('code');
        if (driversData) setDrivers(driversData);

        // Load all risks
        const { data: risksData } = await supabase
            .from('risks')
            .select('*')
            .order('weight');
        if (risksData) setRisks(risksData);
    };

    const loadEstimationHistory = async () => {
        if (!reqId) return;

        setIsLoadingHistory(true);
        try {
            const { data: estimations, error } = await supabase
                .from('estimations')
                .select(`
                    *,
                    estimation_activities (activity_id, is_ai_suggested),
                    estimation_drivers (driver_id, selected_value),
                    estimation_risks (risk_id)
                `)
                .eq('requirement_id', reqId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEstimationHistory(estimations || []);
        } catch (error) {
            console.error('Error loading estimation history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const calculateCurrentEstimation = () => {
        const selectedActivities = activities
            .filter((a) => selectedActivityIds.includes(a.id))
            .map((a) => ({
                code: a.code,
                baseDays: a.base_days,
                isAiSuggested: aiSuggestedIds.includes(a.id),
            }));

        const selectedDrivers = Object.entries(selectedDriverValues)
            .map(([code, value]) => {
                const driver = drivers.find((d) => d.code === code);
                const option = driver?.options.find((o) => o.value === value);
                return option ? {
                    code,
                    value,
                    multiplier: option.multiplier,
                } : null;
            })
            .filter((d): d is NonNullable<typeof d> => d !== null);

        const selectedRisks = risks
            .filter((r) => selectedRiskIds.includes(r.id))
            .map((r) => ({
                code: r.code,
                weight: r.weight,
            }));

        if (selectedActivities.length === 0) {
            setEstimationResult(null);
            return;
        }

        const result = calculateEstimation({
            activities: selectedActivities,
            drivers: selectedDrivers,
            risks: selectedRisks,
        });

        setEstimationResult(result);
        setHasUnsavedChanges(true);
    };

    const handlePresetChange = (presetId: string) => {
        setSelectedPresetId(presetId);
        const preset = presets.find((p) => p.id === presetId);
        if (preset) {
            // Apply preset defaults
            setSelectedDriverValues(preset.default_driver_values || {});

            const defaultActivityIds = activities
                .filter((a) => preset.default_activity_codes?.includes(a.code))
                .map((a) => a.id);
            setSelectedActivityIds(defaultActivityIds);

            const defaultRiskIds = risks
                .filter((r) => preset.default_risks?.includes(r.code))
                .map((r) => r.id);
            setSelectedRiskIds(defaultRiskIds);

            setAiSuggestedIds([]);
        }
    };

    const handleAiSuggest = async () => {
        if (!requirement?.description || !selectedPresetId) {
            toast.error('Please select a technology preset first');
            return;
        }

        setIsAiLoading(true);
        try {
            const selectedPreset = presets.find((p) => p.id === selectedPresetId);
            if (!selectedPreset) return;

            const suggestions = await suggestActivities({
                description: requirement.description,
                preset: selectedPreset,
                activities,
                drivers,
                risks,
            });

            // Apply AI suggestions
            const suggestedActivityIds = activities
                .filter((a) => suggestions.activityCodes.includes(a.code))
                .map((a) => a.id);

            setSelectedActivityIds(suggestedActivityIds);
            setAiSuggestedIds(suggestedActivityIds);

            if (suggestions.suggestedDrivers) {
                setSelectedDriverValues(suggestions.suggestedDrivers);
            }

            if (suggestions.suggestedRisks) {
                const suggestedRiskIds = risks
                    .filter((r) => suggestions.suggestedRisks?.includes(r.code))
                    .map((r) => r.id);
                setSelectedRiskIds(suggestedRiskIds);
            }

            toast.success('AI suggestions applied successfully');
        } catch (error) {
            console.error('AI suggestion error:', error);
            toast.error('Failed to get AI suggestions');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleActivityToggle = (activityId: string) => {
        setSelectedActivityIds((prev) =>
            prev.includes(activityId)
                ? prev.filter((id) => id !== activityId)
                : [...prev, activityId]
        );
    };

    const handleDriverChange = (driverCode: string, value: string) => {
        setSelectedDriverValues((prev) => ({
            ...prev,
            [driverCode]: value,
        }));
    };

    const handleRiskToggle = (riskId: string) => {
        setSelectedRiskIds((prev) =>
            prev.includes(riskId)
                ? prev.filter((id) => id !== riskId)
                : [...prev, riskId]
        );
    };

    const handleSaveEstimation = async () => {
        if (!user || !requirement || !estimationResult) return;
        setShowScenarioDialog(true);
    };

    const confirmSaveEstimation = async () => {
        if (!user || !requirement || !estimationResult) return;

        setIsSaving(true);
        setShowScenarioDialog(false);
        try {
            // Save estimation
            const { data: estimation, error: estError } = await supabase
                .from('estimations')
                .insert({
                    requirement_id: requirement.id,
                    user_id: user.id,
                    total_days: estimationResult.totalDays,
                    base_days: estimationResult.baseDays,
                    driver_multiplier: estimationResult.driverMultiplier,
                    risk_score: estimationResult.riskScore,
                    contingency_percent: estimationResult.contingencyPercent,
                    scenario_name: scenarioName || 'Default',
                })
                .select()
                .single();

            if (estError) throw estError;

            // Save activities
            const activityRecords = selectedActivityIds.map((activityId) => ({
                estimation_id: estimation.id,
                activity_id: activityId,
                is_ai_suggested: aiSuggestedIds.includes(activityId),
                notes: '',
            }));

            if (activityRecords.length > 0) {
                await supabase.from('estimation_activities').insert(activityRecords);
            }

            // Save drivers
            const driverRecords = Object.entries(selectedDriverValues).map(([code, value]) => {
                const driver = drivers.find((d) => d.code === code);
                return {
                    estimation_id: estimation.id,
                    driver_id: driver?.id || '',
                    selected_value: value,
                };
            }).filter((r) => r.driver_id);

            if (driverRecords.length > 0) {
                await supabase.from('estimation_drivers').insert(driverRecords);
            }

            // Save risks
            const riskRecords = selectedRiskIds.map((riskId) => ({
                estimation_id: estimation.id,
                risk_id: riskId,
            }));

            if (riskRecords.length > 0) {
                await supabase.from('estimation_risks').insert(riskRecords);
            }

            setHasUnsavedChanges(false);
            setScenarioName('Default');
            toast.success('Estimation saved successfully');

            // Reload history
            await loadEstimationHistory();
        } catch (error) {
            console.error('Error saving estimation:', error);
            toast.error('Failed to save estimation');
        } finally {
            setIsSaving(false);
        }
    };

    const getPriorityBadge = (priority: string) => {
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
    };

    const getStateBadge = (state: string) => {
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
    };

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
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Fixed Header */}
            <header className="border-b bg-white flex-none shadow-sm">
                <div className="container mx-auto px-4 py-2">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/lists/${listId}/requirements`)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{requirement.req_id}</span>
                                {getPriorityBadge(requirement.priority)}
                                {getStateBadge(requirement.state)}
                            </div>
                            <h1 className="text-base font-semibold truncate">{requirement.title}</h1>
                        </div>
                        <Button size="sm" variant="outline">Edit</Button>
                    </div>
                </div>
            </header>

            {/* Content Area with Tabs */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                    <Tabs defaultValue="info" className="h-full flex flex-col">
                        {/* Tabs Navigation */}
                        <TabsList className="w-full justify-start border-b bg-white h-10 rounded-none flex-none px-4">
                            <TabsTrigger value="info" className="gap-2 text-xs">
                                <FileText className="h-3 w-3" />
                                Info
                            </TabsTrigger>
                            <TabsTrigger value="estimation" className="gap-2 text-xs">
                                <Calculator className="h-3 w-3" />
                                Estimation
                            </TabsTrigger>
                            <TabsTrigger value="history" className="gap-2 text-xs">
                                <History className="h-3 w-3" />
                                History
                            </TabsTrigger>
                        </TabsList>
                        {/* Info Tab */}
                        <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 px-4 py-3">
                            <div className="max-w-4xl space-y-3">
                                <Card className="rounded-lg shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold">Description</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs whitespace-pre-wrap text-gray-700">
                                            {requirement.description || 'No description provided'}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="rounded-lg shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold">Details</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-muted-foreground text-xs">Priority:</span>
                                                <div className="mt-1">{getPriorityBadge(requirement.priority)}</div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">State:</span>
                                                <div className="mt-1">{getStateBadge(requirement.state)}</div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">Business Owner:</span>
                                                <div className="mt-1 font-medium text-xs">{requirement.business_owner || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">Technology:</span>
                                                <div className="mt-1 font-medium text-xs">{preset?.name || 'N/A'}</div>
                                            </div>
                                            {requirement.labels && requirement.labels.length > 0 && (
                                                <div className="col-span-2">
                                                    <span className="text-muted-foreground text-xs">Labels:</span>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {requirement.labels.map((label, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-xs">{label}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Estimation Tab */}
                        <TabsContent value="estimation" className="flex-1 overflow-hidden mt-0">
                            <div className="h-full overflow-y-auto px-4 py-3">
                                <div className="grid lg:grid-cols-[1fr_320px] gap-3 h-full">
                                    {/* Left Column - Configuration */}
                                    <div className="space-y-3 overflow-y-auto pr-2">
                                        <TechnologySection
                                            presets={presets}
                                            selectedPresetId={selectedPresetId}
                                            onPresetChange={handlePresetChange}
                                            onAiRecalculate={handleAiSuggest}
                                            isAiLoading={isAiLoading}
                                            requirementDescription={requirement?.description || ''}
                                        />

                                        <ActivitiesSection
                                            activities={activities}
                                            selectedActivityIds={selectedActivityIds}
                                            aiSuggestedIds={aiSuggestedIds}
                                            onActivityToggle={handleActivityToggle}
                                        />

                                        <DriversSection
                                            drivers={drivers}
                                            selectedDriverValues={selectedDriverValues}
                                            onDriverChange={handleDriverChange}
                                            currentMultiplier={estimationResult?.driverMultiplier || 1.0}
                                        />

                                        <RisksSection
                                            risks={risks}
                                            selectedRiskIds={selectedRiskIds}
                                            onRiskToggle={handleRiskToggle}
                                            currentRiskScore={estimationResult?.riskScore || 0}
                                        />
                                    </div>

                                    {/* Right Column - Summary (Sticky) */}
                                    <div className="overflow-y-auto">
                                        <div className="sticky top-0">
                                            <CalculationSummary
                                                result={estimationResult}
                                                onSave={handleSaveEstimation}
                                                isSaving={isSaving}
                                                hasUnsavedChanges={hasUnsavedChanges}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* History Tab */}
                        <TabsContent value="history" className="flex-1 overflow-y-auto mt-0 px-4 py-3">
                            <div className="max-w-6xl space-y-4">
                                {/* Estimation Timeline */}
                                {estimationHistory.length > 0 && (
                                    <EstimationTimeline estimations={estimationHistory} />
                                )}

                                {/* Estimation History List */}
                                <Card className="rounded-lg shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold">Estimation History</CardTitle>
                                        <CardDescription className="text-xs">
                                            View all previous estimations and scenarios for this requirement
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingHistory ? (
                                            <div className="text-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                            </div>
                                        ) : estimationHistory.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                                <p className="text-xs">No estimation history yet</p>
                                                <p className="text-xs mt-1">Save an estimation to start building history</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {estimationHistory.map((est) => (
                                                    <Card key={est.id} className="border-l-4 border-l-primary">
                                                        <CardContent className="p-4">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div>
                                                                    <h4 className="font-semibold text-sm">{est.scenario_name}</h4>
                                                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock className="h-3 w-3" />
                                                                            {new Date(est.created_at).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-2xl font-bold text-primary">
                                                                        {est.total_days.toFixed(1)}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">days</div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-4 gap-3 text-xs">
                                                                <div>
                                                                    <span className="text-muted-foreground">Base Days:</span>
                                                                    <div className="font-semibold">{est.base_days.toFixed(1)}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Multiplier:</span>
                                                                    <div className="font-semibold">{est.driver_multiplier.toFixed(3)}x</div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Risk Score:</span>
                                                                    <div className="font-semibold">{est.risk_score}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Contingency:</span>
                                                                    <div className="font-semibold">{est.contingency_percent}%</div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                                                                <span>{est.estimation_activities?.length || 0} activities</span>
                                                                <span>•</span>
                                                                <span>{est.estimation_drivers?.length || 0} drivers</span>
                                                                <span>•</span>
                                                                <span>{est.estimation_risks?.length || 0} risks</span>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Estimation Comparison */}
                                {estimationHistory.length >= 2 && (
                                    <EstimationComparison
                                        estimations={estimationHistory}
                                        activities={activities}
                                        drivers={drivers}
                                        risks={risks}
                                    />
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Scenario Name Dialog */}
            <AlertDialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Save Estimation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Give this estimation a name to identify it in the history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label htmlFor="scenario-name">Scenario Name</Label>
                        <Input
                            id="scenario-name"
                            placeholder="e.g., Base Estimate, With Integration, Optimistic"
                            value={scenarioName}
                            onChange={(e) => setScenarioName(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setScenarioName('Default')}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmSaveEstimation} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Estimation'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
