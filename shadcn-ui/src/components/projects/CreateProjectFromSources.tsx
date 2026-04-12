/**
 * Create Project from Sources
 *
 * Multi-source ingestion flow:
 * 1. User adds documentation sources (paste text, upload/drag files)
 * 2. Sources are parsed client-side and displayed as a managed list
 * 3. AI generates project draft + technical blueprint from combined text
 * 4. User reviews and edits both sections
 * 5. On confirm → creates project + persists blueprint
 */

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
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
    CheckCircle2,
    Check,
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
    Upload,
    ClipboardPaste,
    X,
    FileCode,
    File as FileIcon,
    AlertTriangle,
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
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintRelation,
    BlueprintRelationType,
    BlueprintComponentType,
    IntegrationDirection,
    ReviewStatus,
} from '@/types/project-technical-blueprint';
import { BlueprintNodeReviewCard } from './blueprint/BlueprintNodeReviewCard';
import { BlueprintRelationReviewCard, AddRelationInline } from './blueprint/BlueprintRelationReviewCard';
import type { ProjectSourceItem, DocumentParsingWarning, ParsedDocument } from '@/types/project-sources';
import { ACCEPTED_FILE_TYPES } from '@/types/project-sources';
import {
    parseProjectFile,
    buildProjectSourceBundle,
    getSourcePreview,
    formatFileSize,
    generateSourceId,
} from '@/lib/project-sources';

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

interface CreateProjectFromSourcesProps {
    onSuccess: () => void;
    onBack: () => void;
}

