import { useState } from 'react';
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
import type { Activity, Driver, Risk } from '@/types/database';
import type { PresetForm } from '@/hooks/usePresetManagement';

interface PresetFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: PresetForm;
    onFormChange: (form: PresetForm) => void;
    isEditing: boolean;
    saving: boolean;
    onSave: () => void;
    allActivities: Activity[];
    allDrivers: Driver[];
    allRisks: Risk[];
    techCategories: string[];
}

export function PresetFormDialog({
    open,
    onOpenChange,
    form,
    onFormChange,
    isEditing,
    saving,
    onSave,
    allActivities,
    allDrivers,
    allRisks,
    techCategories,
}: PresetFormDialogProps) {
    const addActivity = (activityId: string) => {
        const activity = allActivities.find(a => a.id === activityId);
        if (activity && !form.activities.find(a => a.id === activityId)) {
            onFormChange({ ...form, activities: [...form.activities, activity] });
        }
    };

    const removeActivity = (index: number) => {
        onFormChange({
            ...form,
            activities: form.activities.filter((_, i) => i !== index)
        });
    };

    const moveActivity = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === form.activities.length - 1) return;

        const newActivities = [...form.activities];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newActivities[index], newActivities[targetIndex]] = [newActivities[targetIndex], newActivities[index]];

        onFormChange({ ...form, activities: newActivities });
    };

    const toggleRisk = (riskCode: string) => {
        const exists = form.riskCodes.includes(riskCode);
        onFormChange({
            ...form,
            riskCodes: exists
                ? form.riskCodes.filter(c => c !== riskCode)
                : [...form.riskCodes, riskCode]
        });
    };

    const updateDriverValue = (driverCode: string, value: string) => {
        const newValues = { ...form.driverValues };
        if (value === '_REMOVE_') {
            delete newValues[driverCode];
        } else {
            newValues[driverCode] = value;
        }
        onFormChange({ ...form, driverValues: newValues });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-slate-900">{isEditing ? 'Modifica Preset' : 'Crea Nuovo Preset'}</DialogTitle>
                    <DialogDescription className="text-slate-500">Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-slate-700">Nome</Label>
                            <Input
                                value={form.name}
                                onChange={e => onFormChange({ ...form, name: e.target.value })}
                                placeholder="Es. Sviluppo Backend Standard"
                                className="bg-white border-slate-200 focus:bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700">Tecnologia</Label>
                            <Select value={form.techCategory} onValueChange={v => onFormChange({ ...form, techCategory: v })}>
                                <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {techCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label className="text-slate-700">Descrizione</Label>
                            <Textarea
                                value={form.description}
                                onChange={e => onFormChange({ ...form, description: e.target.value })}
                                placeholder="Descrizione del preset..."
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
                                            <SelectItem key={a.id} value={a.id} disabled={!!form.activities.find(fa => fa.id === a.id)}>
                                                {a.name} ({a.base_hours}h)
                                            </SelectItem>
                                        ))}
                                    </ScrollArea>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 min-h-[100px] space-y-2">
                            {form.activities.length === 0 ? (
                                <div className="text-center text-sm text-slate-400 py-8">Nessuna attività selezionata</div>
                            ) : (
                                form.activities.map((act, idx) => (
                                    <div key={act.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0 bg-slate-50 border-slate-200 text-slate-600">{idx + 1}</Badge>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{act.name}</div>
                                                <div className="text-[10px] text-slate-500">{act.code} • {act.base_hours} ore</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'down')} disabled={idx === form.activities.length - 1}>
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeActivity(idx)}>
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
                                            value={form.driverValues[d.code] || '_REMOVE_'}
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
                                    const isSelected = form.riskCodes.includes(r.code);
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 text-slate-700">Annulla</Button>
                    <Button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                        {saving ? 'Salvataggio...' : 'Salva Preset'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
