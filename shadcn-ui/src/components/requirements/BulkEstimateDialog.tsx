import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, Driver, Risk, DriverOption } from '@/types/database';
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

        // PRE-LOAD all data once (huge performance boost for bulk)
        console.log('🚀 Pre-loading catalogs for bulk processing...');
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
        const presetsRes = await supabase
            .from('technology_presets')
            .select('*')
            .in('id', uniquePresetIds as string[]);
        const presetsMap = new Map((presetsRes.data || []).map(p => [p.id, p]));
        console.log('✅ Pre-loaded data ready');

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

                    // Reuse pre-loaded data (no DB calls!)
                    const activities = sharedActivities;
                    const drivers = sharedDrivers;
                    const risks = sharedRisks;

                    // Call AI suggestion API
                    console.log('🔍 Calling AI API for:', req.req_id);
                    console.log('  - Description length:', req.description?.length);
                    console.log('  - Preset:', preset.name);
                    console.log('  - Activities:', activities?.length);
                    console.log('  - Drivers:', drivers?.length);
                    console.log('  - Risks:', risks?.length);

                    const response = await fetch('/.netlify/functions/ai-suggest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'suggest-activities',
                            description: req.description,
                            preset: {
                                name: preset.name,
                                description: preset.description,
                                tech_category: preset.tech_category,
                                default_activity_codes: preset.default_activity_codes || [],
                                default_driver_values: preset.default_driver_values || {},
                                default_risks: preset.default_risks || [],
                            },
                            activities,
                            drivers,
                            risks,
                        }),
                    });

                    console.log('📡 Response status:', response.status);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('❌ AI API Error:', errorText);
                        throw new Error(`AI suggestion failed: ${response.status} - ${errorText.substring(0, 200)}`);
                    }

                    const aiSuggestion = await response.json();

                    // Check if the requirement is valid
                    if (!aiSuggestion.isValidRequirement) {
                        console.warn(`Invalid requirement for ${req.req_id}: ${aiSuggestion.reasoning || 'requirement not valid'}`);
                        return {
                            requirementId: req.id,
                            success: false,
                            error: aiSuggestion.reasoning || 'Invalid or unclear requirement description'
                        };
                    }

                    // Check if GPT suggested any activities
                    if (!aiSuggestion.activityCodes || aiSuggestion.activityCodes.length === 0) {
                        console.warn(`No activities suggested for ${req.req_id}: ${aiSuggestion.reasoning || 'description unclear'}`);
                        return {
                            requirementId: req.id,
                            success: false,
                            error: aiSuggestion.reasoning || 'Description too short or unclear'
                        };
                    }

                    // Calculate estimation (using pre-loaded data)
                    const selectedActivities = activities.filter((a: Activity) =>
                        aiSuggestion.activityCodes.includes(a.code)
                    ) || [];

                    // NO drivers and risks - GPT suggests only activities
                    const selectedDrivers: any[] = [];
                    const selectedRisks: any[] = [];

                    const baseDays = selectedActivities.reduce(
                        (sum: number, a: Activity) => sum + a.base_days,
                        0
                    );
                    const driverMultiplier = 1.0; // No driver multiplier
                    const subtotal = baseDays * driverMultiplier;
                    const riskScore = 0; // No risk score

                    const contingencyPercent = 0.10; // Base contingency only

                    const contingencyDays = subtotal * contingencyPercent;
                    const totalDays = subtotal + contingencyDays;

                    // Save estimation to database
                    await supabase.from('estimations').insert({
                        requirement_id: req.id,
                        user_id: (await supabase.auth.getUser()).data.user?.id,
                        total_days: totalDays,
                        base_days: baseDays,
                        driver_multiplier: driverMultiplier,
                        risk_score: riskScore,
                        contingency_percent: contingencyPercent * 100,
                        scenario_name: 'AI Generated',
                        selected_activities: aiSuggestion.activityCodes,
                        selected_drivers: {}, // No drivers
                        selected_risks: [], // No risks
                        ai_reasoning: aiSuggestion.reasoning,
                    });

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
                                            ✓ {successCount} successful
                                        </span>
                                        {errorCount > 0 && (
                                            <span className="text-red-600">✗ {errorCount} failed</span>
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
