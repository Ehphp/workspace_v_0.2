/**
 * Bulk Interview Dialog
 * 
 * Multi-step dialog for estimating multiple requirements with AI interview.
 * Steps:
 * 1. Preview - Show requirements to be analyzed
 * 2. Interview - Answer aggregated questions
 * 3. Review - See estimation results
 * 4. Save - Confirm and save to database
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateEstimation } from '@/lib/estimationEngine';
import { useBulkInterview } from '@/hooks/useBulkInterview';
import type { Activity } from '@/types/database';
import type { BulkRequirementInput, BulkRequirementEstimation } from '@/types/bulk-interview';

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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Loader2,
    Zap,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    MessageSquareCode,
    ArrowLeft,
    ArrowRight,
    Sparkles,
    FileQuestion,
    ListChecks,
    ChevronRight,
    Globe,
    Target,
    Users,
} from 'lucide-react';

interface Requirement {
    id: string;
    req_id: string;
    title: string;
    description: string;
    tech_preset_id: string | null;
}

interface BulkInterviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requirements: Requirement[];
    listId: string;
    listTechPresetId: string | null;
    techCategory: string;
    onSuccess: () => void;
}

type DialogStep = 'preview' | 'analyzing' | 'interview' | 'generating' | 'review' | 'saving' | 'complete';

export function BulkInterviewDialog({
    open,
    onOpenChange,
    requirements,
    listId,
    listTechPresetId,
    techCategory,
    onSuccess,
}: BulkInterviewDialogProps) {
    const [step, setStep] = useState<DialogStep>('preview');
    const [savingProgress, setSavingProgress] = useState(0);
    const [saveResults, setSaveResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
    const [selectedEstimations, setSelectedEstimations] = useState<Set<string>>(new Set());

    const interview = useBulkInterview();

    // Convert requirements to bulk format
    const bulkRequirements: BulkRequirementInput[] = useMemo(() =>
        requirements
            .filter(req => req.description && req.description.trim() !== '')
            .map(req => ({
                id: req.id,
                reqId: req.req_id,
                title: req.title,
                description: req.description,
                techPresetId: req.tech_preset_id || listTechPresetId,
            })),
        [requirements, listTechPresetId]
    );

    const skippedCount = requirements.length - bulkRequirements.length;

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setStep('preview');
            setSavingProgress(0);
            setSaveResults({ success: 0, failed: 0 });
            setSelectedEstimations(new Set());
            interview.reset();
        }
    }, [open]);

    // Sync step with interview phase
    useEffect(() => {
        if (interview.phase === 'analyzing') setStep('analyzing');
        if (interview.phase === 'interviewing') setStep('interview');
        if (interview.phase === 'generating') setStep('generating');
        if (interview.phase === 'reviewing') {
            setStep('review');
            // Select all successful estimations by default
            const successIds = interview.estimations
                .filter(e => e.success)
                .map(e => e.requirementId);
            setSelectedEstimations(new Set(successIds));
        }
        if (interview.phase === 'error') {
            // Stay on current step but show error
        }
    }, [interview.phase, interview.estimations]);

    // Start analysis
    const handleStartAnalysis = async () => {
        const techPresetId = bulkRequirements[0]?.techPresetId || listTechPresetId || undefined;
        await interview.analyzeRequirements(
            bulkRequirements,
            techCategory,
            techPresetId
        );
    };

    // Handle question answer
    const handleAnswer = (value: string | string[] | number) => {
        if (interview.currentQuestion) {
            interview.answerQuestion(interview.currentQuestion.id, value);
        }
    };

    // Handle interview completion
    const handleInterviewComplete = async () => {
        await interview.generateEstimates(techCategory);
    };

    // Toggle estimation selection
    const toggleEstimationSelection = (id: string) => {
        setSelectedEstimations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Save estimations to database
    const handleSaveEstimations = async () => {
        setStep('saving');
        setSavingProgress(0);

        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        if (!userId) {
            interview.reset();
            setStep('preview');
            return;
        }

        // Fetch activities once
        const { data: activitiesData } = await supabase
            .from('activities')
            .select('*')
            .eq('active', true);

        const activitiesMap = new Map((activitiesData || []).map((a: Activity) => [a.code, a]));

        const selectedEstimationsList = interview.estimations.filter(
            e => selectedEstimations.has(e.requirementId)
        );

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < selectedEstimationsList.length; i++) {
            const estimation = selectedEstimationsList[i];

            try {
                // Get activity IDs from codes
                const activitiesPayload = estimation.activities
                    .map(a => {
                        const activity = activitiesMap.get(a.code);
                        if (!activity) return null;
                        return {
                            activity_id: activity.id,
                            is_ai_suggested: true,
                            notes: a.reason || '',
                        };
                    })
                    .filter(Boolean);

                // Calculate total
                const estimationCalc = calculateEstimation({
                    activities: estimation.activities.map(a => ({
                        code: a.code,
                        baseHours: a.baseHours,
                        isAiSuggested: true,
                    })),
                    drivers: [],
                    risks: [],
                });

                // Save to database
                const { error: saveError } = await supabase.rpc('save_estimation_atomic', {
                    p_requirement_id: estimation.requirementId,
                    p_user_id: userId,
                    p_total_days: estimationCalc.totalDays,
                    p_base_hours: estimationCalc.baseDays * 8,
                    p_driver_multiplier: 1.0,
                    p_risk_score: 0,
                    p_contingency_percent: 10,
                    p_scenario_name: 'AI Generated (Bulk Interview)',
                    p_activities: activitiesPayload,
                    p_drivers: null,
                    p_risks: null,
                    p_ai_reasoning: estimation.reasoning || null,
                });

                if (saveError) throw saveError;
                successCount++;
            } catch (error) {
                console.error(`Error saving estimation for ${estimation.reqCode}:`, error);
                failedCount++;
            }

            setSavingProgress(((i + 1) / selectedEstimationsList.length) * 100);
        }

        setSaveResults({ success: successCount, failed: failedCount });
        setStep('complete');
    };

    // Close dialog
    const handleClose = () => {
        onOpenChange(false);
        if (step === 'complete') {
            onSuccess();
        }
    };

    // Render scope badge
    const renderScopeBadge = (scope: 'global' | 'multi-requirement' | 'specific', affectedCount: number) => {
        switch (scope) {
            case 'global':
                return (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Globe className="w-3 h-3 mr-1" />
                        Tutti i requisiti
                    </Badge>
                );
            case 'multi-requirement':
                return (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <Users className="w-3 h-3 mr-1" />
                        {affectedCount} requisiti
                    </Badge>
                );
            case 'specific':
                return (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Target className="w-3 h-3 mr-1" />
                        1 requisito
                    </Badge>
                );
        }
    };

    // Render current question
    const renderQuestion = () => {
        const question = interview.currentQuestion;
        if (!question) return null;

        const currentAnswer = interview.answers.get(question.id);

        return (
            <div className="space-y-6">
                {/* Question header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {renderScopeBadge(question.scope, question.affectedRequirementIds.length || bulkRequirements.length)}
                        <Badge variant="secondary">{question.category}</Badge>
                        {question.required && <Badge variant="destructive">Obbligatoria</Badge>}
                    </div>
                    <h3 className="text-lg font-semibold">{question.question}</h3>
                    <p className="text-sm text-muted-foreground">{question.technicalContext}</p>
                </div>

                {/* Answer input based on type */}
                {question.type === 'single-choice' && question.options && (
                    <RadioGroup
                        value={currentAnswer?.value as string || ''}
                        onValueChange={(value) => handleAnswer(value)}
                        className="space-y-3"
                    >
                        {question.options.map(option => (
                            <div key={option.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value={option.id} id={option.id} />
                                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                                    <span className="font-medium">{option.label}</span>
                                    {option.description && (
                                        <span className="block text-sm text-muted-foreground mt-1">
                                            {option.description}
                                        </span>
                                    )}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                )}

                {question.type === 'multiple-choice' && question.options && (
                    <div className="space-y-3">
                        {question.options.map(option => {
                            const selectedValues = (currentAnswer?.value as string[]) || [];
                            const isChecked = selectedValues.includes(option.id);

                            return (
                                <div key={option.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <Checkbox
                                        id={option.id}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                            const newValues = checked
                                                ? [...selectedValues, option.id]
                                                : selectedValues.filter(v => v !== option.id);
                                            handleAnswer(newValues);
                                        }}
                                    />
                                    <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                                        <span className="font-medium">{option.label}</span>
                                        {option.description && (
                                            <span className="block text-sm text-muted-foreground mt-1">
                                                {option.description}
                                            </span>
                                        )}
                                    </Label>
                                </div>
                            );
                        })}
                    </div>
                )}

                {question.type === 'range' && (
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{question.min || 0} {question.unit}</span>
                            <span className="font-medium text-foreground">
                                {(currentAnswer?.value as number) || question.min || 0} {question.unit}
                            </span>
                            <span>{question.max || 10} {question.unit}</span>
                        </div>
                        <Slider
                            value={[(currentAnswer?.value as number) || question.min || 0]}
                            min={question.min || 0}
                            max={question.max || 10}
                            step={question.step || 1}
                            onValueChange={([value]) => handleAnswer(value)}
                        />
                    </div>
                )}

                {/* Impact info */}
                <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        <strong>Impatto sulla stima:</strong> {question.impactOnEstimate}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquareCode className="h-5 w-5" />
                        Bulk Estimate with Interview
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'preview' && 'Analizza i requisiti e rispondi a domande aggregate per stime più accurate'}
                        {step === 'analyzing' && 'Analisi dei requisiti in corso...'}
                        {step === 'interview' && `Domanda ${interview.currentQuestionIndex + 1} di ${interview.questions.length}`}
                        {step === 'generating' && 'Generazione stime in corso...'}
                        {step === 'review' && 'Rivedi le stime prima di salvare'}
                        {step === 'saving' && 'Salvataggio in corso...'}
                        {step === 'complete' && 'Processo completato'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full max-h-[55vh]">
                        {/* STEP: Preview */}
                        {step === 'preview' && (
                            <div className="space-y-4 p-1">
                                <div className="space-y-2">
                                    <p className="text-sm">
                                        <strong>{bulkRequirements.length} requisiti</strong> saranno analizzati
                                    </p>
                                    {skippedCount > 0 && (
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertDescription>
                                                {skippedCount} requisiti saranno saltati (descrizione mancante)
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                                    <p className="text-sm font-medium">Requisiti da analizzare:</p>
                                    <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                                        {bulkRequirements.slice(0, 15).map((req) => (
                                            <div key={req.id} className="flex items-start gap-2 py-1">
                                                <span className="text-muted-foreground font-mono text-xs">{req.reqId}</span>
                                                <span className="flex-1 truncate">{req.title}</span>
                                            </div>
                                        ))}
                                        {bulkRequirements.length > 15 && (
                                            <p className="text-muted-foreground italic pt-2">
                                                ...e altri {bulkRequirements.length - 15} requisiti
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Alert className="bg-blue-50 border-blue-200">
                                    <FileQuestion className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        <strong>Come funziona:</strong> L'AI analizzerà tutti i requisiti insieme
                                        e genererà 6-10 domande aggregate. Alcune domande riguarderanno tutti
                                        i requisiti, altre solo alcuni specifici.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}

                        {/* STEP: Analyzing */}
                        {step === 'analyzing' && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold">Analisi in corso...</h3>
                                    <p className="text-muted-foreground mt-1">
                                        L'AI sta leggendo {bulkRequirements.length} requisiti
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* STEP: Interview */}
                        {step === 'interview' && (
                            <div className="space-y-4 p-1">
                                {/* Progress */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            {interview.answeredCount} di {interview.questions.length} risposte
                                        </span>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                <Globe className="w-3 h-3 mr-1" />
                                                {interview.summary.globalQuestions} globali
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Users className="w-3 h-3 mr-1" />
                                                {interview.summary.multiReqQuestions} multi
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Target className="w-3 h-3 mr-1" />
                                                {interview.summary.specificQuestions} specifiche
                                            </Badge>
                                        </div>
                                    </div>
                                    <Progress value={interview.progress} className="h-2" />
                                </div>

                                {/* Question */}
                                {renderQuestion()}

                                {/* AI Reasoning (collapsed) */}
                                {interview.reasoning && (
                                    <details className="group">
                                        <summary className="flex items-center gap-2 text-sm text-indigo-600 cursor-pointer hover:text-indigo-700">
                                            <Sparkles className="w-4 h-4" />
                                            <span>Perché queste domande?</span>
                                        </summary>
                                        <p className="mt-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                                            {interview.reasoning}
                                        </p>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* STEP: Generating */}
                        {step === 'generating' && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Sparkles className="h-12 w-12 animate-pulse text-indigo-600" />
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold">Generazione stime...</h3>
                                    <p className="text-muted-foreground mt-1">
                                        Elaborazione risposte per {bulkRequirements.length} requisiti
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* STEP: Review */}
                        {step === 'review' && (
                            <div className="space-y-4 p-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm">
                                        <strong>{selectedEstimations.size}</strong> stime selezionate per il salvataggio
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const allIds = interview.estimations.filter(e => e.success).map(e => e.requirementId);
                                            setSelectedEstimations(
                                                selectedEstimations.size === allIds.length
                                                    ? new Set()
                                                    : new Set(allIds)
                                            );
                                        }}
                                    >
                                        {selectedEstimations.size === interview.estimations.filter(e => e.success).length
                                            ? 'Deseleziona tutti'
                                            : 'Seleziona tutti'}
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {interview.estimations.map((estimation) => (
                                        <div
                                            key={estimation.requirementId}
                                            className={`p-3 border rounded-lg ${estimation.success
                                                    ? 'hover:bg-muted/50 cursor-pointer'
                                                    : 'bg-red-50 border-red-200'
                                                }`}
                                            onClick={() => estimation.success && toggleEstimationSelection(estimation.requirementId)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {estimation.success ? (
                                                    <Checkbox
                                                        checked={selectedEstimations.has(estimation.requirementId)}
                                                        onCheckedChange={() => toggleEstimationSelection(estimation.requirementId)}
                                                    />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{estimation.reqCode}</span>
                                                        {estimation.success && (
                                                            <>
                                                                <Badge variant="secondary">
                                                                    {estimation.totalBaseDays.toFixed(1)} giorni
                                                                </Badge>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        estimation.confidenceScore >= 0.8
                                                                            ? 'bg-green-50 text-green-700'
                                                                            : estimation.confidenceScore >= 0.7
                                                                                ? 'bg-yellow-50 text-yellow-700'
                                                                                : 'bg-orange-50 text-orange-700'
                                                                    }
                                                                >
                                                                    {Math.round(estimation.confidenceScore * 100)}% confidence
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                    {estimation.success ? (
                                                        <p className="text-sm text-muted-foreground truncate mt-1">
                                                            {estimation.activities.length} attività: {estimation.activities.map(a => a.code).join(', ')}
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm text-red-600 mt-1">
                                                            {estimation.error || 'Errore durante la stima'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Summary */}
                                <div className="p-4 bg-indigo-50 rounded-lg space-y-2">
                                    <h4 className="font-semibold text-indigo-900">Riepilogo</h4>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-indigo-600">Requisiti stimati</span>
                                            <p className="font-bold text-indigo-900">
                                                {interview.estimations.filter(e => e.success).length}/{interview.estimations.length}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-indigo-600">Totale giorni</span>
                                            <p className="font-bold text-indigo-900">
                                                {interview.estimations
                                                    .filter(e => selectedEstimations.has(e.requirementId))
                                                    .reduce((sum, e) => sum + e.totalBaseDays, 0)
                                                    .toFixed(1)}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-indigo-600">Confidence media</span>
                                            <p className="font-bold text-indigo-900">
                                                {Math.round(
                                                    (interview.estimations
                                                        .filter(e => e.success)
                                                        .reduce((sum, e) => sum + e.confidenceScore, 0) /
                                                        interview.estimations.filter(e => e.success).length) * 100
                                                )}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP: Saving */}
                        {step === 'saving' && (
                            <div className="space-y-4 py-8">
                                <div className="flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                                    <div className="text-center">
                                        <h3 className="text-lg font-semibold">Salvataggio in corso...</h3>
                                        <p className="text-muted-foreground mt-1">
                                            {Math.round(savingProgress)}% completato
                                        </p>
                                    </div>
                                </div>
                                <Progress value={savingProgress} />
                            </div>
                        )}

                        {/* STEP: Complete */}
                        {step === 'complete' && (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <CheckCircle2 className="h-16 w-16 text-green-500" />
                                <div className="text-center space-y-2">
                                    <h3 className="text-lg font-semibold">Processo Completato</h3>
                                    <div className="flex gap-4 justify-center text-sm">
                                        <span className="text-green-600">
                                            <CheckCircle2 className="inline h-4 w-4 mr-1" />
                                            {saveResults.success} salvate
                                        </span>
                                        {saveResults.failed > 0 && (
                                            <span className="text-red-600">
                                                <XCircle className="inline h-4 w-4 mr-1" />
                                                {saveResults.failed} fallite
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error display */}
                        {interview.error && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{interview.error}</AlertDescription>
                            </Alert>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="flex-shrink-0">
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Annulla
                            </Button>
                            <Button onClick={handleStartAnalysis} disabled={bulkRequirements.length === 0}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Avvia Analisi
                            </Button>
                        </>
                    )}

                    {step === 'interview' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={interview.previousQuestion}
                                disabled={interview.isFirstQuestion}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Precedente
                            </Button>
                            {interview.isLastQuestion ? (
                                <Button
                                    onClick={handleInterviewComplete}
                                    disabled={!interview.requiredAnswered}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Genera Stime
                                </Button>
                            ) : (
                                <Button
                                    onClick={interview.nextQuestion}
                                    disabled={!interview.canProceed}
                                >
                                    Successiva
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </>
                    )}

                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('interview')}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Torna alle domande
                            </Button>
                            <Button
                                onClick={handleSaveEstimations}
                                disabled={selectedEstimations.size === 0}
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Salva {selectedEstimations.size} stime
                            </Button>
                        </>
                    )}

                    {step === 'complete' && (
                        <Button onClick={handleClose}>Chiudi</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