type Phase = 'input' | 'generating' | 'review' | 'saving' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CreateProjectFromSources({
    onSuccess,
    onBack,
}: CreateProjectFromSourcesProps) {
    const { user, currentOrganization } = useAuthStore();

    // Phase management
    const [phase, setPhase] = useState<Phase>('input');
    const [error, setError] = useState<string | null>(null);

    // Sources state
    const [sources, setSources] = useState<ProjectSourceItem[]>([]);
    const [pasteText, setPasteText] = useState('');
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const pasteTextRef = useRef<HTMLTextAreaElement>(null);

    // Review — Project Draft
    const [draft, setDraft] = useState<ProjectDraftBlueprint | null>(null);
    const [technologies, setTechnologies] = useState<Technology[]>([]);

    // Review — Technical Blueprint
    const [blueprintSourceText, setBlueprintSourceText] = useState('');
    const [summary, setSummary] = useState('');
    const [components, setComponents] = useState<BlueprintComponent[]>([]);
    const [dataDomains, setDataDomains] = useState<BlueprintDataDomain[]>([]);
    const [integrations, setIntegrations] = useState<BlueprintIntegration[]>([]);
    const [architecturalNotes, setArchitecturalNotes] = useState<string[]>([]);
    const [assumptions, setAssumptions] = useState<string[]>([]);
    const [missingInformation, setMissingInformation] = useState<string[]>([]);
    const [blueprintConfidence, setBlueprintConfidence] = useState<number>(0);
    // v2 fields
    const [relations, setRelations] = useState<BlueprintRelation[]>([]);
    const [qualityFlags, setQualityFlags] = useState<string[]>([]);
    const [coverage, setCoverage] = useState<number | undefined>();
    const [blueprintReviewStatus, setBlueprintReviewStatus] = useState<ReviewStatus>('draft');
    const [addingRelation, setAddingRelation] = useState(false);

    // Step 3: Review — Project Activities (Pass 3)
    const [projectActivities, setProjectActivities] = useState<GeneratedProjectActivity[]>([]);
    const [disabledActivities, setDisabledActivities] = useState<Set<number>>(new Set());

    // ── Source Management ───────────────────────────────────────────

    const addPasteSource = useCallback(() => {
        const text = pasteText.trim();
        if (!text) return;

        const item: ProjectSourceItem = {
            id: generateSourceId(),
            type: 'pasted_text',
            label: 'Pasted Text',
            status: 'ready',
            textContent: text,
        };

        setSources((prev) => [...prev, item]);
        setPasteText('');
        pasteTextRef.current?.focus();
    }, [pasteText]);

    const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        // Add placeholders for processing
        const placeholders: ProjectSourceItem[] = acceptedFiles.map((f) => ({
            id: generateSourceId(),
            type: 'file' as const,
            label: f.name,
            status: 'processing' as const,
            textContent: '',
            fileName: f.name,
            mimeType: f.type,
            sizeBytes: f.size,
        }));

        setSources((prev) => [...prev, ...placeholders]);
        setIsProcessingFiles(true);

        // Parse all files
        const results = await Promise.all(acceptedFiles.map(parseProjectFile));

        // Replace placeholders with real results
        setSources((prev) => {
            const placeholderIds = new Set(placeholders.map((p) => p.id));
            const withoutPlaceholders = prev.filter((s) => !placeholderIds.has(s.id));
            return [...withoutPlaceholders, ...results];
        });

        setIsProcessingFiles(false);

        const errors = results.filter((r) => r.status === 'error');
        if (errors.length > 0) {
            toast.error(`${errors.length} file(s) could not be parsed`, {
                description: errors.map((e) => `${e.label}: ${e.errorMessage}`).join('\n'),
            });
        }
    }, []);

    const removeSource = useCallback((id: string) => {
        setSources((prev) => prev.filter((s) => s.id !== id));
    }, []);

    // ── Dropzone ────────────────────────────────────────────────────

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleFileDrop,
        accept: ACCEPTED_FILE_TYPES,
        noClick: false,
        noKeyboard: false,
        multiple: true,
    });

    // ── Derived state ───────────────────────────────────────────────

    const readySources = sources.filter((s) => s.status === 'ready' && s.textContent.trim().length > 0);
    const hasValidSources = readySources.length > 0;
    const hasProcessing = sources.some((s) => s.status === 'processing');
    const bundle = buildProjectSourceBundle(sources);

    // ── Generate ────────────────────────────────────────────────────

    const handleGenerate = useCallback(async () => {
        if (!hasValidSources) return;

        setPhase('generating');
        setError(null);

        try {
            const techs = await fetchPresets();
            setTechnologies(techs);

            const response = await generateProjectFromDocumentation(bundle.combinedSourceText);

            if (!response.success || !response.result) {
                setError(response.error || 'Generation failed');
                setPhase('error');
                return;
            }

            const { projectDraft, technicalBlueprint } = response.result;

            // Populate draft state
            setDraft(projectDraft);

            // Populate blueprint state
            setBlueprintSourceText(bundle.combinedSourceText);
            setSummary(technicalBlueprint.summary ?? '');
            setComponents(technicalBlueprint.components ?? []);
            setDataDomains(technicalBlueprint.dataDomains ?? []);
            setIntegrations(technicalBlueprint.integrations ?? []);
            setArchitecturalNotes(technicalBlueprint.architecturalNotes ?? []);
            setAssumptions(technicalBlueprint.assumptions ?? []);
            setMissingInformation(technicalBlueprint.missingInformation ?? []);
            setBlueprintConfidence(technicalBlueprint.confidence ?? 0);
            setRelations(technicalBlueprint.relations ?? []);
            setQualityFlags(technicalBlueprint.qualityFlags ?? []);
            setCoverage(technicalBlueprint.coverage ?? undefined);
            setBlueprintReviewStatus('draft');

            // Populate project activities (Pass 3)
            console.log('[CreateProjectFromSources] Raw response.result.projectActivities:', response.result.projectActivities);
            setProjectActivities(response.result.projectActivities ?? []);

            setPhase('review');
        } catch (err) {
            console.error('[CreateProjectFromSources] Generation error:', err);
            setError(err instanceof Error ? err.message : 'Unexpected error');
            setPhase('error');
        }
    }, [hasValidSources, bundle.combinedSourceText]);

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

    // ── Activity CRUD ────────────────────────────────────────────────

    const toggleActivity = (index: number) => {
        setDisabledActivities((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const updateActivity = (index: number, field: keyof GeneratedProjectActivity, value: unknown) => {
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
                code: `PRJ_CUSTOM_${Date.now()}`,
                name: 'New Activity',
                description: '',
                group: 'DEV' as ActivityGroup,
                baseHours: 4,
                interventionType: 'NEW' as InterventionType,
                effortModifier: 1.0,
                sourceActivityCode: null,
                blueprintNodeName: null,
                blueprintNodeType: null,
                aiRationale: 'Manually added',
                confidence: null,
            },
        ]);
    };

    // ── Save ────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!user || !currentOrganization || !draft) return;

        if (!draft.technologyId) {
            toast.error('Technology is required. Please select a technology before saving.');
            return;
        }

        setPhase('saving');

        try {
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
                relations: relations.length > 0 ? relations : undefined,
                coverage,
                qualityFlags: qualityFlags.length > 0 ? qualityFlags : undefined,
                reviewStatus: blueprintReviewStatus,
            });

            // 3. Save project custom activities (only enabled ones)
            console.log('[CreateProjectFromSources] projectActivities state:', projectActivities.length, 'items');
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
            console.log('[CreateProjectFromSources] enabledActivities to save:', enabledActivities.length);
            if (enabledActivities.length > 0) {
                const savedActivities = await createProjectActivities(project.id, enabledActivities);
                console.log('[CreateProjectFromSources] Saved activities:', savedActivities.length);
            }

            toast.success('Project created successfully from sources');
            onSuccess();
        } catch (err) {
            console.error('[CreateProjectFromSources] Save error:', err);
            toast.error('Error saving the project');
            setPhase('review');
        }
    }, [
        user, currentOrganization, draft, blueprintSourceText, summary,
        components, dataDomains, integrations, architecturalNotes,
        assumptions, missingInformation, blueprintConfidence,
        relations, qualityFlags, coverage, blueprintReviewStatus,
        projectActivities, disabledActivities, onSuccess,
    ]);

    // ═════════════════════════════════════════════════════════════════
    // RENDER: Input Phase
    // ═════════════════════════════════════════════════════════════════

    if (phase === 'input') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                        <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Create Project from Sources
                        </h2>
                        <p className="text-sm text-slate-500">
                            Add documentation sources such as pasted text or uploaded files. Syntero will combine them and extract a project draft and technical baseline.
                        </p>
                    </div>
                </div>

                {/* Section A: Paste Text */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                    <div className="flex items-center gap-2">
                        <ClipboardPaste className="w-4 h-4 text-slate-500" />
                        <Label className="text-slate-700 font-medium text-sm">Paste Text</Label>
                    </div>
                    <Textarea
                        ref={pasteTextRef}
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Paste your project documentation, requirements, or technical specification here…"
                        className="min-h-[150px] bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-sm"
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                            {pasteText.length} characters
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={addPasteSource}
                            disabled={pasteText.trim().length === 0}
                            className="h-8 text-xs"
                        >
                            <Plus className="w-3 h-3 mr-1" /> Add Text Source
                        </Button>
                    </div>
                </div>

                {/* Section B: Drag & Drop / Upload */}
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragActive
                        ? 'border-emerald-400 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
                        }`}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-2">
                        <Upload className={`w-8 h-8 ${isDragActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                        {isDragActive ? (
                            <p className="text-sm font-medium text-emerald-600">
                                Drop files here…
                            </p>
                        ) : (
                            <>
                                <p className="text-sm font-medium text-slate-600">
                                    Drag & drop files here, or click to browse
                                </p>
                                <p className="text-xs text-slate-400">
                                    Supported: .txt, .md, .pdf, .docx · Max 10 MB per file
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Section C: Sources List */}
                {sources.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            Sources ({sources.length})
                        </Label>
                        <div className="space-y-2">
                            {sources.map((source) => (
                                <SourceCard
                                    key={source.id}
                                    source={source}
                                    onRemove={() => removeSource(source.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {sources.length === 0 && (
                    <div className="border border-slate-100 rounded-xl p-6 text-center bg-slate-25">
                        <p className="text-sm text-slate-400">
                            No sources added yet. Paste text or upload files to get started.
                        </p>
                    </div>
                )}

                {/* Unsaved paste text warning */}
                {pasteText.trim().length > 0 && sources.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            You have unsaved text in the paste area. Click "Add Text Source" to include it.
                        </p>
                    </div>
                )}

                {/* Extraction warnings */}
                {bundle.warnings && bundle.warnings.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                        {deduplicateWarnings(bundle.warnings).map((w, i) => (
                            <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {w.message}
                            </p>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center">
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <div className="flex items-center gap-3">
                        {hasValidSources && (
                            <p className="text-xs text-slate-500">
                                {readySources.length} source{readySources.length !== 1 ? 's' : ''} ready · {bundle.combinedSourceText.length} chars total
                            </p>
                        )}
                        <Button
                            onClick={handleGenerate}
                            disabled={!hasValidSources || hasProcessing}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
                        >
                            {isProcessingFiles ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            Analyze Sources
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════
    // RENDER: Generating Phase
    // ═════════════════════════════════════════════════════════════════

    if (phase === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-600 font-medium">Analyzing sources…</p>
                <p className="text-sm text-slate-400">
                    Extracting project details and technical architecture from {readySources.length} source{readySources.length !== 1 ? 's' : ''}
                </p>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════
    // RENDER: Error Phase
    // ═════════════════════════════════════════════════════════════════

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

    // ═════════════════════════════════════════════════════════════════
    // RENDER: Saving Phase
    // ═════════════════════════════════════════════════════════════════

    if (phase === 'saving') {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-600 font-medium">Creating project…</p>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════
    // RENDER: Review Phase
    // ═════════════════════════════════════════════════════════════════

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
                            <Cpu className={`w-3.5 h-3.5 ${!draft?.technologyId ? 'text-red-500' : 'text-slate-400'}`} />
                            Default Technology <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={draft?.technologyId ?? '__NONE__'}
                            onValueChange={(v) => updateDraft('technologyId', v === '__NONE__' ? null : v)}
                        >
                            <SelectTrigger className={`bg-slate-50/50 ${!draft?.technologyId ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}>
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
                        {!draft?.technologyId && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Technology is required to create a project.
                            </p>
                        )}
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

            {/* Section B: Technical Blueprint — Structured Curation */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-5 bg-white">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-500" />
                        Technical Blueprint
                    </h3>
                    <div className="flex items-center gap-2">
                        {coverage != null && (
                            <Badge variant="secondary" className="text-[10px]">
                                Coverage: {Math.round(coverage * 100)}%
                            </Badge>
                        )}
                        {qualityFlags.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">
                                {qualityFlags.length} flag{qualityFlags.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                        <Badge className={`text-[10px] ${blueprintReviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {blueprintReviewStatus}
                        </Badge>
                    </div>
                </div>

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

                {/* Components — structured review */}
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
                            <BlueprintNodeReviewCard
                                key={comp.id ?? `comp-${i}`}
                                kind="component"
                                node={comp}
                                index={i}
                                qualityFlags={qualityFlags}
                                onUpdate={(idx, patch) => updateComponent(idx, Object.keys(patch)[0] as keyof BlueprintComponent, Object.values(patch)[0])}
                                onRemove={removeComponent}
                                onApprove={(idx) => updateComponent(idx, 'reviewStatus', 'approved')}
                                onReject={removeComponent}
                            />
                        ))}
                        {components.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No components extracted. Add one manually.</p>
                        )}
                    </div>
                </div>

                {/* Integrations — structured review */}
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
                            <BlueprintNodeReviewCard
                                key={integ.id ?? `integ-${i}`}
                                kind="integration"
                                node={integ}
                                index={i}
                                qualityFlags={qualityFlags}
                                onUpdate={(idx, patch) => updateIntegration(idx, Object.keys(patch)[0] as keyof BlueprintIntegration, Object.values(patch)[0])}
                                onRemove={removeIntegration}
                                onApprove={(idx) => updateIntegration(idx, 'reviewStatus', 'approved')}
                                onReject={removeIntegration}
                            />
                        ))}
                        {integrations.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No integrations extracted.</p>
                        )}
                    </div>
                </div>

                {/* Data Domains — structured review */}
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
                            <BlueprintNodeReviewCard
                                key={dd.id ?? `dd-${i}`}
                                kind="data_domain"
                                node={dd}
                                index={i}
                                qualityFlags={qualityFlags}
                                onUpdate={(idx, patch) => updateDataDomain(idx, Object.keys(patch)[0] as keyof BlueprintDataDomain, Object.values(patch)[0])}
                                onRemove={removeDataDomain}
                                onApprove={(idx) => updateDataDomain(idx, 'reviewStatus', 'approved')}
                                onReject={removeDataDomain}
                            />
                        ))}
                        {dataDomains.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No data domains extracted.</p>
                        )}
                    </div>
                </div>

                {/* Relations — structured review */}
                {(relations.length > 0 || addingRelation) && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                                Relations ({relations.length})
                            </Label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAddingRelation(!addingRelation)}
                                className="h-7 text-xs"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Add Relation
                            </Button>
                        </div>
                        <div className="space-y-1.5">
                            {relations.map((rel, i) => {
                                const nodeLabels = new Map<string, string>();
                                components.forEach((c) => { if (c.id) nodeLabels.set(c.id, c.name); });
                                dataDomains.forEach((d) => { if (d.id) nodeLabels.set(d.id, d.name); });
                                integrations.forEach((ig) => { if (ig.id) nodeLabels.set(ig.id, ig.systemName); });
                                return (
                                    <BlueprintRelationReviewCard
                                        key={rel.id ?? `rel-${i}`}
                                        relation={rel}
                                        index={i}
                                        nodeLabels={nodeLabels}
                                        onUpdateType={(idx, type) => {
                                            setRelations((prev) =>
                                                prev.map((r, ri) => ri === idx ? { ...r, type } : r),
                                            );
                                        }}
                                        onRemove={(idx) => {
                                            setRelations((prev) => prev.filter((_, ri) => ri !== idx));
                                        }}
                                    />
                                );
                            })}
                            {addingRelation && (
                                <AddRelationInline
                                    availableNodes={[
                                        ...components.filter((c) => c.id).map((c) => ({ id: c.id!, label: c.name })),
                                        ...dataDomains.filter((d) => d.id).map((d) => ({ id: d.id!, label: d.name })),
                                        ...integrations.filter((ig) => ig.id).map((ig) => ({ id: ig.id!, label: ig.systemName })),
                                    ]}
                                    onAdd={(from, to, type) => {
                                        setRelations((prev) => [
                                            ...prev,
                                            { id: `rel_${Date.now()}`, fromNodeId: from, toNodeId: to, type },
                                        ]);
                                        setAddingRelation(false);
                                    }}
                                    onCancel={() => setAddingRelation(false)}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Approve all button */}
                {blueprintReviewStatus !== 'approved' && (
                    <div className="flex justify-center pt-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => {
                                setComponents((prev) => prev.map((c) => ({ ...c, reviewStatus: 'approved' as ReviewStatus })));
                                setIntegrations((prev) => prev.map((i) => ({ ...i, reviewStatus: 'approved' as ReviewStatus })));
                                setDataDomains((prev) => prev.map((d) => ({ ...d, reviewStatus: 'approved' as ReviewStatus })));
                                setBlueprintReviewStatus('approved');
                            }}
                        >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve All & Mark Blueprint Reviewed
                        </Button>
                    </div>
                )}

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
                                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                                            isDisabled
                                                ? 'bg-slate-50 border-slate-200 opacity-50'
                                                : 'bg-white border-slate-200 hover:border-teal-200 hover:shadow-sm'
                                        }`}
                                    >
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
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
                                                <span className="font-mono">{act.code}</span>
                                                {act.sourceActivityCode && <span>← {act.sourceActivityCode}</span>}
                                                {act.blueprintNodeName && <span className="text-teal-500">⚓ {act.blueprintNodeName}</span>}
                                                {act.confidence != null && (
                                                    <span title="Confidence AI">
                                                        {'●'.repeat(Math.round(act.confidence * 5))}{'○'.repeat(5 - Math.round(act.confidence * 5))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
                    <ArrowLeft className="w-4 h-4 mr-2" /> Edit Sources
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!draft?.name?.trim() || !draft?.technologyId}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Create Project
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Card sub-component
// ─────────────────────────────────────────────────────────────────────────────

function SourceCard({
    source,
    onRemove,
}: {
    source: ProjectSourceItem;
    onRemove: () => void;
}) {
    const icon = source.type === 'pasted_text'
        ? <ClipboardPaste className="w-4 h-4 text-slate-500" />
        : getFileIcon(source.fileName ?? '');

    return (
        <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${source.status === 'error'
            ? 'bg-red-50/50 border-red-200'
            : source.status === 'processing'
                ? 'bg-slate-50/50 border-slate-200 animate-pulse'
                : 'bg-white border-slate-200'
            }`}>
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">
                        {source.label}
                    </p>
                    <StatusBadge status={source.status} />
                    {source.sizeBytes && source.status !== 'error' && (
                        <span className="text-xs text-slate-400">
                            {formatFileSize(source.sizeBytes)}
                        </span>
                    )}
                </div>
                {source.status === 'error' && source.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{source.errorMessage}</p>
                )}
                {source.status === 'ready' && source.textContent && (
                    <p className="text-xs text-slate-400 mt-1 truncate">
                        {getSourcePreview(source.textContent, 120)}
                    </p>
                )}
                {source.status === 'ready' && source.parsedDocument && (
                    <p className="text-xs text-slate-400 mt-0.5">
                        {getBlockStats(source.parsedDocument)}
                    </p>
                )}
                {source.status === 'processing' && (
                    <p className="text-xs text-slate-400 mt-1">Extracting text…</p>
                )}
            </div>
            <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 shrink-0"
                onClick={onRemove}
            >
                <X className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}

