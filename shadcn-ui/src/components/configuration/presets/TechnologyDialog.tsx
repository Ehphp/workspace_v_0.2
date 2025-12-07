import { useEffect } from 'react';
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
import { ArrowUp, ArrowDown, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Activity, Driver, Risk } from '@/types/database';
import type { PresetForm } from '@/hooks/usePresetManagement';
import { useTechnologyValidation } from '@/hooks/useTechnologyValidation';

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

    // Async validation for name uniqueness (debounced)
    const { isValidating, validationError } = useTechnologyValidation(
        watchedName,
        editingId
    );

    // Reset form when opening/closing or initialData changes
    useEffect(() => {
        if (open) {
            reset(initialData);
        }
    }, [open, initialData, reset]);

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
        const activity = allActivities.find(a => a.id === activityId);
        if (activity && !watchedActivities.find((a: Activity) => a.id === activityId)) {
            setValue('activities', [...watchedActivities, activity], { shouldDirty: true });
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
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="contents">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900">{isEditing ? 'Modifica Tecnologia' : 'Crea Nuova Tecnologia'}</DialogTitle>
                        <DialogDescription className="text-slate-500">Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-700">Nome</Label>
                                <Input
                                    {...register('name')}
                                    placeholder="Es. Sviluppo Backend Standard"
                                    className={`bg-white border-slate-200 focus:bg-white ${errors.name || validationError ? 'border-red-500' : ''}`}
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                                {!errors.name && validationError && <p className="text-xs text-red-500">{validationError}</p>}
                                {!errors.name && !validationError && isValidating && <p className="text-xs text-slate-400">Verifica disponibilità...</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700">Categoria</Label>
                                <Controller
                                    control={control}
                                    name="techCategory"
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={`bg-white border-slate-200 ${errors.techCategory ? 'border-red-500' : ''}`}>
                                                <SelectValue placeholder="Seleziona..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {techCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.techCategory && <p className="text-xs text-red-500">{errors.techCategory.message}</p>}
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label className="text-slate-700">Descrizione</Label>
                                <Textarea
                                    {...register('description')}
                                    placeholder="Descrizione della tecnologia..."
                                    rows={2}
                                    className="bg-white border-slate-200 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Activities Configuration */}
                        <div className="space-y-3 border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold text-slate-900">Attività Default</Label>
                                <Select onValueChange={addActivity}>
                                    <SelectTrigger className="w-[250px] bg-white border-slate-200">
                                        <SelectValue placeholder="Aggiungi attività..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <ScrollArea className="h-[200px]">
                                            {allActivities.map(a => (
                                                <SelectItem key={a.id} value={a.id} disabled={!!watchedActivities.find((fa: Activity) => fa.id === a.id)}>
                                                    {a.name} ({a.base_hours}h)
                                                </SelectItem>
                                            ))}
                                        </ScrollArea>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 min-h-[100px] space-y-2">
                                {watchedActivities.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 py-8">Nessuna attività selezionata</div>
                                ) : (
                                    watchedActivities.map((act: Activity, idx: number) => (
                                        <div key={act.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0 bg-slate-50 border-slate-200 text-slate-600">{idx + 1}</Badge>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{act.name}</div>
                                                    <div className="text-[10px] text-slate-500">{act.code} • {act.base_hours} ore</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'down')} disabled={idx === watchedActivities.length - 1}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeActivity(idx)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Drivers & Risks */}
                        <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-4">
                            <div className="space-y-3">
                                <Label className="text-base font-semibold text-slate-900">Driver Default</Label>
                                <div className="space-y-2">
                                    {allDrivers.map(d => (
                                        <div key={d.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                                            <span className="font-medium text-slate-700">{d.name}</span>
                                            <Select
                                                value={watchedDrivers[d.code] || '_REMOVE_'}
                                                onValueChange={(v) => updateDriverValue(d.code, v)}
                                            >
                                                <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-slate-200">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="_REMOVE_">-- Nessuno --</SelectItem>
                                                    {d.options.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-semibold text-slate-900">Rischi Default</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {allRisks.map(r => {
                                        const isSelected = watchedRisks.includes(r.code);
                                        return (
                                            <div
                                                key={r.id}
                                                className={`cursor-pointer border rounded-lg p-2 text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                                onClick={() => toggleRisk(r.code)}
                                            >
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                                                    {isSelected && <CheckCircle2 className="h-2 w-2 text-white" />}
                                                </div>
                                                <span className={isSelected ? 'font-medium text-orange-900' : 'text-slate-600'}>{r.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 text-slate-700">Annulla</Button>
                        <Button type="submit" disabled={saving || !isDirty || isValidating || !!validationError} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                            {saving ? 'Salvataggio...' : 'Salva Tecnologia'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
