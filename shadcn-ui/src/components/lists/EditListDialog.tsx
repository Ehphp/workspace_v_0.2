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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldBlock } from '@/components/shared/FormFieldBlock';
import { toast } from 'sonner';
import type { List, Technology } from '@/types/database';

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
    const [projectType, setProjectType] = useState<string>('__NONE__');
    const [domain, setDomain] = useState('');
    const [scope, setScope] = useState<string>('__NONE__');
    const [teamSize, setTeamSize] = useState<string>('');
    const [deadlinePressure, setDeadlinePressure] = useState<string>('__NONE__');
    const [methodology, setMethodology] = useState<string>('__NONE__');
    const [loading, setLoading] = useState(false);
    const [presets, setPresets] = useState<Technology[]>([]);

    useEffect(() => {
        if (open && list) {
            setName(list.name);
            setDescription(list.description || '');
            setOwner(list.owner || '');
            setTechPresetId(list.technology_id || list.tech_preset_id || '__NONE__');
            setStatus(list.status);
            setProjectType(list.project_type || '__NONE__');
            setDomain(list.domain || '');
            setScope(list.scope || '__NONE__');
            setTeamSize(list.team_size ? String(list.team_size) : '');
            setDeadlinePressure(list.deadline_pressure || '__NONE__');
            setMethodology(list.methodology || '__NONE__');
            loadPresets();
        }
    }, [open, list]);

    const loadPresets = async () => {
        const { data, error } = await supabase
            .from('technologies')
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
                technology_id: techPresetId === '__NONE__' ? null : techPresetId,
                status,
                project_type: projectType === '__NONE__' ? null : projectType,
                domain: domain || null,
                scope: scope === '__NONE__' ? null : scope,
                team_size: teamSize ? parseInt(teamSize, 10) : null,
                deadline_pressure: deadlinePressure === '__NONE__' ? null : deadlinePressure,
                methodology: methodology === '__NONE__' ? null : methodology,
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>
                            Update project details and default technology.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <FormFieldBlock label="Project Name" htmlFor="name" required>
                            <Input
                                id="name"
                                placeholder="e.g., Sprint Q4 - HR Module"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </FormFieldBlock>

                        <FormFieldBlock label="Description" htmlFor="description">
                            <Textarea
                                id="description"
                                placeholder="Brief description of this project..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </FormFieldBlock>

                        <FormFieldBlock label="Owner" htmlFor="owner">
                            <Input
                                id="owner"
                                placeholder="Project owner name"
                                value={owner}
                                onChange={(e) => setOwner(e.target.value)}
                            />
                        </FormFieldBlock>

                        <FormFieldBlock label="Default Technology" htmlFor="techPreset" help="All requirements without a specific technology will inherit this default">
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
                        </FormFieldBlock>

                        <FormFieldBlock label="Status" htmlFor="status">
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
                        </FormFieldBlock>

                        {/* Project Context Section */}
                        <div className="border-t border-slate-200 pt-4">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Project Context</p>

                            <div className="grid grid-cols-2 gap-3">
                                <FormFieldBlock label="Project Type" htmlFor="projectType">
                                    <Select value={projectType} onValueChange={setProjectType}>
                                        <SelectTrigger id="projectType">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__NONE__">Not specified</SelectItem>
                                            <SelectItem value="NEW_DEVELOPMENT">New Development</SelectItem>
                                            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                            <SelectItem value="MIGRATION">Migration</SelectItem>
                                            <SelectItem value="INTEGRATION">Integration</SelectItem>
                                            <SelectItem value="REFACTORING">Refactoring</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldBlock>

                                <FormFieldBlock label="Domain" htmlFor="domain">
                                    <Input
                                        id="domain"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        placeholder="e.g., HR, Finance"
                                    />
                                </FormFieldBlock>

                                <FormFieldBlock label="Scope" htmlFor="scope">
                                    <Select value={scope} onValueChange={setScope}>
                                        <SelectTrigger id="scope">
                                            <SelectValue placeholder="Select scope" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__NONE__">Not specified</SelectItem>
                                            <SelectItem value="SMALL">Small</SelectItem>
                                            <SelectItem value="MEDIUM">Medium</SelectItem>
                                            <SelectItem value="LARGE">Large</SelectItem>
                                            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldBlock>

                                <FormFieldBlock label="Team Size" htmlFor="teamSize">
                                    <Input
                                        id="teamSize"
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={teamSize}
                                        onChange={(e) => setTeamSize(e.target.value)}
                                        placeholder="e.g., 5"
                                    />
                                </FormFieldBlock>

                                <FormFieldBlock label="Deadline Pressure" htmlFor="deadlinePressure">
                                    <Select value={deadlinePressure} onValueChange={setDeadlinePressure}>
                                        <SelectTrigger id="deadlinePressure">
                                            <SelectValue placeholder="Select pressure" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__NONE__">Not specified</SelectItem>
                                            <SelectItem value="RELAXED">Relaxed</SelectItem>
                                            <SelectItem value="NORMAL">Normal</SelectItem>
                                            <SelectItem value="TIGHT">Tight</SelectItem>
                                            <SelectItem value="CRITICAL">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldBlock>

                                <FormFieldBlock label="Methodology" htmlFor="methodology">
                                    <Select value={methodology} onValueChange={setMethodology}>
                                        <SelectTrigger id="methodology">
                                            <SelectValue placeholder="Select methodology" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__NONE__">Not specified</SelectItem>
                                            <SelectItem value="AGILE">Agile</SelectItem>
                                            <SelectItem value="WATERFALL">Waterfall</SelectItem>
                                            <SelectItem value="HYBRID">Hybrid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldBlock>
                            </div>
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
