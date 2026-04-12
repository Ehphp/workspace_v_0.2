/**
 * Create Project from Documentation
 *
 * Multi-step flow:
 * 1. User pastes documentation text
 * 2. AI generates project draft + technical blueprint
 * 3. User reviews and edits both sections
 * 4. On confirm → creates project + persists blueprint
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
    Loader2,
    FileText,
    Sparkles,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Plus,
    Trash2,
    Cpu,
    Target,
    Globe,
    Gauge,
    Users,
    Clock,
    GitBranch,
    Layers,
    Database,
    Link2,
    StickyNote,
    HelpCircle,
    RefreshCw,
    ClipboardList,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { generateProjectFromDocumentation } from '@/lib/project-documentation-api';
import { createProject, fetchPresets } from '@/lib/api';
import { createProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import { createProjectActivities } from '@/lib/project-activity-repository';
import type { Technology } from '@/types/database';
import type { GeneratedProjectActivity, InterventionType, ActivityGroup } from '@/types/project-activity';
import type {
    ProjectDraftBlueprint,
    ProjectFromDocumentationResult,
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintComponentType,
    IntegrationDirection,
    StructuredDocumentDigest,
} from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_TYPES: { value: BlueprintComponentType; label: string }[] = [
    // Generic
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'database', label: 'Database' },
    { value: 'integration', label: 'Integration' },
    { value: 'workflow', label: 'Workflow' },
    { value: 'reporting', label: 'Reporting' },
    { value: 'security', label: 'Security' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'external_system', label: 'External System' },
    { value: 'other', label: 'Other' },
    // Power Platform
    { value: 'canvas_app', label: 'Canvas App' },
    { value: 'model_driven_app', label: 'Model-Driven App' },
    { value: 'dataverse_table', label: 'Dataverse Table' },
    { value: 'custom_connector', label: 'Custom Connector' },
    { value: 'cloud_flow', label: 'Cloud Flow' },
    { value: 'power_automate_desktop', label: 'Power Automate Desktop' },
    { value: 'pcf_control', label: 'PCF Control' },
    // Backend
    { value: 'api_controller', label: 'API Controller' },
    { value: 'service_layer', label: 'Service Layer' },
    { value: 'repository', label: 'Repository' },
    { value: 'middleware', label: 'Middleware' },
    { value: 'queue_processor', label: 'Queue Processor' },
    { value: 'scheduled_job', label: 'Scheduled Job' },
    // Frontend
    { value: 'page', label: 'Page' },
    { value: 'component_library', label: 'Component Library' },
    { value: 'state_manager', label: 'State Manager' },
    { value: 'form', label: 'Form' },
    { value: 'data_grid', label: 'Data Grid' },
];

const DIRECTION_OPTIONS: { value: IntegrationDirection; label: string }[] = [
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'bidirectional', label: 'Bidirectional' },
    { value: 'unknown', label: 'Unknown' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CreateProjectFromDocumentationProps {
    onSuccess: () => void;
    onBack: () => void;
}

type Phase = 'input' | 'generating' | 'review' | 'saving' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CreateProjectFromDocumentation({
    onSuccess,
    onBack,
}: CreateProjectFromDocumentationProps) {
    const { user, currentOrganization } = useAuthStore();

    // Phase management
    const [phase, setPhase] = useState<Phase>('input');
    const [error, setError] = useState<string | null>(null);

    // Step 1: Input
    const [sourceText, setSourceText] = useState('');

    // Step 2: Review — Project Draft
    const [draft, setDraft] = useState<ProjectDraftBlueprint | null>(null);
    const [technologies, setTechnologies] = useState<Technology[]>([]);

    // Step 2: Review — Technical Blueprint
    const [blueprintSourceText, setBlueprintSourceText] = useState('');
    const [summary, setSummary] = useState('');
    const [components, setComponents] = useState<BlueprintComponent[]>([]);
    const [dataDomains, setDataDomains] = useState<BlueprintDataDomain[]>([]);
    const [integrations, setIntegrations] = useState<BlueprintIntegration[]>([]);
    const [architecturalNotes, setArchitecturalNotes] = useState<string[]>([]);
    const [assumptions, setAssumptions] = useState<string[]>([]);
    const [missingInformation, setMissingInformation] = useState<string[]>([]);
    const [blueprintConfidence, setBlueprintConfidence] = useState<number>(0);
    const [structuredDigest, setStructuredDigest] = useState<StructuredDocumentDigest | undefined>();

    // Step 2: Review — Project Activities (Pass 3)
    const [projectActivities, setProjectActivities] = useState<GeneratedProjectActivity[]>([]);
    const [disabledActivities, setDisabledActivities] = useState<Set<number>>(new Set());

    // ── Generate ────────────────────────────────────────────────────
    const handleGenerate = useCallback(async () => {
        setPhase('generating');
        setError(null);

        try {
            // Load technologies for the technologyId selector
            const techs = await fetchPresets();
            setTechnologies(techs);

            const response = await generateProjectFromDocumentation(sourceText);

            if (!response.success || !response.result) {
                setError(response.error || 'Generation failed');
                setPhase('error');
                return;
            }

            const { projectDraft, technicalBlueprint, structuredDigest: sdd } = response.result;

            // Populate draft state
            setDraft(projectDraft);

            // Capture structured digest
            setStructuredDigest(sdd ?? undefined);

            // Populate blueprint state
            setBlueprintSourceText(technicalBlueprint.sourceText ?? sourceText);
            setSummary(technicalBlueprint.summary ?? '');
            setComponents(technicalBlueprint.components ?? []);
            setDataDomains(technicalBlueprint.dataDomains ?? []);
            setIntegrations(technicalBlueprint.integrations ?? []);
            setArchitecturalNotes(technicalBlueprint.architecturalNotes ?? []);
            setAssumptions(technicalBlueprint.assumptions ?? []);
            setMissingInformation(technicalBlueprint.missingInformation ?? []);
            setBlueprintConfidence(technicalBlueprint.confidence ?? 0);

            // Populate project activities (Pass 3)
            console.log('[CreateProjectFromDoc] Raw response.result.projectActivities:', response.result.projectActivities);
            console.log('[CreateProjectFromDoc] Activities count from API:', response.result.projectActivities?.length ?? 'undefined/null');
            setProjectActivities(response.result.projectActivities ?? []);

            setPhase('review');
        } catch (err) {
            console.error('[CreateProjectFromDoc] Generation error:', err);
            setError(err instanceof Error ? err.message : 'Unexpected error');
            setPhase('error');
        }
    }, [sourceText]);

    // ── Update draft field ──────────────────────────────────────────
    const updateDraft = useCallback(
        (field: keyof ProjectDraftBlueprint, value: unknown) => {
            setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
        },
        [],
    );

    // ── Component CRUD ──────────────────────────────────────────────
    const addComponent = () => {
        setComponents((prev) => [
            ...prev,
            { name: '', type: 'other' as BlueprintComponentType, description: '' },
        ]);
    };

    const updateComponent = (index: number, field: keyof BlueprintComponent, value: unknown) => {
        setComponents((prev) =>
            prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
        );
    };

    const removeComponent = (index: number) => {
        setComponents((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Integration CRUD ────────────────────────────────────────────
    const addIntegration = () => {
        setIntegrations((prev) => [
            ...prev,
            { systemName: '', direction: 'unknown' as IntegrationDirection, description: '' },
        ]);
    };

    const updateIntegration = (index: number, field: keyof BlueprintIntegration, value: unknown) => {
        setIntegrations((prev) =>
            prev.map((i, idx) => (idx === index ? { ...i, [field]: value } : i)),
        );
    };

    const removeIntegration = (index: number) => {
        setIntegrations((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Data Domain CRUD ────────────────────────────────────────────
    const addDataDomain = () => {
        setDataDomains((prev) => [...prev, { name: '', description: '' }]);
    };

    const updateDataDomain = (index: number, field: keyof BlueprintDataDomain, value: unknown) => {
        setDataDomains((prev) =>
            prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
        );
    };

    const removeDataDomain = (index: number) => {
        setDataDomains((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Project Activity CRUD ───────────────────────────────────────
    const toggleActivity = (index: number) => {
        setDisabledActivities((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const updateActivity = <K extends keyof GeneratedProjectActivity>(
        index: number,
        field: K,
        value: GeneratedProjectActivity[K],
    ) => {
        setProjectActivities((prev) =>
            prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
        );
    };

    const removeActivity = (index: number) => {
        setProjectActivities((prev) => prev.filter((_, i) => i !== index));
    };

    const addActivity = () => {
        setProjectActivities((prev) => [
            ...prev,
            {
                code: `CUSTOM_${prev.length + 1}`,
                name: '',
                description: '',
                group: 'DEV' as ActivityGroup,
                baseHours: 1.0,
                interventionType: 'NEW' as InterventionType,
                effortModifier: 1.0,
                sourceActivityCode: null,
                blueprintNodeName: null,
                blueprintNodeType: null,
                aiRationale: 'Aggiunta manuale dall\'utente',
                confidence: 1.0,
            },
        ]);
    };

    // ── Save ────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!user || !currentOrganization || !draft) return;

        setPhase('saving');

        try {
            // 1. Create the project
            const project = await createProject({
                userId: user.id,
                organizationId: currentOrganization.id,
                name: draft.name,
                description: draft.description,
                owner: draft.owner || user.email || '',
                technologyId: draft.technologyId || null,
                status: 'DRAFT',
                projectType: draft.projectType || null,
                domain: draft.domain || null,
                scope: draft.scope || null,
                teamSize: draft.teamSize || null,
                deadlinePressure: draft.deadlinePressure || null,
                methodology: draft.methodology || null,
            });

            // 2. Save the technical blueprint (version 1)
            await createProjectTechnicalBlueprint({
                projectId: project.id,
                sourceText: blueprintSourceText,
                summary: summary || undefined,
                components,
                dataDomains,
                integrations,
                architecturalNotes,
                assumptions,
                missingInformation,
                confidence: blueprintConfidence || undefined,
                structuredDigest,
            });

            // 3. Save project custom activities (only enabled ones)
            console.log('[CreateProjectFromDoc] projectActivities state:', projectActivities.length, 'items');
            console.log('[CreateProjectFromDoc] disabledActivities:', [...disabledActivities]);
            const enabledActivities = projectActivities
                .filter((_, i) => !disabledActivities.has(i))
                .map((a, i) => ({
                    code: a.code,
                    name: a.name,
                    description: a.description,
                    group: a.group,
                    baseHours: a.baseHours,
                    interventionType: a.interventionType,
                    effortModifier: a.effortModifier,
                    sourceActivityCode: a.sourceActivityCode,
                    blueprintNodeName: a.blueprintNodeName,
                    blueprintNodeType: a.blueprintNodeType,
                    aiRationale: a.aiRationale,
                    confidence: a.confidence,
                    isEnabled: true,
                    position: i,
                }));
            console.log('[CreateProjectFromDoc] enabledActivities to save:', enabledActivities.length);
            if (enabledActivities.length > 0) {
                const savedActivities = await createProjectActivities(project.id, enabledActivities);
                console.log('[CreateProjectFromDoc] Saved activities:', savedActivities.length);
            } else {
                console.warn('[CreateProjectFromDoc] No enabled activities to save');
            }

            toast.success('Progetto creato con successo da documentazione');
            onSuccess();
        } catch (err) {
            console.error('[CreateProjectFromDoc] Save error:', err);
            toast.error('Errore durante il salvataggio del progetto');
            setPhase('review');
        }
    }, [
        user, currentOrganization, draft, blueprintSourceText, summary,
        components, dataDomains, integrations, architecturalNotes,
        assumptions, missingInformation, blueprintConfidence,
        projectActivities, disabledActivities, onSuccess,
    ]);

    // ── Render: Input Phase ─────────────────────────────────────────
    if (phase === 'input') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Create Project from Documentation
                        </h2>
                        <p className="text-sm text-slate-500">
                            Paste your project documentation and AI will extract project details and technical architecture.
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">
                        Project Documentation
                    </Label>
                    <Textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="Paste your project documentation, requirements document, or technical specification here..."
                        className="min-h-[300px] bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-slate-400">
                        Min 50 characters · Max 20,000 characters · {sourceText.length} chars
                    </p>
                </div>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={sourceText.trim().length < 50}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
                    >
                        <Sparkles className="w-4 h-4 mr-2" /> Analyze Documentation
                    </Button>
                </div>
            </div>
        );
    }

    // ── Render: Generating Phase ────────────────────────────────────
    if (phase === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-600 font-medium">Analyzing documentation...</p>
                <p className="text-sm text-slate-400">
                    Extracting project details and technical architecture
                </p>
            </div>
        );
    }

    // ── Render: Error Phase ─────────────────────────────────────────
    if (phase === 'error') {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <p className="text-slate-600 font-medium">Analysis Failed</p>
                <p className="text-sm text-red-500 max-w-md text-center">{error}</p>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button variant="outline" onClick={() => setPhase('input')}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                    </Button>
                </div>
            </div>
        );
    }

    // ── Render: Saving Phase ────────────────────────────────────────
    if (phase === 'saving') {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-600 font-medium">Creating project...</p>
            </div>
        );
    }

    // ── Render: Review Phase ────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Review & Edit
                        </h2>
                        <p className="text-sm text-slate-500">
                            Review and adjust the extracted project details before saving.
                        </p>
                    </div>
                </div>
                {blueprintConfidence > 0 && (
                    <Badge variant={blueprintConfidence >= 0.7 ? 'default' : 'secondary'}>
                        Confidence: {Math.round(blueprintConfidence * 100)}%
                    </Badge>
                )}
            </div>

            {/* Section A: Project Draft */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Project Details
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            Project Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={draft?.name ?? ''}
                            onChange={(e) => updateDraft('name', e.target.value)}
                            className="bg-slate-50/50 border-slate-200"
                        />
                    </div>

                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Description
                        </Label>
                        <Textarea
                            value={draft?.description ?? ''}
                            onChange={(e) => updateDraft('description', e.target.value)}
                            className="bg-slate-50/50 border-slate-200 min-h-[80px]"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Owner
                        </Label>
                        <Input
                            value={draft?.owner ?? ''}
                            onChange={(e) => updateDraft('owner', e.target.value)}
                            placeholder={user?.email || ''}
                            className="bg-slate-50/50 border-slate-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-slate-400" />
                            Default Technology
                        </Label>
                        <Select
                            value={draft?.technologyId ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('technologyId', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                <SelectValue placeholder="Select technology" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__NONE__">None</SelectItem>
                                {technologies.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-slate-400" />
                            Project Type
                        </Label>
                        <Select
                            value={draft?.projectType ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('projectType', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                <SelectValue />
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

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            Domain
                        </Label>
                        <Input
                            value={draft?.domain ?? ''}
                            onChange={(e) => updateDraft('domain', e.target.value || null)}
                            placeholder="e.g., HR, Finance, E-commerce"
                            className="bg-slate-50/50 border-slate-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-slate-400" />
                            Scope
                        </Label>
                        <Select
                            value={draft?.scope ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('scope', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                <SelectValue />
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

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Team Size
                        </Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            value={draft?.teamSize ?? ''}
                            onChange={(e) =>
                                updateDraft(
                                    'teamSize',
                                    e.target.value ? parseInt(e.target.value, 10) : null,
                                )
                            }
                            placeholder="e.g., 5"
                            className="bg-slate-50/50 border-slate-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Deadline Pressure
                        </Label>
                        <Select
                            value={draft?.deadlinePressure ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('deadlinePressure', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                <SelectValue />
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

                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                            Methodology
                        </Label>
                        <Select
                            value={draft?.methodology ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('methodology', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                <SelectValue />
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

                {/* AI Notes */}
                {draft?.assumptions && draft.assumptions.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> AI Assumptions
                        </p>
                        <ul className="text-xs text-amber-600 space-y-0.5">
                            {draft.assumptions.map((a, i) => (
                                <li key={i}>• {a}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {draft?.missingFields && draft.missingFields.length > 0 && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Missing Information
                        </p>
                        <ul className="text-xs text-blue-600 space-y-0.5">
                            {draft.missingFields.map((m, i) => (
                                <li key={i}>• {m}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Section B: Technical Blueprint */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-5 bg-white">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-500" />
                    Technical Blueprint
                </h3>

                {/* Summary */}
                {summary && (
                    <div className="space-y-1.5">
                        <Label className="text-slate-700 text-sm">Summary</Label>
                        <Textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="bg-slate-50/50 border-slate-200 min-h-[60px] text-sm"
                        />
                    </div>
                )}

                {/* Components */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-emerald-500" />
                            Components ({components.length})
                        </Label>
                        <Button size="sm" variant="outline" onClick={addComponent} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {components.map((comp, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <Input
                                        value={comp.name}
                                        onChange={(e) => updateComponent(i, 'name', e.target.value)}
                                        placeholder="Component name"
                                        className="text-sm h-8"
                                    />
                                    <Select
                                        value={comp.type}
                                        onValueChange={(v) => updateComponent(i, 'type', v)}
                                    >
                                        <SelectTrigger className="text-sm h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMPONENT_TYPES.map((ct) => (
                                                <SelectItem key={ct.value} value={ct.value}>
                                                    {ct.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={comp.description ?? ''}
                                        onChange={(e) => updateComponent(i, 'description', e.target.value)}
                                        placeholder="Description"
                                        className="text-sm h-8"
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                    onClick={() => removeComponent(i)}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                        {components.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No components extracted. Add one manually.</p>
                        )}
                    </div>
                </div>

                {/* Integrations */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-purple-500" />
                            Integrations ({integrations.length})
                        </Label>
                        <Button size="sm" variant="outline" onClick={addIntegration} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {integrations.map((integ, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <Input
                                        value={integ.systemName}
                                        onChange={(e) => updateIntegration(i, 'systemName', e.target.value)}
                                        placeholder="System name"
                                        className="text-sm h-8"
                                    />
                                    <Select
                                        value={integ.direction ?? 'unknown'}
                                        onValueChange={(v) => updateIntegration(i, 'direction', v)}
                                    >
                                        <SelectTrigger className="text-sm h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DIRECTION_OPTIONS.map((d) => (
                                                <SelectItem key={d.value} value={d.value}>
                                                    {d.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={integ.description ?? ''}
                                        onChange={(e) => updateIntegration(i, 'description', e.target.value)}
                                        placeholder="Description"
                                        className="text-sm h-8"
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                    onClick={() => removeIntegration(i)}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                        {integrations.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No integrations extracted.</p>
                        )}
                    </div>
                </div>

                {/* Data Domains */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-blue-500" />
                            Data Domains ({dataDomains.length})
                        </Label>
                        <Button size="sm" variant="outline" onClick={addDataDomain} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {dataDomains.map((dd, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <Input
                                        value={dd.name}
                                        onChange={(e) => updateDataDomain(i, 'name', e.target.value)}
                                        placeholder="Domain name"
                                        className="text-sm h-8"
                                    />
                                    <Input
                                        value={dd.description ?? ''}
                                        onChange={(e) => updateDataDomain(i, 'description', e.target.value)}
                                        placeholder="Description"
                                        className="text-sm h-8"
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                    onClick={() => removeDataDomain(i)}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                        {dataDomains.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No data domains extracted.</p>
                        )}
                    </div>
                </div>

                {/* Section C: Project Activities */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-teal-500" />
                            Attività Progetto ({projectActivities.length})
                        </Label>
                        <Button size="sm" variant="outline" onClick={addActivity} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Aggiungi
                        </Button>
                    </div>

                    {/* Summary bar */}
                    {projectActivities.length > 0 && (() => {
                        const enabledActs = projectActivities.filter((_, i) => !disabledActivities.has(i));
                        const totalEffective = enabledActs.reduce((s, a) => s + a.baseHours * a.effortModifier, 0);
                        const byGroup = (['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'] as ActivityGroup[]).map(g => ({
                            group: g,
                            count: enabledActs.filter(a => a.group === g).length,
                            hours: enabledActs.filter(a => a.group === g).reduce((s, a) => s + a.baseHours * a.effortModifier, 0),
                        })).filter(g => g.count > 0);
                        const groupColors: Record<string, string> = {
                            ANALYSIS: 'bg-amber-100 text-amber-700',
                            DEV: 'bg-blue-100 text-blue-700',
                            TEST: 'bg-green-100 text-green-700',
                            OPS: 'bg-purple-100 text-purple-700',
                            GOVERNANCE: 'bg-slate-200 text-slate-700',
                        };
                        return (
                            <div className="p-3 rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-teal-700">
                                        {enabledActs.length} attive / {projectActivities.length} totali
                                    </span>
                                    <span className="text-sm font-bold text-teal-800">
                                        {totalEffective.toFixed(1)}h stimate
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {byGroup.map(g => (
                                        <span key={g.group} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${groupColors[g.group]}`}>
                                            {g.group} {g.count} · {g.hours.toFixed(1)}h
                                        </span>
                                    ))}
                                </div>
                                {/* Effort bar */}
                                <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
                                    {byGroup.map(g => (
                                        <div
                                            key={g.group}
                                            className={`${groupColors[g.group].split(' ')[0].replace('100', '400')}`}
                                            style={{ width: `${(g.hours / totalEffective) * 100}%` }}
                                            title={`${g.group}: ${g.hours.toFixed(1)}h`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {projectActivities.length > 0 ? (
                        <div className="space-y-1.5">
                            {projectActivities.map((act, i) => {
                                const isDisabled = disabledActivities.has(i);
                                const interventionColors: Record<string, string> = {
                                    NEW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                    MODIFY: 'bg-amber-100 text-amber-700 border-amber-200',
                                    CONFIGURE: 'bg-sky-100 text-sky-700 border-sky-200',
                                    MIGRATE: 'bg-violet-100 text-violet-700 border-violet-200',
                                };
                                const groupIcons: Record<string, string> = {
                                    ANALYSIS: '🔍', DEV: '⚙️', TEST: '🧪', OPS: '🚀', GOVERNANCE: '📋',
                                };
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${isDisabled
                                            ? 'bg-slate-50 border-slate-200 opacity-50'
                                            : 'bg-white border-slate-200 hover:border-teal-200 hover:shadow-sm'
                                            }`}
                                    >
                                        {/* Toggle */}
                                        <button
                                            onClick={() => toggleActivity(i)}
                                            className="mt-0.5 shrink-0"
                                            title={isDisabled ? 'Attiva' : 'Disattiva'}
                                        >
                                            {isDisabled ? (
                                                <ToggleLeft className="w-5 h-5 text-slate-300" />
                                            ) : (
                                                <ToggleRight className="w-5 h-5 text-teal-500" />
                                            )}
                                        </button>

                                        {/* Main content */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-base" title={act.group}>{groupIcons[act.group] ?? '📌'}</span>
                                                <Input
                                                    value={act.name}
                                                    onChange={(e) => updateActivity(i, 'name', e.target.value)}
                                                    disabled={isDisabled}
                                                    className="text-sm h-7 font-semibold flex-1 min-w-[200px] border-transparent hover:border-slate-200 focus:border-slate-300 bg-transparent px-1"
                                                    placeholder="Nome attività"
                                                />
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${interventionColors[act.interventionType]}`}>
                                                    {act.interventionType}
                                                </Badge>
                                                <span className="text-xs font-mono font-bold text-slate-600 shrink-0">
                                                    {(act.baseHours * act.effortModifier).toFixed(1)}h
                                                </span>
                                            </div>
                                            <Input
                                                value={act.description}
                                                onChange={(e) => updateActivity(i, 'description', e.target.value)}
                                                disabled={isDisabled}
                                                className="text-xs h-6 text-slate-500 border-transparent hover:border-slate-200 focus:border-slate-300 bg-transparent px-1"
                                                placeholder="Descrizione"
                                            />
                                            {/* Metadata row */}
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
                                                <span className="font-mono">{act.code}</span>
                                                {act.sourceActivityCode && (
                                                    <span>← {act.sourceActivityCode}</span>
                                                )}
                                                {act.blueprintNodeName && (
                                                    <span className="text-teal-500">⚓ {act.blueprintNodeName}</span>
                                                )}
                                                {act.confidence != null && (
                                                    <span title="Confidence AI">
                                                        {'●'.repeat(Math.round(act.confidence * 5))}{'○'.repeat(5 - Math.round(act.confidence * 5))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Inline edit controls */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Select
                                                value={act.group}
                                                onValueChange={(v) => updateActivity(i, 'group', v as ActivityGroup)}
                                                disabled={isDisabled}
                                            >
                                                <SelectTrigger className="text-[10px] h-6 w-[90px] border-slate-200">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'] as ActivityGroup[]).map((g) => (
                                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select
                                                value={act.interventionType}
                                                onValueChange={(v) => updateActivity(i, 'interventionType', v as InterventionType)}
                                                disabled={isDisabled}
                                            >
                                                <SelectTrigger className="text-[10px] h-6 w-[80px] border-slate-200">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(['NEW', 'MODIFY', 'CONFIGURE', 'MIGRATE'] as InterventionType[]).map((t) => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                step="0.125"
                                                min="0.125"
                                                max="40"
                                                value={act.baseHours}
                                                onChange={(e) => updateActivity(i, 'baseHours', parseFloat(e.target.value) || 0.125)}
                                                disabled={isDisabled}
                                                className="text-[10px] h-6 w-[55px] text-center border-slate-200"
                                                title="Ore base"
                                            />
                                            <span className="text-[10px] text-slate-400">×</span>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                max="3.0"
                                                value={act.effortModifier}
                                                onChange={(e) => updateActivity(i, 'effortModifier', parseFloat(e.target.value) || 1.0)}
                                                disabled={isDisabled}
                                                className="text-[10px] h-6 w-[50px] text-center border-slate-200"
                                                title="Effort modifier"
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-slate-300 hover:text-red-500"
                                                onClick={() => removeActivity(i)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic py-2">
                            Nessuna attività generata. Aggiungi manualmente o rigenera.
                        </p>
                    )}
                </div>

                {/* Architectural Notes */}
                {architecturalNotes.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                            Architectural Notes
                        </Label>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <ul className="text-sm text-slate-600 space-y-1">
                                {architecturalNotes.map((note, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-slate-400 mt-0.5">•</span>
                                        <span>{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Assumptions */}
                {assumptions.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Blueprint Assumptions
                        </p>
                        <ul className="text-xs text-amber-600 space-y-0.5">
                            {assumptions.map((a, i) => (
                                <li key={i}>• {a}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Missing Information */}
                {missingInformation.length > 0 && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Missing Information
                        </p>
                        <ul className="text-xs text-blue-600 space-y-0.5">
                            {missingInformation.map((m, i) => (
                                <li key={i}>• {m}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setPhase('input')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Edit Documentation
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!draft?.name?.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Create Project
                </Button>
            </div>
        </div>
    );
}
