import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
import { Header } from '@/components/layout/Header';
import { ListTechnologyDialog } from '@/components/lists/ListTechnologyDialog';
import { RequirementsHeader } from '@/components/requirements/RequirementsHeader';
import { RequirementsFilters } from '@/components/requirements/RequirementsFilters';
import { PriorityBadge, StateBadge, PRIORITY_CONFIGS } from '@/components/shared/RequirementBadges';
import { Plus, Upload, MoreVertical } from 'lucide-react';

export default function Requirements() {
    const navigate = useNavigate();
    const { listId } = useParams<{ listId: string }>();
    const { user } = useAuth();

    // Use custom hook for data management
    const {
        list,
        filteredRequirements,
        paginatedRequirements,
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
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        showingFrom,
        showingTo,
        totalEstimation,
        estimatedCount,
        notEstimatedCount,
        requirements,
        loadData,
    } = useRequirementsList({ listId, userId: user?.id });

    // Dialog state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showTechDialog, setShowTechDialog] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showBulkEstimate, setShowBulkEstimate] = useState(false);
    const [deleteRequirement, setDeleteRequirement] = useState<Requirement | null>(null);

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
        <div className="h-screen flex flex-col overflow-hidden bg-syntero-gradient">
            {/* Header */}
            <div className="flex-shrink-0">
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
                onSetTechnology={() => setShowTechDialog(true)}
                onBulkEstimate={() => setShowBulkEstimate(true)}
                onCreateRequirement={() => setShowCreateDialog(true)}
                onRetry={() => loadData()}
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
                    {filteredRequirements.length === 0 ? (
                        <div className="max-w-4xl mx-auto">
                            {requirements.length === 0 ? (
                                <Card className="border-slate-200 bg-white shadow-lg">
                                    <div className="p-12 text-center">
                                        <div className="max-w-md mx-auto space-y-6">
                                            <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border-2 border-slate-300/50">
                                                <svg className="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-bold text-slate-900">No Requirements Yet</h3>
                                                <p className="text-slate-600">
                                                    This project is empty. Start by adding your first requirement or import them from an Excel file.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                                                <Button
                                                    size="lg"
                                                    onClick={() => setShowCreateDialog(true)}
                                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                                >
                                                    <Plus className="mr-2 h-5 w-5" />
                                                    Create Requirement
                                                </Button>
                                                <Button
                                                    size="lg"
                                                    variant="outline"
                                                    onClick={() => setShowImportDialog(true)}
                                                    className="border-slate-300"
                                                >
                                                    <Upload className="mr-2 h-5 w-5" />
                                                    Import from Excel
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="border-slate-200 bg-white shadow-lg">
                                    <div className="p-12 text-center">
                                        <div className="max-w-md mx-auto space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-900">No Matching Requirements</h3>
                                            <p className="text-slate-600">
                                                Try adjusting your search filters or criteria to find what you're looking for.
                                            </p>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setFilterPriority('all');
                                                    setFilterState('all');
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto">
                            {/* Pagination Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
                                <div className="text-sm text-slate-600">
                                    Showing {showingFrom}-{showingTo} of {filteredRequirements.length} requirements
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Rows</span>
                                        <Select
                                            value={String(pageSize)}
                                            onValueChange={(value) => {
                                                setPageSize(Number(value));
                                                setPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="w-24 h-9 border-slate-300 bg-white/80">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                                                {[10, 20, 50].map((size) => (
                                                    <SelectItem key={size} value={String(size)}>
                                                        {size} / page
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage(page - 1 > 1 ? page - 1 : 1)}
                                        >
                                            Prev
                                        </Button>
                                        <span className="text-xs text-slate-600">
                                            Page {page} / {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage(page + 1 < totalPages ? page + 1 : totalPages)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Requirements Grid */}
                            <div className="grid gap-5">
                                {paginatedRequirements.map((req) => {
                                    const estimation = req.latest_estimation;
                                    const hasEstimation = !!estimation;
                                    const priorityConfig = PRIORITY_CONFIGS[req.priority as keyof typeof PRIORITY_CONFIGS] || PRIORITY_CONFIGS.MEDIUM;

                                    return (
                                        <Card
                                            key={req.id}
                                            className="group relative overflow-hidden border-slate-200/60 bg-white/90 backdrop-blur-md hover:bg-white hover:shadow-md transition-all duration-300 ease-out cursor-pointer"
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
                                            <div className="flex items-center p-3 gap-4">
                                                {/* Priority Indicator Strip */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${priorityConfig.gradient}`} />

                                                {/* ID & Priority Icon */}
                                                <div className="flex items-center gap-3 w-[100px] shrink-0 pl-2">
                                                    <span className="font-mono text-xs font-semibold text-slate-500">{req.req_id}</span>
                                                    <div className="text-xs" title={`Priority: ${req.priority}`}>
                                                        {priorityConfig.icon}
                                                    </div>
                                                </div>

                                                {/* Main Content: Title & State */}
                                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                                    <span
                                                        className="font-semibold text-sm text-slate-900 truncate group-hover:text-blue-700 transition-colors"
                                                        title={req.title}
                                                    >
                                                        {req.title}
                                                    </span>
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
                                                    <div className="flex items-center gap-1.5" title="Last Updated">
                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>{new Date(req.updated_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                {/* Estimation */}
                                                <div className="w-[80px] text-right shrink-0">
                                                    {hasEstimation ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-sm text-blue-600">{estimation.total_days.toFixed(1)}d</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="shrink-0">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                aria-label="More options"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteRequirement(req);
                                                                }}
                                                            >
                                                                Delete
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
                        onSuccess={loadData}
                    />
                    <ImportRequirementsDialog
                        open={showImportDialog}
                        onOpenChange={setShowImportDialog}
                        listId={listId}
                        onSuccess={loadData}
                    />
                    <ListTechnologyDialog
                        list={list}
                        open={showTechDialog}
                        onOpenChange={setShowTechDialog}
                        onSuccess={loadData}
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
