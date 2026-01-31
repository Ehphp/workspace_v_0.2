import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRequirementsList } from '@/hooks/useRequirementsList';
import type { Requirement } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateRequirementDialog } from '@/components/requirements/CreateRequirementDialog';
import { ImportRequirementsDialog } from '@/components/requirements/ImportRequirementsDialog';
import { ClearListDialog } from '@/components/lists/ClearListDialog';
import { DeleteRequirementDialog } from '@/components/requirements/DeleteRequirementDialog';
import { BulkEstimateDialog } from '@/components/requirements/BulkEstimateDialog';
import { BulkInterviewDialog } from '@/components/requirements/BulkInterviewDialog';
import { EditListDialog } from '@/components/lists/EditListDialog';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { RequirementsHeader } from '@/components/requirements/RequirementsHeader';
import { RequirementsFilters } from '@/components/requirements/RequirementsFilters';
import { RequirementsStats } from '@/components/requirements/RequirementsStats';
import { PriorityBadge, StateBadge, PRIORITY_CONFIGS } from '@/components/shared/RequirementBadges';
import { Plus, Upload, MoreVertical, Loader2, Sparkles } from 'lucide-react';
import { generateTitleFromDescription } from '@/lib/openai';
import { supabase } from '@/lib/supabase';

import { motion } from 'framer-motion';

