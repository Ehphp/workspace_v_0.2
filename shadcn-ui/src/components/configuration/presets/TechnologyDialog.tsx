import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, ArrowDown, X, CheckCircle2, Layers, PlusCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Activity, Driver, Risk, ActivityWithOverride } from '@/types/database';
import type { PresetForm, ActivityFormData } from '@/hooks/usePresetManagement';
import { useTechnologyValidation } from '@/hooks/useTechnologyValidation';
import { useAuth } from '@/hooks/useAuth';
import { ActivityDialog, ActivityOverrideValues } from './ActivityDialog';
import { AiAssistPanel } from './AiAssistPanel';
import type { GeneratedPreset, SuggestedActivity } from '@/types/ai-preset-generation';

// Validation Schema
const technologySchema = z.object({
    name: z.string().min(3, "Il nome deve avere almeno 3 caratteri"),
    description: z.string().optional(),
    techCategory: z.string().min(1, "Seleziona una categoria"),
    activities: z.array(z.any()).default([]), // Complex objects, validation logic handled manually for now
    driverValues: z.record(z.string()),
    riskCodes: z.array(z.string())
});

type TechnologyFormValues = z.infer<typeof technologySchema>;

interface TechnologyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData: PresetForm;
    isEditing: boolean;
    editingId: string | null;
    saving: boolean;
    onSave: (data: PresetForm) => Promise<void>;
    allActivities: Activity[];
    allDrivers: Driver[];
    allRisks: Risk[];
    techCategories: string[];
}

