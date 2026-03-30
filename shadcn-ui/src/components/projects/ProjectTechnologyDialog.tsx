import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { patchProject, PROJECT_FK } from '@/lib/projects';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Project, Technology } from '@/types/database';

interface ProjectTechnologyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project | null;
    onSaved: () => void;
}

export function ProjectTechnologyDialog({ open, onOpenChange, project, onSaved }: ProjectTechnologyDialogProps) {
    const [presets, setPresets] = useState<Technology[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [applyToRequirements, setApplyToRequirements] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelectedPresetId(project?.technology_id || project?.tech_preset_id || '');
        loadPresets();
    }, [open, project]);

    const loadPresets = async () => {
        const { data, error } = await supabase
            .from('technologies')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error loading presets:', error);
            toast.error('Impossibile caricare le tecnologie');
            return;
        }
        setPresets(data || []);
    };

    const handleSave = async () => {
        if (!project || !selectedPresetId) {
            toast.error('Seleziona una tecnologia prima di continuare');
            return;
        }

        setLoading(true);
        try {
            await patchProject(project.id, { technology_id: selectedPresetId });

            let updatedRequirements = 0;

            if (applyToRequirements) {
                const { data, error: updateReqError } = await supabase
                    .from('requirements')
                    .update({
                        technology_id: selectedPresetId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq(PROJECT_FK, project.id)
                    .is('technology_id', null)
                    .select('id');

                if (updateReqError) {
                    throw updateReqError;
                }

                updatedRequirements = data?.length || 0;
            }

            toast.success('Tecnologia di progetto aggiornata', {
                description: applyToRequirements
                    ? `Applicata a ${updatedRequirements} requisiti senza tecnologia.`
                    : 'I nuovi requisiti erediteranno automaticamente questa tecnologia.',
            });

            onOpenChange(false);
            onSaved();
        } catch (error) {
            console.error('Error updating project technology:', error);
            toast.error('Aggiornamento tecnologia fallito');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Imposta tecnologia di progetto</DialogTitle>
                    <DialogDescription>
                        Scegli la tecnologia di default per questo progetto. I requisiti senza tecnologia la erediteranno automaticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tecnologia</Label>
                        <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona tecnologia..." />
                            </SelectTrigger>
                            <SelectContent>
                                {presets.map((preset) => (
                                    <SelectItem key={preset.id} value={preset.id}>
                                        {preset.name} ({preset.tech_category})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                        <div>
                            <p className="text-sm font-medium text-slate-900">Aggiorna requisiti esistenti</p>
                            <p className="text-xs text-slate-600">Imposta la tecnologia sui requisiti senza una scelta specifica.</p>
                        </div>
                        <Switch
                            checked={applyToRequirements}
                            onCheckedChange={setApplyToRequirements}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={loading || !selectedPresetId}>
                        {loading ? 'Salvataggio...' : 'Salva'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