export default function Requirements() {
    const navigate = useNavigate();
    const { listId } = useParams<{ listId: string }>();
    const { user } = useAuth();
    const { toast } = useToast();
    const { userRole } = useAuthStore();
    const canManage = userRole === 'admin' || userRole === 'editor';

    // Use custom hook for data management
    const {
        list,
        filteredRequirements,
        loading,
        errorMessage,
        searchTerm,
        setSearchTerm,
        filterPriority,
        setFilterPriority,
        filterState,
        setFilterState,
        sortBy,
        setSortBy,
        totalEstimation,
        estimatedCount,
        notEstimatedCount,
        requirements,
        loadData,
        updateRequirement,
        addRequirement,
    } = useRequirementsList({ listId, userId: user?.id });

    // Track processing items to avoid race conditions
    const processingRef = useRef<Set<string>>(new Set());

    // Background Title Generation
    useEffect(() => {
        if (!requirements || requirements.length === 0) return;

        const pendingTitles = requirements.filter(r =>
            r.labels && r.labels.includes('AI_TITLE_PENDING') && !processingRef.current.has(r.id)
        );

        if (pendingTitles.length === 0) return;

        console.log(`Found ${pendingTitles.length} new requirements pending title generation`);

        // Mark as processing immediately
        pendingTitles.forEach(req => processingRef.current.add(req.id));

        const processQueue = async () => {
            // Process one by one to avoid rate limits
            for (const req of pendingTitles) {
                try {
                    if (!req.description) {
                        processingRef.current.delete(req.id);
                        continue;
                    }

                    console.log(`Generating title for ${req.req_id}...`);
                    const newTitle = await generateTitleFromDescription(req.description);

                    // Update DB
                    const newLabels = (req.labels || []).filter(l => l !== 'AI_TITLE_PENDING');

                    const { error } = await supabase
                        .from('requirements')
                        .update({
                            title: newTitle,
                            labels: newLabels
                        })
                        .eq('id', req.id);

                    if (!error) {
                        console.log(`Updated title for ${req.req_id}: ${newTitle}`);
                        // Update local state immediately to show the new title
                        updateRequirement(req.id, {
                            title: newTitle,
                            labels: newLabels
                        });
                    }
                } catch (err) {
                    console.error(`Failed to generate title for ${req.req_id}`, err);
                } finally {
                    processingRef.current.delete(req.id);
                }
            }
        };

        processQueue();
    }, [requirements, updateRequirement]); // Dependency on requirements list

    // Dialog state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showListEditDialog, setShowListEditDialog] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showBulkEstimate, setShowBulkEstimate] = useState(false);
    const [showBulkInterview, setShowBulkInterview] = useState(false);
    const [deleteRequirement, setDeleteRequirement] = useState<Requirement | null>(null);
    const [listTechCategory, setListTechCategory] = useState<string>('MULTI');

    // Fetch tech_category from preset when list changes
    useEffect(() => {
        async function fetchTechCategory() {
            if (list?.tech_preset_id) {
                const { data: preset } = await supabase
                    .from('technology_presets')
                    .select('tech_category')
                    .eq('id', list.tech_preset_id)
                    .single();
                if (preset?.tech_category) {
                    setListTechCategory(preset.tech_category);
                }
            } else {
                setListTechCategory('MULTI');
            }
        }
        fetchTechCategory();
    }, [list?.tech_preset_id]);

    const handleImportRequirements = async (parsedRequirements: any[]) => {
        if (!user || !listId) return;

        toast({
            title: "Import started",
            description: `Importing ${parsedRequirements.length} requirements...`,
        });

        // Check for existing req_ids in this list
        const reqIds = parsedRequirements.map(r => r.req_id);
        const { data: existingReqs } = await supabase
            .from('requirements')
            .select('req_id')
            .eq('list_id', listId)
            .in('req_id', reqIds);

        const existingReqIds = new Set(existingReqs?.map(r => r.req_id) || []);
        let importedCount = 0;

        // Process in background
        for (const req of parsedRequirements) {
            if (existingReqIds.has(req.req_id)) continue;

            try {
                let title = req.title;
                let labels: string[] = [];

                // Check if title needs AI generation:
                // 1. Missing or empty
                // 2. Identical to description (user mapped description to title)
                // 3. Too long (> 100 chars) - likely a raw description
                const isTitleInvalid = !title ||
                    title.trim() === '' ||
                    (req.description && title.trim() === req.description.trim()) ||
                    (title && title.length > 100);

                if (isTitleInvalid) {
                    // Only mark for AI if we have a description to generate from
                    if (req.description && req.description.trim() !== '') {
                        labels.push('AI_TITLE_PENDING');

                        // If title is completely missing, use ID as placeholder
                        if (!title || title.trim() === '') {
                            title = req.req_id;
                        }
                        // If title is long/description, we keep it in DB as fallback, 
                        // but UI will show "Generating..." due to the label.
                    } else if (!title || title.trim() === '') {
                        // No description to generate from, just use ID
                        title = req.req_id;
                    }
                }

                const { data, error } = await supabase.from('requirements').insert({
                    list_id: listId,
                    req_id: req.req_id,
                    title: title,
                    description: req.description,
                    priority: req.priority,
                    state: req.state,
                    business_owner: req.business_owner,
                    tech_preset_id: null,
                    labels: labels,
                }).select().single();

                if (!error && data) {
                    // Add to local list immediately
                    addRequirement({
                        ...data,
                        latest_estimation: null
                    });
                    importedCount++;
                }
            } catch (err) {
                console.error('Error importing requirement:', err);
            }
        }

        if (importedCount > 0) {
            toast({
                title: "Import complete",
                description: `Successfully imported ${importedCount} requirements.`,
            });
        } else {
            toast({
                title: "Import complete",
                description: "No new requirements were imported (duplicates skipped).",
            });
        }
    };

    // Scrolling support for horizontal drag
    const requirementsScrollRef = useRef<HTMLDivElement>(null);
    const requirementsDraggingRef = useRef(false);
    const requirementsDragStartXRef = useRef(0);
    const requirementsDragStartScrollRef = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!requirementsDraggingRef.current || !requirementsScrollRef.current) return;
            e.preventDefault();
            const delta = e.clientX - requirementsDragStartXRef.current;
            requirementsScrollRef.current.scrollLeft = requirementsDragStartScrollRef.current - delta;
        };

        const handleMouseUp = () => {
            requirementsDraggingRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleRequirementsDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || !requirementsScrollRef.current) return;
        requirementsDraggingRef.current = true;
        requirementsDragStartXRef.current = e.clientX;
        requirementsDragStartScrollRef.current = requirementsScrollRef.current.scrollLeft;
    };

    const isEmpty = !loading && filteredRequirements.length === 0;

    // Skeleton loading cards
    const skeletonCards = Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`skeleton-${idx}`} className="border-slate-200/60 bg-white/80">
            <div className="flex items-center p-3 gap-4 animate-pulse">
                <div className="h-5 w-16 rounded bg-slate-200/80"></div>
                <div className="flex-1 h-5 rounded bg-slate-200/80"></div>
                <div className="h-5 w-20 rounded bg-slate-200/80"></div>
            </div>
        </Card>
    ));

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Animated Background Blobs */}
            <motion.div
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, -100, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-20 w-[30rem] h-[30rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, 100, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-0 left-1/3 w-[25rem] h-[25rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />

            {/* Header */}
            <div className="flex-shrink-0 z-20 relative">
                <Header />
            </div>

            {/* Page Header with Stats */}
            <RequirementsHeader
                list={list}
                totalEstimation={totalEstimation}
                estimatedCount={estimatedCount}
                notEstimatedCount={notEstimatedCount}
                errorMessage={errorMessage}
                filteredRequirementsCount={filteredRequirements.length}
                onBulkEstimate={() => setShowBulkEstimate(true)}
                onBulkInterview={() => setShowBulkInterview(true)}
                onCreateRequirement={() => setShowCreateDialog(true)}
                onRetry={() => loadData()}
                onEditList={() => setShowListEditDialog(true)}
            />

            {/* Filters Bar */}
            {requirements.length > 0 && (
                <RequirementsFilters
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterPriority={filterPriority}
                    onPriorityChange={setFilterPriority}
                    filterState={filterState}
                    onStateChange={setFilterState}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onImport={() => setShowImportDialog(true)}
                    onClearAll={() => setShowClearDialog(true)}
                    requirementsCount={requirements.length}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto relative z-0">
                <div className="container mx-auto px-6 py-6">
                    {/* Stats Summary (Moved from Header) */}
                    <RequirementsStats
                        totalEstimation={totalEstimation}
                        estimatedCount={estimatedCount}
                        notEstimatedCount={notEstimatedCount}
                    />

                    {filteredRequirements.length === 0 ? (
                        <div className="max-w-4xl mx-auto">
                            {requirements.length === 0 ? (
                                <Card className="border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl">
                                    <div className="p-12 text-center">
                                        <div className="max-w-md mx-auto space-y-6">
                                            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                                <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-bold text-slate-900">Nessun Requisito</h3>
                                                <p className="text-slate-500">
                                                    Questo progetto è vuoto. Inizia aggiungendo il primo requisito o importali da un file Excel.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                                                <Button
                                                    size="lg"
                                                    onClick={() => setShowCreateDialog(true)}
                                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 rounded-xl"
                                                >
                                                    <Plus className="mr-2 h-5 w-5" />
                                                    Crea Requisito
                                                </Button>
                                                <Button
                                                    size="lg"
                                                    variant="outline"
                                                    onClick={() => setShowImportDialog(true)}
                                                    className="border-slate-200 rounded-xl hover:bg-slate-50"
                                                >
                                                    <Upload className="mr-2 h-5 w-5" />
                                                    Importa da Excel
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl">
                                    <div className="p-12 text-center">
                                        <div className="max-w-md mx-auto space-y-6">
                                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900">Nessun Requisito Trovato</h3>
                                            <p className="text-slate-500">
                                                Prova a modificare i filtri di ricerca per trovare quello che stai cercando.
                                            </p>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setFilterPriority('all');
                                                    setFilterState('all');
                                                }}
                                                className="rounded-xl"
                                            >
                                                Resetta Filtri
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto">
                            {/* Requirements Grid */}
                            <div className="grid gap-4">
                                {filteredRequirements.map((req) => {
                                    const estimation = req.latest_estimation;
                                    const hasEstimation = !!estimation;
                                    const priorityConfig = PRIORITY_CONFIGS[req.priority as keyof typeof PRIORITY_CONFIGS] || PRIORITY_CONFIGS.MEDIUM;
                                    const isGeneratingTitle = req.labels?.includes('AI_TITLE_PENDING');

                                    return (
                                        <Card
                                            key={req.id}
                                            className="group relative overflow-hidden border-slate-200/50 bg-gradient-to-r from-white/90 to-white/80 backdrop-blur-xl hover:from-white hover:to-blue-50/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer rounded-2xl"
                                            onClick={() => navigate(`/dashboard/${listId}/requirements/${req.id}`)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/dashboard/${listId}/requirements/${req.id}`);
                                                }
                                            }}
                                        >
                                            {/* Status Bar on Top */}
                                            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${priorityConfig.gradient}`} />

                                            <div className="flex items-center p-4 gap-4">
                                                {/* ID & Priority Icon */}
                                                <div className="flex items-center gap-3 w-[100px] shrink-0">
                                                    <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{req.req_id}</span>
                                                    <div className="text-xs" title={`Priorità: ${req.priority}`}>
                                                        {priorityConfig.icon}
                                                    </div>
                                                </div>

                                                {/* Main Content: Title & State */}
                                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                                    {isGeneratingTitle ? (
                                                        <div className="flex items-center gap-2 text-slate-500 italic">
                                                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                            <span className="text-sm">Generazione titolo in corso...</span>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="font-semibold text-sm text-slate-900 truncate group-hover:text-blue-700 transition-colors"
                                                            title={req.title}
                                                        >
                                                            {req.title}
                                                        </span>
                                                    )}
                                                    <div className="scale-90 origin-left shrink-0">
                                                        <StateBadge state={req.state} />
                                                    </div>
                                                </div>

                                                {/* Metadata */}
                                                <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 shrink-0">
                                                    {req.business_owner && (
                                                        <div className="flex items-center gap-1.5" title="Business Owner">
                                                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <span className="font-medium text-slate-700 max-w-[100px] truncate">{req.business_owner}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5" title="Ultimo Aggiornamento">
                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>{new Date(req.updated_at).toLocaleDateString('it-IT')}</span>
                                                    </div>
                                                </div>

                                                {/* Estimation */}
                                                <div className="w-[90px] text-right shrink-0">
                                                    {hasEstimation ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-sm text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{estimation.total_days.toFixed(1)} gg</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">Non stimato</span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="shrink-0">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-slate-100"
                                                                aria-label="Altre opzioni"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-xl">
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive rounded-lg"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteRequirement(req);
                                                                }}
                                                            >
                                                                Elimina
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dialogs */}
            {listId && (
                <>
                    <CreateRequirementDialog
                        open={showCreateDialog}
                        onOpenChange={setShowCreateDialog}
                        listId={listId}
                        list={list || undefined}
                        onSuccess={loadData}
                    />
                    <ImportRequirementsDialog
                        open={showImportDialog}
                        onOpenChange={setShowImportDialog}
                        listId={listId}
                        onImport={handleImportRequirements}
                    />
                    <ClearListDialog
                        open={showClearDialog}
                        onOpenChange={setShowClearDialog}
                        listId={listId}
                        listName={list?.name || ''}
                        onSuccess={loadData}
                    />
                    <BulkEstimateDialog
                        open={showBulkEstimate}
                        onOpenChange={setShowBulkEstimate}
                        listId={listId}
                        requirements={filteredRequirements}
                        listTechPresetId={list?.tech_preset_id}
                        onSuccess={loadData}
                    />
                    <BulkInterviewDialog
                        open={showBulkInterview}
                        onOpenChange={setShowBulkInterview}
                        listId={listId}
                        requirements={filteredRequirements}
                        listTechPresetId={list?.tech_preset_id}
                        techCategory={listTechCategory}
                        onSuccess={loadData}
                    />
                    <EditListDialog
                        open={showListEditDialog}
                        onOpenChange={setShowListEditDialog}
                        list={list}
                        onSuccess={() => {
                            setShowListEditDialog(false);
                            loadData();
                        }}
                    />
                </>
            )}
            {deleteRequirement && (
                <DeleteRequirementDialog
                    open={!!deleteRequirement}
                    onOpenChange={(open) => !open && setDeleteRequirement(null)}
                    requirementId={deleteRequirement.id}
                    onSuccess={loadData}
                />
            )}
        </div>
    );
}
