import { useState, useEffect } from 'react';
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
import { Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateActivityCode } from '@/lib/codeGeneration';
import { toast } from 'sonner';
import type { Activity, ActivityWithOverride } from '@/types/database';

const groupOptions = [
    { value: 'ANALYSIS', label: 'Analysis' },
    { value: 'DEV', label: 'Development' },
    { value: 'TEST', label: 'Testing' },
    { value: 'OPS', label: 'Operations' },
    { value: 'GOVERNANCE', label: 'Governance' },
];

interface ActivityForm {
    name: string;
    description: string;
    baseHours: string;
    techCategory: string;
    group: string;
}

const initialForm: ActivityForm = {
    name: '',
    description: '',
    baseHours: '8',
    techCategory: 'MULTI',
    group: 'DEV',
};

export type ActivityDialogMode = 'create' | 'edit' | 'duplicate' | 'override';

/** Override values returned when editing activity overrides */
export interface ActivityOverrideValues {
    name_override: string | null;
    description_override: string | null;
    base_hours_override: number | null;
}

interface ActivityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    techCategory?: string;
    existingActivityCodes: string[];
    userId: string;
    onActivityCreated: (activity: Activity) => void;
    onActivityUpdated?: (activity: Activity) => void;
    // Edit/Duplicate mode
    editActivity?: Activity | null;
    mode?: ActivityDialogMode;
    // Override mode
    overrideActivity?: ActivityWithOverride | null;
    onOverrideUpdated?: (overrides: ActivityOverrideValues) => void;
}

