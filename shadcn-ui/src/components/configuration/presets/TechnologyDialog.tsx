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
import { ArrowUp, ArrowDown, X, CheckCircle2, Layers } from 'lucide-react';
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
            <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="contents">
                    <DialogHeader className="p-6 pb-2 border-b border-slate-50">
                        <DialogTitle className="text-slate-900">{isEditing ? 'Modifica Tecnologia' : 'Crea Nuova Tecnologia'}</DialogTitle>
                        <DialogDescription className="text-slate-500">Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                        <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 p-6 overflow-hidden">
                            {/* Column 1: Basic Info (3 cols) */}
                            <div className="col-span-3 flex flex-col gap-6 border-r border-slate-100 pr-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">1</span>
                                        Dettagli Generali
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-700">Nome Tecnologia</Label>
                                            <Input
                                                {...register('name')}
                                                placeholder="Es. Sviluppo Backend"
                                                className={`bg-white border-slate-200 ${errors.name || validationError ? 'border-red-500' : ''}`}
                                            />
                                            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                                            {!errors.name && validationError && <p className="text-xs text-red-500">{validationError}</p>}
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

                                        <div className="space-y-2 flex-1">
                                            <Label className="text-slate-700">Descrizione</Label>
                                            <Textarea
                                                {...register('description')}
                                                placeholder="Descrizione opzionale..."
                                                className="bg-white border-slate-200 resize-none h-[120px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Activities (5 cols) */}
                            <div className="col-span-5 flex flex-col gap-4 border-r border-slate-100 pr-6 h-full min-h-0">
                                <div className="flex items-center justify-between shrink-0">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs">2</span>
                                        Workflow Attività
                                    </h3>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                        {watchedActivities.length} attività
                                    </Badge>
                                </div>

                                <div className="shrink-0 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aggiungi Attività</Label>
                                    <Select onValueChange={addActivity}>
                                        <SelectTrigger className="w-full bg-white border-slate-200">
                                            <SelectValue placeholder="Cerca attività da aggiungere..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <ScrollArea className="h-[250px]">
                                                {allActivities.map(a => (
                                                    <SelectItem key={a.id} value={a.id} disabled={!!watchedActivities.find((fa: Activity) => fa.id === a.id)}>
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span>{a.name}</span>
                                                            <span className="text-xs text-slate-400 font-mono">{a.base_hours}h</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </ScrollArea>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 min-h-0">
                                    {watchedActivities.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-8">
                                            <Layers className="w-8 h-8 opacity-20 mb-2" />
                                            <p className="text-sm">Nessuna attività configurata</p>
                                            <p className="text-xs opacity-70">Aggiungi attività dal menu sopra</p>
                                        </div>
                                    ) : (
                                        watchedActivities.map((act: Activity, idx: number) => (
                                            <div key={act.id} className="group flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-200 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-medium group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-900 leading-tight">{act.name}</div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                            <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{act.code}</span>
                                                            <span>{act.base_hours} ore stimate</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex flex-col gap-0.5 mr-1">
                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-blue-600" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-blue-600" onClick={() => moveActivity(idx, 'down')} disabled={idx === watchedActivities.length - 1}>
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={() => removeActivity(idx)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Column 3: Config (4 cols) */}
                            <div className="col-span-4 flex flex-col h-full min-h-0 gap-6">

                                {/* Driver Section (Top Half) */}
                                <div className="flex-1 min-h-0 flex flex-col gap-3">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 shrink-0">
                                        <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xs">3</span>
                                        Driver Default
                                    </h3>
                                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 border rounded-lg border-slate-100 bg-slate-50/50 p-3">
                                        {allDrivers.map(d => (
                                            <div key={d.id} className="bg-white p-2.5 rounded border border-slate-200 shadow-sm space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">{d.name}</span>
                                                    {watchedDrivers[d.code] && (
                                                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                                                    )}
                                                </div>
                                                <Select
                                                    value={watchedDrivers[d.code] || '_REMOVE_'}
                                                    onValueChange={(v) => updateDriverValue(d.code, v)}
                                                >
                                                    <SelectTrigger className="w-full h-8 text-xs bg-slate-50 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_REMOVE_" className="text-slate-400 font-normal">-- Nessuna preferenza --</SelectItem>
                                                        {d.options.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Risk Section (Bottom Half) */}
                                <div className="flex-1 min-h-0 flex flex-col gap-3">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 shrink-0">
                                        <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs">4</span>
                                        Rischi Default
                                    </h3>
                                    <ScrollArea className="flex-1 border rounded-lg border-slate-100 bg-slate-50/50 p-2">
                                        <div className="grid grid-cols-1 gap-2">
                                            {allRisks.map(r => {
                                                const isSelected = watchedRisks.includes(r.code);
                                                return (
                                                    <div
                                                        key={r.id}
                                                        className={`cursor-pointer border rounded-lg p-2.5 text-xs flex items-start gap-2.5 transition-all ${isSelected ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                                        onClick={() => toggleRisk(r.code)}
                                                    >
                                                        <div className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 bg-white'}`}>
                                                            {isSelected && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                                        </div>
                                                        <div>
                                                            <span className={`font-medium block mb-0.5 ${isSelected ? 'text-red-900' : 'text-slate-700'}`}>{r.name}</span>
                                                            <span className="text-[10px] text-slate-500 leading-tight block">Cod: {r.code}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t border-slate-100 bg-white/50">
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
