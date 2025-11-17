import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { List, TechnologyPreset } from '@/types/database';

interface EditListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    list: List | null;
    onSuccess: () => void;
}

export function EditListDialog({ open, onOpenChange, list, onSuccess }: EditListDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [owner, setOwner] = useState('');
    const [techPresetId, setTechPresetId] = useState<string>('__NONE__');
    const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');
    const [loading, setLoading] = useState(false);
    const [presets, setPresets] = useState<TechnologyPreset[]>([]);

    useEffect(() => {
        if (open && list) {
            setName(list.name);
            setDescription(list.description || '');
            setOwner(list.owner || '');
            setTechPresetId(list.tech_preset_id || '__NONE__');
            setStatus(list.status);
            loadPresets();
        }
    }, [open, list]);

    const loadPresets = async () => {
        const { data, error } = await supabase
            .from('technology_presets')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error loading presets:', error);
        } else {
            setPresets(data || []);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!list) return;

        setLoading(true);

        const { error } = await supabase
            .from('lists')
            .update({
                name,
                description,
                owner,
                tech_preset_id: techPresetId === '__NONE__' ? null : techPresetId,
                status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', list.id);

        if (error) {
            console.error('Error updating list:', error);
            toast.error('Failed to update project');
        } else {
            toast.success('Project updated successfully');
            onOpenChange(false);
            onSuccess();
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>
                            Update project details and default technology.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Project Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Sprint Q4 - HR Module"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Brief description of this project..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="owner">Owner</Label>
                            <Input
                                id="owner"
                                placeholder="Project owner name"
                                value={owner}
                                onChange={(e) => setOwner(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="techPreset">Default Technology</Label>
                            <Select value={techPresetId} onValueChange={setTechPresetId}>
                                <SelectTrigger id="techPreset">
                                    <SelectValue placeholder="Select technology..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__NONE__">None (set per requirement)</SelectItem>
                                    {presets.map((preset) => (
                                        <SelectItem key={preset.id} value={preset.id}>
                                            {preset.name} ({preset.tech_category})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                All requirements without a specific technology will inherit this default
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={(value: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') => setStatus(value)}>
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !name}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
