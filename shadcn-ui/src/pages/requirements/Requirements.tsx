import type React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRequirementsList } from '@/hooks/useRequirementsList';
import type { Requirement } from '@/types/database';
import { Button } from '@/components/ui/button';
import { CreateRequirementDialog } from '@/components/requirements/CreateRequirementDialog';
import { ImportRequirementsDialog } from '@/components/requirements/ImportRequirementsDialog';
import { ClearListDialog } from '@/components/lists/ClearListDialog';
import { DeleteRequirementDialog } from '@/components/requirements/DeleteRequirementDialog';
import { BulkEstimateDialog } from '@/components/requirements/BulkEstimateDialog';
import { BulkInterviewDialog } from '@/components/requirements/BulkInterviewDialog';
import { EditListDialog } from '@/components/lists/EditListDialog';
import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/store/useAuthStore';
import { RequirementsHeader } from '@/components/requirements/RequirementsHeader';
import { RequirementsFilters, type ViewMode } from '@/components/requirements/RequirementsFilters';
import { RequirementsKpiGrid } from '@/components/requirements/RequirementsKpiGrid';
import { RequirementsInsightPanel } from '@/components/requirements/RequirementsInsightPanel';
import { RequirementsDashboardView } from '@/components/requirements/RequirementsDashboardView';
import { RequirementRow } from '@/components/requirements/RequirementRow';
import { Plus, Upload, Loader2, FileText, Search } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { generateTitleFromDescription } from '@/lib/openai';
import { supabase } from '@/lib/supabase';

import { motion } from 'framer-motion';

export default function Requirements() {
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
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Fetch technology code from technology when list changes
    useEffect(() => {
        async function fetchTechCategory() {
            const techId = list?.technology_id || list?.tech_preset_id;
            if (techId) {
                const { data: preset } = await supabase
                    .from('technologies')
                    .select('code')
                    .eq('id', techId)
                    .single();
                if (preset?.code) {
                    setListTechCategory(preset.code);
                }
            } else {
                setListTechCategory('MULTI');
            }
        }
        fetchTechCategory();
    }, [list?.technology_id, list?.tech_preset_id]);

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

    // Derived stats for KPI grid
    const highPriorityCount = useMemo(() => requirements.filter(r => r.priority === 'HIGH').length, [requirements]);
    const highPriorityUnestimated = useMemo(() => requirements.filter(r => r.priority === 'HIGH' && !r.latest_estimation).length, [requirements]);
    const avgRiskScore = useMemo(() => {
        const estimated = requirements.filter(r => r.latest_estimation);
        if (estimated.length === 0) return null;
        const sum = estimated.reduce((acc, r) => acc + (r.latest_estimation?.risk_score || 0), 0);
        return sum / estimated.length;
    }, [requirements]);

    // Skeleton loading cards
    const skeletonCards = Array.from({ length: 3 }).map((_, idx) => (
        <div key={`skeleton-${idx}`} className="border border-slate-200/60 rounded-xl bg-white/80">
            <div className="flex items-center p-3 gap-4 animate-pulse">
                <div className="h-5 w-16 rounded bg-slate-200/80"></div>
                <div className="flex-1 h-5 rounded bg-slate-200/80"></div>
                <div className="h-5 w-20 rounded bg-slate-200/80"></div>
            </div>
        </div>
    ));

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <PageShell
            fullHeight
            background="gradient"
            noContainer
            headerClassName="z-20 relative"
            className="relative"
            contentClassName="flex flex-col overflow-hidden"
            backgroundSlot={
                <>
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
                </>
            }
        >

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
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onImport={() => setShowImportDialog(true)}
                    onClearAll={() => setShowClearDialog(true)}
                    requirementsCount={requirements.length}
                />
            )}

            {/* Main Content */}
            <div className={`flex-1 relative z-0 ${viewMode === 'dashboard' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                <div className={`container mx-auto px-6 ${viewMode === 'dashboard' ? 'py-2 h-full' : 'py-6'}`}>
                    {/* Dashboard View */}
                    {viewMode === 'dashboard' && requirements.length > 0 ? (
                        <RequirementsDashboardView
                            requirements={filteredRequirements}
                            listId={listId || ''}
                            totalEstimation={totalEstimation}
                            estimatedCount={estimatedCount}
                            notEstimatedCount={notEstimatedCount}
                        />
                    ) : (
                        <>
                            {/* KPI Grid */}
                            <RequirementsKpiGrid
                                totalEstimation={totalEstimation}
                                estimatedCount={estimatedCount}
                                notEstimatedCount={notEstimatedCount}
                                highPriorityCount={highPriorityCount}
                                highPriorityUnestimated={highPriorityUnestimated}
                                avgRiskScore={avgRiskScore}
                            />

                            {/* Insight / Alert Panel */}
                            <RequirementsInsightPanel requirements={requirements} />

                            {filteredRequirements.length === 0 ? (
                                <div className="max-w-4xl mx-auto">
                                    {requirements.length === 0 ? (
                                        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-8">
                                            <EmptyState
                                                icon={FileText}
                                                title="Nessun Requisito"
                                                description="Questo progetto è vuoto. Inizia aggiungendo il primo requisito."
                                                action={
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setShowCreateDialog(true)}
                                                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                                        >
                                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                            Crea
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setShowImportDialog(true)}
                                                            className="h-7 text-xs border-slate-200"
                                                        >
                                                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                                                            Importa
                                                        </Button>
                                                    </div>
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-8">
                                            <EmptyState
                                                icon={Search}
                                                title="Nessun Risultato"
                                                description="Prova a modificare i filtri."
                                                className="p-6"
                                                action={
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSearchTerm('');
                                                            setFilterPriority('all');
                                                            setFilterState('all');
                                                        }}
                                                        className="h-7 text-xs"
                                                    >
                                                        Resetta Filtri
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="max-w-7xl mx-auto">
                                    {/* Requirements List - Compact rows */}
                                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                                        {filteredRequirements.map((req) => (
                                            <RequirementRow
                                                key={req.id}
                                                req={req}
                                                listId={listId || ''}
                                                onDelete={setDeleteRequirement}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
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
                        listTechPresetId={list?.technology_id || list?.tech_preset_id}
                        onSuccess={loadData}
                    />
                    <BulkInterviewDialog
                        open={showBulkInterview}
                        onOpenChange={setShowBulkInterview}
                        listId={listId}
                        requirements={filteredRequirements}
                        listTechPresetId={list?.technology_id || list?.tech_preset_id}
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
        </PageShell>
    );
}
