import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateEstimation } from '@/lib/estimationEngine';
import type { Activity } from '@/types/database';
import { sanitizePromptInput } from '@/types/ai-validation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { buildFunctionUrl } from '@/lib/netlify';

interface Requirement {
    id: string;
    req_id: string;
    title: string;
    description: string;
    tech_preset_id: string | null;
}

interface BulkEstimateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requirements: Requirement[];
    listId: string;
    listTechPresetId: string | null; // Default tech preset from list
    onSuccess: () => void;
}

type EstimateStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';

interface RequirementStatus {
    requirement: Requirement;
    status: EstimateStatus;
    error?: string;
}

const MAX_CONCURRENT = 3; // Max 3 concurrent GPT calls

export function BulkEstimateDialog({
    open,
    onOpenChange,
    requirements,
    listId,
    listTechPresetId,
    onSuccess,
}: BulkEstimateDialogProps) {
    const [step, setStep] = useState<'confirm' | 'processing' | 'complete'>('confirm');
    const [statuses, setStatuses] = useState<RequirementStatus[]>([]);
    const [progress, setProgress] = useState(0);
    const [cancelled, setCancelled] = useState(false);

    // Filter requirements that can be estimated
    // Use requirement's tech_preset_id if set, otherwise fallback to list's tech_preset_id
    const estimableRequirements = requirements.filter((req) => {
        const techPresetId = req.tech_preset_id || listTechPresetId;
        return techPresetId && req.description && req.description.trim() !== '';
    });

    const skippedCount = requirements.length - estimableRequirements.length;
    const estimatedTime = Math.ceil((estimableRequirements.length / MAX_CONCURRENT) * 2); // ~2 seconds per batch

    const handleStartEstimation = async () => {
        setStep('processing');
        setCancelled(false);

        // Initialize statuses
        const initialStatuses: RequirementStatus[] = estimableRequirements.map((req) => ({
            requirement: req,
            status: 'pending',
        }));
        setStatuses(initialStatuses);

        let completed = 0;
        const results: RequirementStatus[] = [...initialStatuses];

        // Fetch current user once
        const {
            data: sessionData,
            error: sessionError,
        } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const accessToken = sessionData?.session?.access_token;
        if (sessionError || !userId) {
            const errorStatuses = estimableRequirements.map((req) => ({
                requirement: req,
                status: 'error' as EstimateStatus,
                error: 'User not authenticated',
            }));
            setStatuses(errorStatuses);
            setStep('complete');
            return;
        }
        const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const aiFunctionUrl = buildFunctionUrl('ai-suggest');

        // PRE-LOAD all data once (huge performance boost for bulk)
        console.log('Pre-loading catalogs for bulk processing...');
        const [activitiesRes, driversRes, risksRes] = await Promise.all([
            supabase.from('activities').select('*').eq('active', true),
            supabase.from('drivers').select('*'),
            supabase.from('risks').select('*'),
        ]);

        const sharedActivities = activitiesRes.data || [];
        const sharedDrivers = driversRes.data || [];
        const sharedRisks = risksRes.data || [];

        // Pre-load all unique presets
        const uniquePresetIds = [...new Set(estimableRequirements.map(r => r.tech_preset_id || listTechPresetId).filter(Boolean))];
        type PivotRow = { tech_preset_id: string; activity_id: string; position: number | null };
        const [presetsRes, pivotRes] = await Promise.all([
            supabase
                .from('technology_presets')
                .select('*')
                .in('id', uniquePresetIds as string[]),
            supabase
                .from('technology_preset_activities')
                .select('tech_preset_id, activity_id, position')
                .in('tech_preset_id', uniquePresetIds as string[]),
        ]);

        const activityById = new Map(sharedActivities.map((a: Activity) => [a.id, a]));
        const pivotByPreset = new Map<string, { activity_id: string; position: number | null }[]>();
        (pivotRes.data as PivotRow[] | null || []).forEach((row) => {
            if (!pivotByPreset.has(row.tech_preset_id)) {
                pivotByPreset.set(row.tech_preset_id, []);
            }
            pivotByPreset.get(row.tech_preset_id)!.push({
                activity_id: row.activity_id,
                position: row.position ?? null,
            });
        });

        const normalizedPresets = (presetsRes.data || []).map((p) => {
            const rows = pivotByPreset.get(p.id) || [];
            if (rows.length === 0) return p;

            const codes = rows
                .sort((a, b) => {
                    const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                    const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                    return pa - pb;
                })
                .map((r) => activityById.get(r.activity_id)?.code)
                .filter((code): code is string => Boolean(code));

            if (codes.length === 0) return p;
            return { ...p, default_activity_codes: codes };
        });

        const presetsMap = new Map(normalizedPresets.map(p => [p.id, p]));
        console.log('Pre-loaded data ready');

        // Process in batches of MAX_CONCURRENT
        for (let i = 0; i < estimableRequirements.length; i += MAX_CONCURRENT) {
            if (cancelled) break;

            const batch = estimableRequirements.slice(i, i + MAX_CONCURRENT);

            // Mark batch as processing
            batch.forEach((req) => {
                const index = results.findIndex((r) => r.requirement.id === req.id);
                if (index !== -1) {
                    results[index].status = 'processing';
                }
            });
            setStatuses([...results]);

            // Process batch in parallel
            const promises = batch.map(async (req) => {
                try {
                    // Use requirement's tech_preset_id if set, otherwise use list's default
                    const techPresetId = req.tech_preset_id || listTechPresetId;

                    if (!techPresetId) {
                        throw new Error('No technology preset available');
                    }

                    // Use pre-loaded preset (no DB call!)
                    const preset = presetsMap.get(techPresetId);
                    if (!preset) {
                        throw new Error('Technology preset not found');
                    }

                    // Reuse pre-loaded data (no DB calls!) and filter by tech category
                    const activities = sharedActivities.filter(
                        (a: Activity) =>
                            a.tech_category === preset.tech_category ||
                            a.tech_category === 'MULTI'
                    );
                    if (activities.length === 0) {
                        return {
                            requirementId: req.id,
                            success: false,
                            error: 'No compatible activities for preset category',
                        };
                    }

                    // Sanitize input to prevent injection attacks (consistency with openai.ts)
                    const sanitizedDescription = sanitizePromptInput(req.description);

                    // Call AI suggestion API
                    console.log('🔍 Calling AI API for:', req.req_id);
                    console.log('  - Description length:', sanitizedDescription?.length);
                    console.log('  - Preset:', preset.name);
                    console.log('  - Activities:', activities?.length);

                    const response = await fetch(aiFunctionUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...authHeader,
                        },
                        body: JSON.stringify({
                            description: sanitizedDescription,
                            preset,
                            activities,
                            drivers: sharedDrivers,
                            risks: sharedRisks,
                        }),
                    });

                    console.log('📡 Response status:', response.status);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('❌ AI API Error:', errorData);
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const aiSuggestion = await response.json();

                    // Reject invalid requirements immediately (no fallback to defaults)
                    if (!aiSuggestion.isValidRequirement) {
                        return {
                            requirementId: req.id,
                            success: false,
                            error: aiSuggestion.reasoning || 'Requirement description is not valid for estimation',
                        };
                    }

                    // Pick AI suggestions when valid; fallback to preset defaults filtered by allowed activities
                    const aiActivityCodes =
                        (aiSuggestion.activityCodes || []).filter((code: string) =>
                            activities.some((a: Activity) => a.code === code)
                        );

                    let chosenCodes: string[] = aiActivityCodes;

                    if (chosenCodes.length === 0) {
                        // Fallback to preset defaults (already normalized via pivot)
                        chosenCodes = (preset.default_activity_codes || []).filter((code: string) =>
                            activities.some((a: Activity) => a.code === code)
                        );
                    }

                    if (chosenCodes.length === 0) {
                        return {
                            requirementId: req.id,
                            success: false,
                            error: aiSuggestion.reasoning || 'No compatible activities found for this preset',
                        };
                    }

                    // Calculate estimation (using pre-loaded data)
                    const selectedActivities = activities.filter((a: Activity) =>
                        chosenCodes.includes(a.code)
                    ) || [];

                    const aiCodesSet = new Set(aiActivityCodes);

                    const estimation = calculateEstimation({
                        activities: selectedActivities.map((a: Activity) => ({
                            code: a.code,
                            baseHours: a.base_hours,
                            isAiSuggested: aiCodesSet.has(a.code),
                        })),
                        drivers: [],
                        risks: [],
                    });

                    const activitiesPayload = selectedActivities.map((a: Activity) => ({
                        activity_id: a.id,
                        is_ai_suggested: aiCodesSet.has(a.code),
                        notes: '',
                    }));

                    const { error: saveError } = await supabase.rpc('save_estimation_atomic', {
                        p_requirement_id: req.id,
                        p_user_id: userId,
                        p_total_days: estimation.totalDays,
                        p_base_hours: estimation.baseDays * 8, // Convert back to hours for storage
                        p_driver_multiplier: estimation.driverMultiplier,
                        p_risk_score: estimation.riskScore,
                        p_contingency_percent: estimation.contingencyPercent,
                        p_scenario_name: 'AI Generated (Bulk)',
                        p_activities: activitiesPayload,
                        p_drivers: null,
                        p_risks: null,
                    });

                    if (saveError) {
                        throw saveError;
                    }

                    return { requirementId: req.id, success: true };
                } catch (error) {
                    console.error(`Error estimating ${req.req_id}:`, error);
                    return { requirementId: req.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
                }
            });

            // Wait for batch to complete
            const batchResults = await Promise.all(promises);

            // Update statuses
            batchResults.forEach((result) => {
                const index = results.findIndex((r) => r.requirement.id === result.requirementId);
                if (index !== -1) {
                    results[index].status = result.success ? 'success' : 'error';
                    results[index].error = result.error;
                }
            });

            completed += batch.length;
            setProgress((completed / estimableRequirements.length) * 100);
            setStatuses([...results]);
        }

        setStep('complete');
    };

    const handleCancel = () => {
        setCancelled(true);
        setStep('complete');
    };

    const handleClose = () => {
        onOpenChange(false);
        setStep('confirm');
        setStatuses([]);
        setProgress(0);
        setCancelled(false);

        if (step === 'complete') {
            onSuccess();
        }
    };

    const successCount = statuses.filter((s) => s.status === 'success').length;
    const errorCount = statuses.filter((s) => s.status === 'error').length;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        <Zap className="inline mr-2 h-5 w-5" />
                        Bulk Estimate Requirements
                    </DialogTitle>
                    <DialogDescription>
                        Automatically estimate multiple requirements using AI
                    </DialogDescription>
                </DialogHeader>

                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm">
                                <strong>{estimableRequirements.length} requirements</strong> will be estimated
                            </p>
                            {skippedCount > 0 && (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        {skippedCount} requirement(s) will be skipped (missing technology preset
                                        or description)
                                    </AlertDescription>
                                </Alert>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Estimated time: ~{estimatedTime} seconds
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Processing {MAX_CONCURRENT} requirements at a time
                            </p>
                        </div>

                        <div className="border rounded-lg p-4 bg-muted/50 max-h-60 overflow-y-auto">
                            <p className="text-sm font-medium mb-2">Requirements to estimate:</p>
                            <ul className="space-y-1 text-sm">
                                {estimableRequirements.slice(0, 10).map((req) => (
                                    <li key={req.id} className="flex items-start gap-2">
                                        <span className="text-muted-foreground">{req.req_id}:</span>
                                        <span className="flex-1">{req.title}</span>
                                    </li>
                                ))}
                                {estimableRequirements.length > 10 && (
                                    <li className="text-muted-foreground italic">
                                        ...and {estimableRequirements.length - 10} more
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Progress</span>
                                <span className="font-medium">
                                    {successCount + errorCount} / {estimableRequirements.length}
                                </span>
                            </div>
                            <Progress value={progress} />
                        </div>

                        <div className="border rounded-lg p-4 bg-muted/50 max-h-96 overflow-y-auto space-y-1">
                            {statuses.map((status) => (
                                <div
                                    key={status.requirement.id}
                                    className="flex items-center gap-2 text-sm py-1"
                                >
                                    {status.status === 'pending' && (
                                        <div className="h-4 w-4 rounded-full border-2 border-muted" />
                                    )}
                                    {status.status === 'processing' && (
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    )}
                                    {status.status === 'success' && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                    {status.status === 'error' && (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className="text-muted-foreground">{status.requirement.req_id}</span>
                                    <span className="flex-1">{status.requirement.title}</span>
                                    {status.error && (
                                        <span className="text-xs text-red-500">{status.error}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-center py-8">
                            {cancelled ? (
                                <div className="text-center space-y-2">
                                    <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500" />
                                    <p className="text-lg font-semibold">Estimation Cancelled</p>
                                    <p className="text-sm text-muted-foreground">
                                        {successCount} requirements were estimated before cancellation
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center space-y-2">
                                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                                    <p className="text-lg font-semibold">Estimation Complete</p>
                                    <div className="flex gap-4 justify-center text-sm">
                                        <span className="text-green-600">
                                            {successCount} successful
                                        </span>
                                        {errorCount > 0 && (
                                            <span className="text-red-600">{errorCount} failed</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {errorCount > 0 && (
                            <div className="border rounded-lg p-4 bg-muted/50 max-h-60 overflow-y-auto">
                                <p className="text-sm font-medium mb-2 text-red-600">Failed estimations:</p>
                                <ul className="space-y-1 text-sm">
                                    {statuses
                                        .filter((s) => s.status === 'error')
                                        .map((status) => (
                                            <li key={status.requirement.id} className="flex gap-2">
                                                <span className="text-muted-foreground">
                                                    {status.requirement.req_id}:
                                                </span>
                                                <span className="flex-1">{status.requirement.title}</span>
                                                <span className="text-xs text-red-500">{status.error}</span>
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {step === 'confirm' && (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleStartEstimation} disabled={estimableRequirements.length === 0}>
                                <Zap className="mr-2 h-4 w-4" />
                                Start Estimation
                            </Button>
                        </>
                    )}
                    {step === 'processing' && (
                        <Button variant="destructive" onClick={handleCancel}>
                            Cancel
                        </Button>
                    )}
                    {step === 'complete' && (
                        <Button onClick={handleClose}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
