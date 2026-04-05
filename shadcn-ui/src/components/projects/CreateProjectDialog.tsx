import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
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
import type { Technology } from '@/types/database';
import { createProject, fetchPresets } from '@/lib/api';
import { projectSchema } from '@/lib/validation';
import { Layers, Sparkles, User, FileText, Cpu, Activity, Target, Globe, Gauge, Users, Clock, GitBranch, PenLine } from 'lucide-react';
import { CreateProjectFromSources } from './CreateProjectFromSources';

type CreationMode = 'select' | 'manual' | 'from-documentation';

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
    const { user, currentOrganization } = useAuthStore();
    const [creationMode, setCreationMode] = useState<CreationMode>('select');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [owner, setOwner] = useState('');
    const [techPresetId, setTechPresetId] = useState<string>('__NONE__');
    const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('DRAFT');
    const [projectType, setProjectType] = useState<string>('__NONE__');
    const [domain, setDomain] = useState('');
    const [scope, setScope] = useState<string>('__NONE__');
    const [teamSize, setTeamSize] = useState<string>('');
    const [deadlinePressure, setDeadlinePressure] = useState<string>('__NONE__');
    const [methodology, setMethodology] = useState<string>('__NONE__');
    const [loading, setLoading] = useState(false);
    const [presets, setPresets] = useState<Technology[]>([]);

    useEffect(() => {
        if (open) {
            loadPresets();
            setCreationMode('select');
        }
    }, [open]);

    const loadPresets = async () => {
        try {
            const data = await fetchPresets();
            setPresets(data);
        } catch (error) {
            console.error('Error loading presets:', error);
            toast.error('Failed to load technologies');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !currentOrganization) return;

        setLoading(true);

        const parsed = projectSchema.safeParse({
            name,
            description,
            owner: owner || user.email || '',
            techPresetId: techPresetId === '__NONE__' ? null : techPresetId,
            status,
            projectType: projectType === '__NONE__' ? null : projectType,
            domain: domain || null,
            scope: scope === '__NONE__' ? null : scope,
            teamSize: teamSize ? parseInt(teamSize, 10) : null,
            deadlinePressure: deadlinePressure === '__NONE__' ? null : deadlinePressure,
            methodology: methodology === '__NONE__' ? null : methodology,
        });

        if (!parsed.success) {
            const firstError = parsed.error.errors[0]?.message || 'Invalid data';
            toast.error('Invalid project data', { description: firstError });
            setLoading(false);
            return;
        }

        try {
            await createProject({
                userId: user.id,
                organizationId: currentOrganization.id,
                ...parsed.data,
            });

            toast.success('Project created successfully');
            setName('');
            setDescription('');
            setOwner('');
            setTechPresetId('__NONE__');
            setStatus('DRAFT');
            setProjectType('__NONE__');
            setDomain('');
            setScope('__NONE__');
            setTeamSize('');
            setDeadlinePressure('__NONE__');
            setMethodology('__NONE__');
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Error creating project:', error);
            toast.error('Failed to create project');
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${creationMode === 'from-documentation' ? 'sm:max-w-[800px]' : 'sm:max-w-[600px]'} max-h-[90vh] overflow-y-auto`}>
                {/* Mode Selection */}
                {creationMode === 'select' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                                    <Layers className="w-5 h-5 text-white" />
                                </div>
                                <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                                    Create New Project
                                </span>
                            </DialogTitle>
                            <DialogDescription className="pt-1">
                                Choose how you want to create your project.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-6">
                            <button
                                type="button"
                                onClick={() => setCreationMode('manual')}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group"
                            >
                                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md group-hover:shadow-lg transition-shadow">
                                    <PenLine className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-slate-800">Manual</p>
                                    <p className="text-xs text-slate-500 mt-1">Fill in project details manually</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreationMode('from-documentation')}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer group"
                            >
                                <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md group-hover:shadow-lg transition-shadow">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-slate-800">From Sources</p>
                                    <p className="text-xs text-slate-500 mt-1">AI extracts details from text & files</p>
                                </div>
                            </button>
                        </div>
                    </>
                )}

                {/* From Documentation Mode */}
                {creationMode === 'from-documentation' && (
                    <CreateProjectFromSources
                        onSuccess={() => {
                            onOpenChange(false);
                            onSuccess();
                        }}
                        onBack={() => setCreationMode('select')}
                    />
                )}

                {/* Manual Mode */}
                {creationMode === 'manual' && (
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                                    <Layers className="w-5 h-5 text-white" />
                                </div>
                                <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                                    Create New Project
                                </span>
                            </DialogTitle>
                            <DialogDescription className="pt-1">
                                Create a new project to organize your requirements and estimations.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 py-6">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-slate-700 font-medium flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                    Project Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Sprint Q4 - HR Module"
                                    className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description" className="text-slate-700 font-medium flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    Description
                                </Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of this project..."
                                    className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all min-h-[80px]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="owner" className="text-slate-700 font-medium flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        Owner
                                    </Label>
                                    <Input
                                        id="owner"
                                        value={owner}
                                        onChange={(e) => setOwner(e.target.value)}
                                        placeholder={user?.email || 'Project owner'}
                                        className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="status" className="text-slate-700 font-medium flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                                        Status
                                    </Label>
                                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                        <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="techPreset" className="text-slate-700 font-medium flex items-center gap-2">
                                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                                    Default Technology <span className="text-red-500">*</span>
                                </Label>
                                <Select value={techPresetId} onValueChange={setTechPresetId}>
                                    <SelectTrigger className={`bg-slate-50/50 border-slate-200 focus:bg-white transition-all ${techPresetId === '__NONE__' ? 'border-red-300' : ''}`}>
                                        <SelectValue placeholder="Select technology (required)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {presets.map((preset) => (
                                            <SelectItem key={preset.id} value={preset.id}>
                                                {preset.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="help-text">
                                    Required. All requirements in this project will inherit this technology.
                                </p>
                            </div>

                            {/* Project Context Section */}
                            <div className="border-t border-slate-200 pt-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Project Context (optional — improves AI estimation accuracy)</p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="projectType" className="text-slate-700 font-medium flex items-center gap-2">
                                            <Target className="w-3.5 h-3.5 text-slate-400" />
                                            Project Type
                                        </Label>
                                        <Select value={projectType} onValueChange={setProjectType}>
                                            <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
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
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="domain" className="text-slate-700 font-medium flex items-center gap-2">
                                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                                            Domain
                                        </Label>
                                        <Input
                                            id="domain"
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value)}
                                            placeholder="e.g., HR, Finance, E-commerce"
                                            className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="scope" className="text-slate-700 font-medium flex items-center gap-2">
                                            <Gauge className="w-3.5 h-3.5 text-slate-400" />
                                            Scope
                                        </Label>
                                        <Select value={scope} onValueChange={setScope}>
                                            <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
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
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="teamSize" className="text-slate-700 font-medium flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            Team Size
                                        </Label>
                                        <Input
                                            id="teamSize"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={teamSize}
                                            onChange={(e) => setTeamSize(e.target.value)}
                                            placeholder="e.g., 5"
                                            className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="deadlinePressure" className="text-slate-700 font-medium flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            Deadline Pressure
                                        </Label>
                                        <Select value={deadlinePressure} onValueChange={setDeadlinePressure}>
                                            <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
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
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="methodology" className="text-slate-700 font-medium flex items-center gap-2">
                                            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                                            Methodology
                                        </Label>
                                        <Select value={methodology} onValueChange={setMethodology}>
                                            <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
                                                <SelectValue placeholder="Select methodology" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__NONE__">Not specified</SelectItem>
                                                <SelectItem value="AGILE">Agile</SelectItem>
                                                <SelectItem value="WATERFALL">Waterfall</SelectItem>
                                                <SelectItem value="HYBRID">Hybrid</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setCreationMode('select')} className="hover:bg-slate-100">
                                Back
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                            >
                                {loading ? 'Creating...' : 'Create Project'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