function StatusBadge({ status }: { status: ProjectSourceItem['status'] }) {
    switch (status) {
        case 'ready':
            return (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                    Ready
                </Badge>
            );
        case 'processing':
            return (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Processing
                </Badge>
            );
        case 'error':
            return (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                    Error
                </Badge>
            );
    }
}

function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
        case 'pdf':
            return <FileText className="w-4 h-4 text-red-500" />;
        case 'docx':
            return <FileText className="w-4 h-4 text-blue-500" />;
        case 'md':
            return <FileCode className="w-4 h-4 text-slate-500" />;
        default:
            return <FileIcon className="w-4 h-4 text-slate-400" />;
    }
}

function deduplicateWarnings(warnings: DocumentParsingWarning[]): DocumentParsingWarning[] {
    const seen = new Set<string>();
    return warnings.filter((w) => {
        const key = `${w.code}:${w.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getBlockStats(doc: ParsedDocument): string {
    const counts: Record<string, number> = {};
    for (const b of doc.blocks) {
        counts[b.type] = (counts[b.type] || 0) + 1;
    }
    const parts: string[] = [];
    if (doc.metadata.pageCount) parts.push(`${doc.metadata.pageCount} pg`);
    parts.push(`${doc.blocks.length} blocks`);
    if (counts.heading) parts.push(`${counts.heading} headings`);
    if (counts.table) parts.push(`${counts.table} tables`);
    if (counts.list) parts.push(`${counts.list} lists`);
    if (doc.metadata.detectedImageCount > 0) parts.push(`${doc.metadata.detectedImageCount} img`);
    return parts.join(' · ');
}