export function ActivityDialog({
    open,
    onOpenChange,
    techCategory = 'MULTI',
    existingActivityCodes,
    userId,
    onActivityCreated,
    onActivityUpdated,
    editActivity = null,
    mode = 'create',
    overrideActivity = null,
    onOverrideUpdated,
}: ActivityDialogProps) {
    const [form, setForm] = useState<ActivityForm>({
        ...initialForm,
        techCategory,
    });
    const [saving, setSaving] = useState(false);
    const [showDescription, setShowDescription] = useState(false);

    const isEditMode = mode === 'edit' && editActivity;
    const isDuplicateMode = mode === 'duplicate' && editActivity;
    const isOverrideMode = mode === 'override' && overrideActivity;

    // Populate form when editing, duplicating, or overriding
    useEffect(() => {
        if (open && isOverrideMode && overrideActivity) {
            // Override mode: use current display values (which may already include overrides)
            setForm({
                name: overrideActivity.name,
                description: overrideActivity.description || '',
                baseHours: overrideActivity.base_hours.toString(),
                techCategory: overrideActivity.tech_category,
                group: overrideActivity.group,
            });
            setShowDescription(!!overrideActivity.description);
        } else if (open && editActivity) {
            setForm({
                name: isDuplicateMode ? `${editActivity.name} (Copia)` : editActivity.name,
                description: editActivity.description || '',
                baseHours: editActivity.base_hours.toString(),
                techCategory: editActivity.tech_category,
                group: editActivity.group,
            });
            setShowDescription(!!editActivity.description);
        } else if (open && !editActivity && !overrideActivity) {
            setForm({ ...initialForm, techCategory });
            setShowDescription(false);
        }
    }, [open, editActivity, isDuplicateMode, techCategory, isOverrideMode, overrideActivity]);

    const handleClose = (isOpen: boolean) => {
        if (!isOpen) {
            setForm({ ...initialForm, techCategory });
            setShowDescription(false);
        }
        onOpenChange(isOpen);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const baseHours = Number(form.baseHours);

        if (!form.name.trim()) {
            toast.error('Nome obbligatorio');
            return;
        }

        if (!Number.isFinite(baseHours) || baseHours <= 0) {
            toast.error('Ore non valide', {
                description: 'Inserisci un numero di ore maggiore di zero',
            });
            return;
        }

        // Override mode: no DB save, just return the override values
        if (isOverrideMode && overrideActivity) {
            // Compare with original values to determine what's overridden
            const overrides: ActivityOverrideValues = {
                name_override: form.name !== overrideActivity.original_name ? form.name : null,
                description_override: form.description !== (overrideActivity.original_description || '')
                    ? form.description
                    : null,
                base_hours_override: baseHours !== overrideActivity.original_base_hours ? baseHours : null,
            };

            onOverrideUpdated?.(overrides);
            toast.success('Personalizzazione applicata', {
                description: `Le modifiche saranno salvate con la tecnologia`,
            });
            handleClose(false);
            return;
        }

        setSaving(true);
        try {
            if (isEditMode && editActivity) {
                // UPDATE existing activity
                const { data, error } = await supabase
                    .from('activities')
                    .update({
                        name: form.name,
                        description: form.description,
                        base_hours: baseHours,
                        tech_category: form.techCategory,
                        group: form.group,
                    })
                    .eq('id', editActivity.id)
                    .select()
                    .single();

                if (error) throw error;

                toast.success('Attività aggiornata', {
                    description: `${form.name} - ${baseHours} ore`,
                });

                onActivityUpdated?.(data as Activity);
            } else {
                // CREATE new activity (or duplicate)
                const generatedCode = generateActivityCode(
                    form.name,
                    form.techCategory,
                    existingActivityCodes
                );

                const { data, error } = await supabase
                    .from('activities')
                    .insert({
                        code: generatedCode,
                        name: form.name,
                        description: form.description,
                        base_hours: baseHours,
                        tech_category: form.techCategory,
                        group: form.group,
                        active: true,
                        is_custom: true,
                        created_by: userId,
                        base_activity_id: isDuplicateMode ? editActivity?.id : null,
                    })
                    .select()
                    .single();

                if (error) throw error;

                toast.success(isDuplicateMode ? 'Attività duplicata' : 'Attività creata', {
                    description: `${form.name} - ${baseHours} ore`,
                });

                onActivityCreated(data as Activity);
            }
            handleClose(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Riprovare tra qualche secondo';
            toast.error('Errore durante il salvataggio', {
                description: message,
            });
        } finally {
            setSaving(false);
        }
    };

    // Dialog titles and descriptions based on mode
    const dialogConfig = {
        create: {
            title: 'Crea Nuova Attività',
            description: "L'attività verrà aggiunta al catalogo e potrà essere usata in qualsiasi tecnologia.",
        },
        edit: {
            title: 'Modifica Attività',
            description: 'Le modifiche saranno applicate a tutte le tecnologie che usano questa attività.',
        },
        duplicate: {
            title: 'Duplica Attività',
            description: 'Verrà creata una copia personalizzata che potrai modificare liberamente.',
        },
        override: {
            title: 'Personalizza Attività',
            description: 'Le modifiche si applicano solo a questa tecnologia. L\'attività originale non sarà modificata.',
        },
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[480px] bg-white">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-slate-900">{dialogConfig[mode].title}</DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {dialogConfig[mode].description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Info for override mode - show original values */}
                        {isOverrideMode && overrideActivity && (
                            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-800">
                                    <p className="font-medium mb-1">Valori originali:</p>
                                    <p><strong>Nome:</strong> {overrideActivity.original_name}</p>
                                    <p><strong>Ore:</strong> {overrideActivity.original_base_hours}h</p>
                                </div>
                            </div>
                        )}

                        {/* Nome */}
                        <div className="space-y-2">
                            <Label htmlFor="activity-name" className="text-slate-700">
                                Nome attività <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="activity-name"
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Es. Configurazione CI/CD Pipeline"
                                className="bg-white border-slate-200"
                                autoFocus
                            />
                        </div>

                        {/* Descrizione (opzionale, toggle) */}
                        {showDescription ? (
                            <div className="space-y-2">
                                <Label htmlFor="activity-desc" className="text-slate-700">
                                    Descrizione
                                </Label>
                                <Textarea
                                    id="activity-desc"
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Descrivi cosa include questa attività..."
                                    className="bg-white border-slate-200 resize-none"
                                    rows={2}
                                />
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-fit text-slate-500 hover:text-slate-700 -mt-2"
                                onClick={() => setShowDescription(true)}
                            >
                                + Aggiungi descrizione
                            </Button>
                        )}

                        {/* Riga: Tecnologia + Fase */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-slate-700">Tecnologia</Label>
                                <Select
                                    value={form.techCategory}
                                    onValueChange={(value) => setForm(prev => ({ ...prev, techCategory: value }))}
                                >
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MULTI">Multi-stack</SelectItem>
                                        <SelectItem value="BACKEND">Backend</SelectItem>
                                        <SelectItem value="FRONTEND">Frontend</SelectItem>
                                        <SelectItem value="MOBILE">Mobile</SelectItem>
                                        <SelectItem value="DATA">Data</SelectItem>
                                        <SelectItem value="INFRA">Infrastructure</SelectItem>
                                        <SelectItem value="POWER_PLATFORM">Power Platform</SelectItem>
                                        <SelectItem value="USU">USU</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-700">Fase</Label>
                                <Select
                                    value={form.group}
                                    onValueChange={(value) => setForm(prev => ({ ...prev, group: value }))}
                                >
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Ore base */}
                        <div className="space-y-2">
                            <Label htmlFor="activity-hours" className="text-slate-700">
                                Ore stimate base <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="activity-hours"
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={form.baseHours}
                                onChange={(e) => setForm(prev => ({ ...prev, baseHours: e.target.value }))}
                                className="bg-white border-slate-200 font-mono"
                            />
                            <p className="text-xs text-slate-400">
                                Tempo medio per completare l'attività in condizioni standard.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleClose(false)}
                            className="border-slate-200"
                        >
                            Annulla
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving || !form.name.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvataggio...
                                </>
                            ) : isOverrideMode ? (
                                'Applica Personalizzazione'
                            ) : isEditMode ? (
                                'Salva Modifiche'
                            ) : isDuplicateMode ? (
                                'Crea Copia'
                            ) : (
                                'Crea Attività'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