export function TechnologyDialog({
    open,
    onOpenChange,
    initialData,
    isEditing,
    editingId,
    saving,
    onSave,
    allActivities,
    allDrivers,
    allRisks,
    techCategories,
}: TechnologyDialogProps) {

    // React Hook Form
    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isDirty }
    } = useForm<TechnologyFormValues>({
        resolver: zodResolver(technologySchema),
        defaultValues: initialData,
        mode: 'onChange'
    });

    const watchedActivities = watch('activities');
    const watchedRisks = watch('riskCodes');
    const watchedDrivers = watch('driverValues');
    const watchedName = watch('name');
    const watchedDescription = watch('description');
    const watchedTechCategory = watch('techCategory');

    // Async validation for name uniqueness (debounced)
    const { isValidating, validationError } = useTechnologyValidation(
        watchedName,
        editingId
    );

    // Auth for creating activities
    const { user } = useAuth();

    // State for inline activity creation/edit
    const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
    const [editingActivityIndex, setEditingActivityIndex] = useState<number | null>(null);
    const [localActivities, setLocalActivities] = useState<Activity[]>(allActivities);

    // Sync local activities when allActivities changes
    useEffect(() => {
        setLocalActivities(allActivities);
    }, [allActivities]);

    // Reset form when opening/closing or initialData changes
    useEffect(() => {
        if (open) {
            reset(initialData);
        }
    }, [open, initialData, reset]);

    // Open activity dialog for creating new
    const openCreateActivityDialog = () => {
        setEditingActivityIndex(null);
        setIsActivityDialogOpen(true);
    };

    // Open activity dialog for editing (local override)
    const openEditActivityDialog = (index: number) => {
        setEditingActivityIndex(index);
        setIsActivityDialogOpen(true);
    };

    // Handler for newly created activity from catalog
    const handleActivityCreated = (newActivity: Activity) => {
        // Add to local catalog list
        setLocalActivities(prev => [newActivity, ...prev]);
        // Add to workflow with no overrides (use base values)
        const activityFormData: ActivityFormData = {
            ...newActivity,
            name_override: null,
            description_override: null,
            base_hours_override: null,
            has_override: false,
            original_name: newActivity.name,
            original_description: newActivity.description,
            original_base_hours: newActivity.base_hours,
        };
        setValue('activities', [...watchedActivities, activityFormData], { shouldDirty: true });
        toast.success('Attività aggiunta', {
            description: `${newActivity.name} è stata aggiunta al workflow.`
        });
    };

    // Handler for activity override update (local to this technology only)
    const handleActivityOverrideUpdated = (overrides: ActivityOverrideValues) => {
        if (editingActivityIndex === null) return;

        const currentActivity = watchedActivities[editingActivityIndex] as ActivityFormData;

        // Preserve original values
        const originalName = currentActivity.original_name || currentActivity.name;
        const originalDesc = currentActivity.original_description || currentActivity.description;
        const originalHours = currentActivity.original_base_hours || currentActivity.base_hours;

        // Compute display values (override or original)
        const displayName = overrides.name_override ?? originalName;
        const displayDesc = overrides.description_override ?? originalDesc;
        const displayHours = overrides.base_hours_override ?? originalHours;

        const updatedActivity: ActivityFormData = {
            ...currentActivity,
            // Set display values
            name: displayName,
            description: displayDesc,
            base_hours: displayHours,
            // Set override values from callback
            name_override: overrides.name_override,
            description_override: overrides.description_override,
            base_hours_override: overrides.base_hours_override,
            has_override: !!(overrides.name_override || overrides.description_override || overrides.base_hours_override),
            // Preserve original values
            original_name: originalName,
            original_description: originalDesc,
            original_base_hours: originalHours,
        };

        // Update in workflow
        setValue('activities', watchedActivities.map((a: ActivityFormData, idx: number) =>
            idx === editingActivityIndex ? updatedActivity : a
        ), { shouldDirty: true });

        // Close the dialog
        setEditingActivityIndex(null);
    };

    // Handler for AI-generated preset - populates form with AI suggestions
    const handleAiPresetGenerated = (preset: GeneratedPreset, resolvedActivities: Activity[]) => {
        // Populate basic fields
        setValue('name', preset.name, { shouldDirty: true });
        setValue('description', preset.description, { shouldDirty: true });
        setValue('techCategory', preset.techCategory, { shouldDirty: true });

        // Convert resolved activities to ActivityFormData format
        const activityFormDataList: ActivityFormData[] = resolvedActivities.map(activity => {
            // Find the original suggested activity to check if it's new
            const suggested = preset.activities.find(
                s => s.existingCode === activity.code || s.title === activity.name
            );
            const isNew = suggested?.isNew || (activity as any)._isNew;

            return {
                id: activity.id,
                code: activity.code,
                name: activity.name,
                description: activity.description,
                base_hours: activity.base_hours,
                tech_category: activity.tech_category,
                group: activity.group,
                active: activity.active,
                is_custom: isNew || activity.is_custom,
                // No overrides for AI-generated - use base values
                name_override: null,
                description_override: null,
                base_hours_override: null,
                has_override: false,
                original_name: activity.name,
                original_description: activity.description,
                original_base_hours: activity.base_hours,
                // Mark new activities for creation in DB
                _isNew: isNew,
            } as ActivityFormData;
        });

        setValue('activities', activityFormDataList, { shouldDirty: true });

        // Set driver values from AI
        if (preset.driverValues) {
            const driverValues: Record<string, string> = {};
            for (const [code, value] of Object.entries(preset.driverValues)) {
                // Convert number to string if needed (AI might return numbers)
                driverValues[code] = String(value);
            }
            setValue('driverValues', driverValues, { shouldDirty: true });
        }

        // Set risk codes from AI
        if (preset.riskCodes && preset.riskCodes.length > 0) {
            setValue('riskCodes', preset.riskCodes, { shouldDirty: true });
        }

        // Add new activities to local catalog for display
        const newActivities = resolvedActivities.filter(a => (a as any)._isNew);
        if (newActivities.length > 0) {
            setLocalActivities(prev => [...newActivities, ...prev]);
        }

        toast.success('Preset AI applicato', {
            description: `${resolvedActivities.length} attività configurate`
        });
    };

    const onSubmit = async (data: TechnologyFormValues) => {
        // Block if async validation is in progress or failed
        if (isValidating || validationError) {
            return;
        }

        try {
            await onSave(data as PresetForm);
            // Dialog closing is handled by parent on success
        } catch (error) {
            console.error("Form submission error", error);
            toast.error("Errore durante il salvataggio");
        }
    };

    const addActivity = (activityId: string) => {
        const activity = localActivities.find(a => a.id === activityId);
        if (activity && !watchedActivities.find((a: Activity) => a.id === activityId)) {
            // Add with proper ActivityFormData format including original values
            const activityFormData: ActivityFormData = {
                ...activity,
                name_override: null,
                description_override: null,
                base_hours_override: null,
                has_override: false,
                original_name: activity.name,
                original_description: activity.description,
                original_base_hours: activity.base_hours,
            };
            setValue('activities', [...watchedActivities, activityFormData], { shouldDirty: true });
        }
    };

    const removeActivity = (index: number) => {
        setValue('activities', watchedActivities.filter((_: any, i: number) => i !== index), { shouldDirty: true });
    };

    const moveActivity = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === watchedActivities.length - 1) return;

        const newActivities = [...watchedActivities];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newActivities[index], newActivities[targetIndex]] = [newActivities[targetIndex], newActivities[index]];

        setValue('activities', newActivities, { shouldDirty: true });
    };

    const toggleRisk = (riskCode: string) => {
        const currentExits = watchedRisks.includes(riskCode);
        const newRisks = currentExits
            ? watchedRisks.filter((c: string) => c !== riskCode)
            : [...watchedRisks, riskCode];
        setValue('riskCodes', newRisks, { shouldDirty: true });
    };

    const updateDriverValue = (driverCode: string, value: string) => {
        const current = { ...watchedDrivers };
        if (value === '_REMOVE_') {
            delete current[driverCode];
        } else {
            current[driverCode] = value;
        }
        setValue('driverValues', current, { shouldDirty: true });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <DialogHeader className="px-5 py-3 border-b border-slate-100 shrink-0">
                        <DialogTitle className="text-slate-900 text-base">{isEditing ? 'Modifica Tecnologia' : 'Crea Nuova Tecnologia'}</DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs">Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                    </DialogHeader>

                    {/* Main content - NO scroll here, each column handles its own */}
                    <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 p-4">
                        {/* Column 1: Basic Info (3 cols) - compact, no internal scroll needed */}
                        <div className="col-span-3 flex flex-col gap-3 border-r border-slate-100 pr-4 overflow-hidden">
                            {/* Dettagli Generali - Ultra compact card */}
                            <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 space-y-2.5 shrink-0">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">1</span>
                                    Dettagli Generali
                                </h3>

                                {/* Nome e Categoria inline */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                        <Label className="text-[10px] font-medium text-slate-500">Nome</Label>
                                        <Input
                                            {...register('name')}
                                            placeholder="Es. Backend API"
                                            className={`h-7 text-xs bg-white/80 border-slate-200 ${errors.name || validationError ? 'border-red-400' : ''}`}
                                        />
                                        {errors.name && <p className="text-[9px] text-red-500">{errors.name.message}</p>}
                                        {!errors.name && validationError && <p className="text-[9px] text-red-500">{validationError}</p>}
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-[10px] font-medium text-slate-500">Categoria</Label>
                                        <Controller
                                            control={control}
                                            name="techCategory"
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className={`h-7 text-xs bg-white/80 border-slate-200 ${errors.techCategory ? 'border-red-400' : ''}`}>
                                                        <SelectValue placeholder="Seleziona..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {techCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Descrizione compatta */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-medium text-slate-500">Descrizione</Label>
                                        {!isEditing && watchedDescription && watchedDescription.length > 0 && (
                                            <span className={`text-[9px] font-medium ${watchedDescription.length >= 20 ? 'text-green-600' : 'text-amber-500'}`}>
                                                {watchedDescription.length >= 20 ? '✓ AI' : `${watchedDescription.length}/20`}
                                            </span>
                                        )}
                                    </div>
                                    <Textarea
                                        {...register('description')}
                                        placeholder={!isEditing ? "Descrivi per AI (min. 20 char)..." : "Descrizione..."}
                                        className={`text-xs bg-white/80 border-slate-200 resize-none h-[56px] ${!isEditing && watchedDescription && watchedDescription.length >= 20 ? 'border-purple-300' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* AI Assist Panel - only for new presets */}
                            {!isEditing && (
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    <AiAssistPanel
                                        onPresetGenerated={handleAiPresetGenerated}
                                        existingActivities={localActivities}
                                        disabled={saving}
                                        description={watchedDescription || ''}
                                        techCategory={watchedTechCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Column 2: Activities (5 cols) - scrollable */}
                        <div className="col-span-5 flex flex-col gap-2 border-r border-slate-100 pr-4 h-full min-h-0">
                            <div className="flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">2</span>
                                    Workflow Attività
                                </h3>
                                <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] font-medium px-1.5 py-0">
                                    {watchedActivities.length}
                                </Badge>
                            </div>

                            <div className="shrink-0 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/30 p-2">
                                <div className="flex gap-2">
                                    <Select onValueChange={addActivity}>
                                        <SelectTrigger className="flex-1 h-7 text-xs bg-white/80 border-slate-200">
                                            <SelectValue placeholder="Aggiungi attività..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <ScrollArea className="h-[200px]">
                                                {localActivities.map(a => (
                                                    <SelectItem key={a.id} value={a.id} disabled={!!watchedActivities.find((fa: Activity) => fa.id === a.id)}>
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span className="text-xs">{a.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">{a.base_hours}h</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </ScrollArea>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0 h-7 w-7 border-purple-300 text-purple-600 hover:bg-purple-100"
                                        onClick={openCreateActivityDialog}
                                        title="Nuova"
                                    >
                                        <PlusCircle className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 min-h-0">
                                <div className="space-y-1 pr-2">
                                    {watchedActivities.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-4">
                                            <Layers className="w-6 h-6 opacity-20 mb-1" />
                                            <p className="text-xs">Nessuna attività</p>
                                        </div>
                                    ) : (
                                        watchedActivities.map((act: ActivityFormData, idx: number) => (
                                            <div key={act.id || idx} className="group flex items-center justify-between bg-white/80 p-2 rounded-lg border border-slate-200 hover:border-purple-200 transition-all">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-[9px] font-semibold group-hover:bg-purple-100 group-hover:text-purple-600 shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-medium text-slate-800 leading-tight flex items-center gap-1 truncate">
                                                            <span className="truncate">{act.name}</span>
                                                            {act.has_override && (
                                                                <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-700 shrink-0">C</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                            <span className="font-mono">{act.code}</span>
                                                            <span>•</span>
                                                            <span>{act.base_hours}h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-purple-600" onClick={() => openEditActivityDialog(idx)}>
                                                        <Pencil className="h-2.5 w-2.5" />
                                                    </Button>
                                                    <div className="flex flex-col -space-y-1">
                                                        <Button type="button" variant="ghost" size="icon" className="h-3.5 w-3.5 text-slate-400 hover:text-purple-600" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                            <ArrowUp className="h-2 w-2" />
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" className="h-3.5 w-3.5 text-slate-400 hover:text-purple-600" onClick={() => moveActivity(idx, 'down')} disabled={idx === watchedActivities.length - 1}>
                                                            <ArrowDown className="h-2 w-2" />
                                                        </Button>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-red-500" onClick={() => removeActivity(idx)}>
                                                        <X className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Column 3: Config (4 cols) - Driver and Risks side by side */}
                        <div className="col-span-4 flex flex-col h-full min-h-0 gap-2">
                            {/* Driver & Risks in 2 rows */}
                            <div className="flex-1 min-h-0 flex flex-col gap-1.5">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs shrink-0">
                                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">3</span>
                                    Driver Default
                                </h3>
                                <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                                    <div className="space-y-1">
                                        {allDrivers.map(d => (
                                            <div key={d.id} className="bg-white/80 p-1.5 rounded border border-slate-200 flex items-center gap-2">
                                                <span className="text-[10px] font-medium text-slate-600 w-20 truncate shrink-0">{d.name}</span>
                                                <Select
                                                    value={watchedDrivers[d.code] || '_REMOVE_'}
                                                    onValueChange={(v) => updateDriverValue(d.code, v)}
                                                >
                                                    <SelectTrigger className="flex-1 h-6 text-[10px] bg-slate-50/80 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_REMOVE_" className="text-slate-400 text-[10px]">--</SelectItem>
                                                        {d.options.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value} className="text-[10px]">{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {watchedDrivers[d.code] && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Risk Section */}
                            <div className="flex-1 min-h-0 flex flex-col gap-1.5">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs shrink-0">
                                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">4</span>
                                    Rischi Default
                                </h3>
                                <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                                    <div className="grid grid-cols-2 gap-1">
                                        {allRisks.map(r => {
                                            const isSelected = watchedRisks.includes(r.code);
                                            return (
                                                <div
                                                    key={r.id}
                                                    className={`cursor-pointer rounded p-1.5 text-[10px] flex items-center gap-1.5 transition-all ${isSelected ? 'bg-red-50 border border-red-200' : 'bg-white/80 border border-slate-200 hover:border-red-200'}`}
                                                    onClick={() => toggleRisk(r.code)}
                                                >
                                                    <div className={`w-3 h-3 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 bg-white'}`}>
                                                        {isSelected && <CheckCircle2 className="h-2 w-2 text-white" />}
                                                    </div>
                                                    <span className={`font-medium truncate ${isSelected ? 'text-red-800' : 'text-slate-600'}`}>{r.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-4 py-2.5 border-t border-slate-100 bg-white/50 shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 border-slate-200 text-slate-700 text-xs">Annulla</Button>
                        <Button type="submit" size="sm" disabled={saving || !isDirty || isValidating || !!validationError} className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                            {saving ? 'Salvataggio...' : 'Salva Tecnologia'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {/* Inline Activity Creation/Edit Dialog */}
            {user && (
                <ActivityDialog
                    open={isActivityDialogOpen}
                    onOpenChange={(open) => {
                        setIsActivityDialogOpen(open);
                        if (!open) {
                            setEditingActivityIndex(null);
                        }
                    }}
                    techCategory={watch('techCategory') || 'MULTI'}
                    existingActivityCodes={localActivities.map(a => a.code)}
                    userId={user.id}
                    onActivityCreated={handleActivityCreated}
                    mode={editingActivityIndex !== null ? 'override' : 'create'}
                    overrideActivity={editingActivityIndex !== null
                        ? (watchedActivities[editingActivityIndex] as ActivityWithOverride)
                        : null
                    }
                    onOverrideUpdated={handleActivityOverrideUpdated}
                />
            )}
        </Dialog>
    );
}
