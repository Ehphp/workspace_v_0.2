import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldBlock } from '@/components/shared/FormFieldBlock';
import { createProjectActivities } from '@/lib/project-activity-repository';
import type { ProjectActivity, ActivityGroup, InterventionType } from '@/types/project-activity';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateCode(name: string, existingCodes: string[]): string {
    const slug = `PRJ_${name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30)}`;
    let candidate = slug;
    let counter = 2;
    while (existingCodes.includes(candidate)) {
        candidate = `${slug}_${counter++}`;
    }
    return candidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface AddActivityDialogProps {
    projectId: string;
    existingActivities: ProjectActivity[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const DEFAULT_FORM = {
    name: '',
    group: 'DEV' as ActivityGroup,
    interventionType: 'NEW' as InterventionType,
    baseHours: '4',
    effortModifier: '1.0',
};

export function AddActivityDialog({
    projectId,
    existingActivities,
    open,
    onOpenChange,
    onSuccess,
}: AddActivityDialogProps) {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(false);

    const reset = () => setForm(DEFAULT_FORM);

    const handleOpenChange = (value: boolean) => {
        if (!value) reset();
        onOpenChange(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        setLoading(true);
        try {
            const code = generateCode(
                form.name.trim(),
                existingActivities.map(a => a.code),
            );
            await createProjectActivities(projectId, [
                {
                    code,
                    name: form.name.trim(),
                    group: form.group,
                    interventionType: form.interventionType,
                    baseHours: Number(form.baseHours),
                    effortModifier: Number(form.effortModifier),
                    isEnabled: true,
                    position: existingActivities.length,
                },
            ]);
            toast.success('Attività aggiunta');
            reset();
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('Errore nell\'aggiunta dell\'attività');
        } finally {
            setLoading(false);
        }
    };

    const set = (field: keyof typeof DEFAULT_FORM) =>
        (value: string) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Aggiungi Attività</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <FormFieldBlock label="Nome" htmlFor="add-act-name" required>
                            <Input
                                id="add-act-name"
                                placeholder="es. Analisi requisiti funzionali"
                                value={form.name}
                                onChange={(e) => set('name')(e.target.value)}
                                required
                                autoFocus
                            />
                        </FormFieldBlock>

                        <div className="grid grid-cols-2 gap-3">
                            <FormFieldBlock label="Gruppo" htmlFor="add-act-group">
                                <Select value={form.group} onValueChange={set('group')}>
                                    <SelectTrigger id="add-act-group">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ANALYSIS">Analysis</SelectItem>
                                        <SelectItem value="DEV">Dev</SelectItem>
                                        <SelectItem value="TEST">Test</SelectItem>
                                        <SelectItem value="OPS">Ops</SelectItem>
                                        <SelectItem value="GOVERNANCE">Governance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldBlock>

                            <FormFieldBlock label="Tipo Intervento" htmlFor="add-act-intervention">
                                <Select value={form.interventionType} onValueChange={set('interventionType')}>
                                    <SelectTrigger id="add-act-intervention">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NEW">New</SelectItem>
                                        <SelectItem value="MODIFY">Modify</SelectItem>
                                        <SelectItem value="CONFIGURE">Configure</SelectItem>
                                        <SelectItem value="MIGRATE">Migrate</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldBlock>

                            <FormFieldBlock label="Ore Base" htmlFor="add-act-hours">
                                <Input
                                    id="add-act-hours"
                                    type="number"
                                    min={0.125}
                                    max={40}
                                    step={0.125}
                                    value={form.baseHours}
                                    onChange={(e) => set('baseHours')(e.target.value)}
                                />
                            </FormFieldBlock>

                            <FormFieldBlock label="Modificatore" htmlFor="add-act-modifier">
                                <Input
                                    id="add-act-modifier"
                                    type="number"
                                    min={0.1}
                                    max={3.0}
                                    step={0.1}
                                    value={form.effortModifier}
                                    onChange={(e) => set('effortModifier')(e.target.value)}
                                />
                            </FormFieldBlock>
                        </div>

                        <p className="text-xs text-slate-400">
                            Il codice attività verrà generato automaticamente dal nome (prefisso <code>PRJ_</code>).
                        </p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Annulla
                        </Button>
                        <Button type="submit" disabled={loading || !form.name.trim()}>
                            {loading ? 'Aggiunta...' : 'Aggiungi'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
