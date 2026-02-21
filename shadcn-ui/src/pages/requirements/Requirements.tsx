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
import { RequirementsFilters, type ViewMode } from '@/components/requirements/RequirementsFilters';
import { RequirementsStats } from '@/components/requirements/RequirementsStats';
import { RequirementsDashboardView } from '@/components/requirements/RequirementsDashboardView';
import { PriorityBadge, PRIORITY_CONFIGS } from '@/components/shared/RequirementBadges';
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
    const [viewMode, setViewMode] = useState<ViewMode>('list');

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
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onImport={() => setShowImportDialog(true)}
                    onClearAll={() => setShowClearDialog(true)}
                    requirementsCount={requirements.length}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto relative z-0">
                <div className="container mx-auto px-6 py-6">
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
                            {/* Stats Summary (Moved from Header) */}
                            <RequirementsStats
                                totalEstimation={totalEstimation}
                                estimatedCount={estimatedCount}
                                notEstimatedCount={notEstimatedCount}
                            />

                            {filteredRequirements.length === 0 ? (
                                <div className="max-w-4xl mx-auto">
                                    {requirements.length === 0 ? (
                                        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-8">
                                            <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-8">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm mb-4">
                                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-sm font-semibold text-slate-800 mb-1">Nessun Requisito</h3>
                                                <p className="text-xs text-slate-500 text-center max-w-xs mb-4">
                                                    Questo progetto è vuoto. Inizia aggiungendo il primo requisito.
                                                </p>
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
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-8">
                                            <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-6">
                                                <svg className="w-8 h-8 opacity-30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <h3 className="text-sm font-semibold text-slate-800 mb-1">Nessun Risultato</h3>
                                                <p className="text-xs text-slate-500 text-center mb-3">
                                                    Prova a modificare i filtri.
                                                </p>
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
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="max-w-7xl mx-auto">
                                    {/* Requirements List - Card style like Dashboard */}
                                    <div className="grid gap-3">
                                        {filteredRequirements.map((req, idx) => {
                                            const estimation = req.latest_estimation;
                                            const hasEstimation = !!estimation;
                                            const priorityConfig = PRIORITY_CONFIGS[req.priority as keyof typeof PRIORITY_CONFIGS] || PRIORITY_CONFIGS.MEDIUM;
                                            const isGeneratingTitle = req.labels?.includes('AI_TITLE_PENDING');

                                            // State colors for inline badge
                                            const stateColors: Record<string, { bg: string; text: string; dot: string }> = {
                                                PROPOSED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
                                                SELECTED: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
                                                SCHEDULED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
                                                DONE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                                            };
                                            const stateStyle = stateColors[req.state] || stateColors.PROPOSED;

                                            // Priority border colors
                                            const priorityBorders: Record<string, string> = {
                                                HIGH: 'border-t-red-500',
                                                MEDIUM: 'border-t-amber-500',
                                                LOW: 'border-t-emerald-500',
                                            };
                                            const priorityBorder = priorityBorders[req.priority] || 'border-t-slate-300';

                                            return (
                                                <div
                                                    key={req.id}
                                                    className={`group bg-white rounded-xl border border-slate-200 border-t-4 ${priorityBorder} shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden`}
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
                                                    <div className="p-4">
                                                        {/* Header row: ID + State badge + Actions */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                    {req.req_id}
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${stateStyle.bg} ${stateStyle.text}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${stateStyle.dot}`}></span>
                                                                    {req.state}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {hasEstimation && (
                                                                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                                                        {estimation.total_days.toFixed(1)} gg
                                                                    </span>
                                                                )}
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-lg">
                                                                        <DropdownMenuItem
                                                                            className="text-destructive focus:text-destructive"
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

                                                        {/* Title */}
                                                        {isGeneratingTitle ? (
                                                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                                <span className="text-sm">Generazione titolo...</span>
                                                            </div>
                                                        ) : (
                                                            <h3 className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors mb-2 line-clamp-2">
                                                                {req.title}
                                                            </h3>
                                                        )}

                                                        {/* Footer: metadata */}
                                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="text-sm">{priorityConfig.icon}</span>
                                                                <span className="capitalize">{req.priority.toLowerCase()}</span>
                                                            </span>
                                                            {req.business_owner && (
                                                                <>
                                                                    <span className="text-slate-300">|</span>
                                                                    <span className="truncate max-w-[150px]">{req.business_owner}</span>
                                                                </>
                                                            )}
                                                            <span className="text-slate-300">|</span>
                                                            <span>{new Date(req.updated_at).toLocaleDateString('it-IT')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
