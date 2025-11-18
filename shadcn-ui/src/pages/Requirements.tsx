import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PRIORITY_VARIANTS, STATE_VARIANTS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, Search, FileText, Upload, Trash2, MoreVertical, Zap, ArrowUpDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Requirement, List, RequirementWithEstimation, Estimation } from '@/types/database';
import { CreateRequirementDialog } from '@/components/requirements/CreateRequirementDialog';
import { ImportRequirementsDialog } from '@/components/requirements/ImportRequirementsDialog';
import { ClearListDialog } from '@/components/lists/ClearListDialog';
import { DeleteRequirementDialog } from '@/components/requirements/DeleteRequirementDialog';
import { BulkEstimateDialog } from '@/components/requirements/BulkEstimateDialog';

export default function Requirements() {
    const navigate = useNavigate();
    const { listId } = useParams<{ listId: string }>();
    const { user } = useAuth();
    const { toast } = useToast();
    const [list, setList] = useState<List | null>(null);
    const [requirements, setRequirements] = useState<RequirementWithEstimation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterState, setFilterState] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('updated-desc');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showBulkEstimate, setShowBulkEstimate] = useState(false);
    const [deleteRequirement, setDeleteRequirement] = useState<Requirement | null>(null);

    const loadData = useCallback(async () => {
        if (!user || !listId) return;

        let isMounted = true;

        try {
            // Load list details
            const { data: listData, error: listError } = await supabase
                .from('lists')
                .select('*')
                .eq('id', listId)
                .eq('user_id', user.id)
                .single();

            if (listError) {
                console.error('Error loading list:', listError);
                toast({
                    title: 'Error',
                    description: 'Failed to load project details',
                    variant: 'destructive',
                });
                navigate('/lists');
                return;
            }

            if (!isMounted) return;
            setList(listData);

            // Load requirements with their latest estimation
            const { data: reqData, error: reqError } = await supabase
                .from('requirements')
                .select(`
                    *,
                    estimations(
                        id,
                        total_days,
                        created_at
                    )
                `)
                .eq('list_id', listId)
                .order('created_at', { ascending: false });

            if (reqError) {
                console.error('Error loading requirements:', reqError);
                if (isMounted) {
                    toast({
                        title: 'Error',
                        description: 'Failed to load requirements',
                        variant: 'destructive',
                    });
                }
            } else if (isMounted) {
                // Transform data to include latest estimation
                const requirementsWithEstimation = (reqData || []).map((req: Requirement & { estimations?: Estimation[] }) => {
                    const sortedEstimations = (req.estimations || []).sort(
                        (a: Estimation, b: Estimation) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                    return {
                        ...req,
                        latest_estimation: sortedEstimations[0] || null,
                        estimations: undefined, // Remove nested array
                    };
                });
                setRequirements(requirementsWithEstimation);
            }
        } catch (error) {
            console.error('Unexpected error loading data:', error);
            if (isMounted) {
                toast({
                    title: 'Error',
                    description: 'An unexpected error occurred',
                    variant: 'destructive',
                });
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }

        return () => {
            isMounted = false;
        };
    }, [user, listId, navigate, toast]);

    useEffect(() => {
        if (user && listId) {
            loadData();
        }
    }, [user, listId, loadData]);

    const filteredRequirements = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();

        // Filter
        let filtered = requirements.filter((req) => {
            const matchesSearch = !searchTerm ||
                req.title.toLowerCase().includes(lowerSearchTerm) ||
                req.req_id.toLowerCase().includes(lowerSearchTerm) ||
                req.description.toLowerCase().includes(lowerSearchTerm);
            const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
            const matchesState = filterState === 'all' || req.state === filterState;
            return matchesSearch && matchesPriority && matchesState;
        });

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                case 'priority-asc': {
                    const priorityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
                    return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
                }
                case 'priority-desc': {
                    const priorityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
                    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
                }
                case 'estimation-asc':
                    return (a.latest_estimation?.total_days || 0) - (b.latest_estimation?.total_days || 0);
                case 'estimation-desc':
                    return (b.latest_estimation?.total_days || 0) - (a.latest_estimation?.total_days || 0);
                case 'state-asc':
                    return a.state.localeCompare(b.state);
                case 'state-desc':
                    return b.state.localeCompare(a.state);
                case 'created-asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'created-desc':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'updated-asc':
                    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                case 'updated-desc':
                default:
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
        });

        return sorted;
    }, [requirements, searchTerm, filterPriority, filterState, sortBy]);

    const getPriorityBadge = (priority: string) => {
        return (
            <Badge variant={PRIORITY_VARIANTS[priority as keyof typeof PRIORITY_VARIANTS] || 'secondary'}>
                {priority}
            </Badge>
        );
    };

    const getStateBadge = (state: string) => {
        return (
            <Badge variant={STATE_VARIANTS[state as keyof typeof STATE_VARIANTS] || 'outline'}>
                {state}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Calculate total estimation
    const totalEstimation = filteredRequirements.reduce((sum, req) => {
        return sum + (req.latest_estimation?.total_days || 0);
    }, 0);

    const estimatedCount = filteredRequirements.filter((req) => req.latest_estimation).length;
    const notEstimatedCount = filteredRequirements.length - estimatedCount;

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSkgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none"></div>

            {/* Fixed Header */}
            <header className="relative z-10 border-b border-white/20 bg-white/80 backdrop-blur-lg flex-none shadow-lg">
                <div className="container mx-auto px-6 py-4">
                    {/* Top Row: Navigation + Title + Summary */}
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/lists')}
                            className="hover:bg-white/60 transition-all duration-300"
                            aria-label="Back to projects"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent truncate">
                                {list?.name}
                            </h1>
                            {list?.description && (
                                <p className="text-xs text-slate-600 mt-0.5 truncate">{list.description}</p>
                            )}
                        </div>

                        {/* Summary Card */}
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 shadow-md backdrop-blur-sm">
                            <div className="text-center">
                                <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    {totalEstimation.toFixed(1)}
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium uppercase tracking-wide">days</div>
                            </div>
                            <div className="h-8 w-px bg-blue-200/50"></div>
                            <div className="text-left">
                                <div className="text-xs text-slate-600 font-medium">
                                    <span className="text-blue-600 font-semibold">{estimatedCount}</span> estimated
                                </div>
                                <div className="text-xs text-slate-600 font-medium">
                                    <span className="text-slate-700 font-semibold">{notEstimatedCount}</span> pending
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Actions + Filters */}
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm shadow-sm"
                            />
                        </div>

                        {/* Filters */}
                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                            <SelectTrigger className="w-32 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="HIGH">High</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="LOW">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterState} onValueChange={setFilterState}>
                            <SelectTrigger className="w-32 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                                <SelectValue placeholder="State" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="PROPOSED">Proposed</SelectItem>
                                <SelectItem value="SELECTED">Selected</SelectItem>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="DONE">Done</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Sort */}
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-40 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                                <SelectItem value="updated-desc">Most Recent</SelectItem>
                                <SelectItem value="updated-asc">Oldest</SelectItem>
                                <SelectItem value="title-asc">Title A→Z</SelectItem>
                                <SelectItem value="title-desc">Title Z→A</SelectItem>
                                <SelectItem value="priority-desc">Priority High→Low</SelectItem>
                                <SelectItem value="priority-asc">Priority Low→High</SelectItem>
                                <SelectItem value="estimation-desc">Estimation High→Low</SelectItem>
                                <SelectItem value="estimation-asc">Estimation Low→High</SelectItem>
                                <SelectItem value="state-asc">State A→Z</SelectItem>
                                <SelectItem value="state-desc">State Z→A</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Divider */}
                        <div className="h-6 w-px bg-slate-300"></div>

                        {/* Action Buttons */}
                        <Button
                            size="sm"
                            onClick={() => setShowBulkEstimate(true)}
                            disabled={filteredRequirements.length === 0}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-10 font-semibold"
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Estimate All
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowImportDialog(true)}
                            className="hover:bg-white/60 h-10"
                        >
                            <Upload className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="hover:bg-white/60 h-10"
                                    aria-label="More options"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-md border-slate-200/50">
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => setShowClearDialog(true)}
                                    disabled={requirements.length === 0}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold h-10"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New
                        </Button>
                    </div>
                </div>
            </header>

            {/* Scrollable Content Area */}
            <div className="relative z-0 flex-1 overflow-hidden">
                <div className="container mx-auto px-6 h-full">
                    {filteredRequirements.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <Card className="max-w-md border-slate-200/50 bg-white/80 backdrop-blur-lg shadow-2xl animate-in fade-in duration-500">
                                <CardContent className="flex flex-col items-center py-12 px-8">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6 shadow-lg">
                                        <FileText className="h-10 w-10 text-blue-600" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-slate-900">
                                        {requirements.length === 0 ? 'No requirements yet' : 'No matching requirements'}
                                    </h3>
                                    <p className="text-slate-600 text-center mb-6">
                                        {requirements.length === 0
                                            ? 'Create your first requirement to start estimating'
                                            : 'Try adjusting your filters or search term'}
                                    </p>
                                    {requirements.length === 0 && (
                                        <Button
                                            onClick={() => setShowCreateDialog(true)}
                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Requirement
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto py-6">
                            <div className="grid gap-4 pb-6">
                                {filteredRequirements.map((req) => {
                                    const estimation = req.latest_estimation;
                                    const hasEstimation = !!estimation;

                                    return (
                                        <Card
                                            key={req.id}
                                            className="group border-slate-200/50 bg-white/80 backdrop-blur-md hover:bg-white/95 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
                                            onClick={() => navigate(`/lists/${listId}/requirements/${req.id}`)}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`View requirement ${req.req_id}: ${req.title}`}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/lists/${listId}/requirements/${req.id}`);
                                                }
                                            }}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => navigate(`/lists/${listId}/requirements/${req.id}`)}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono text-xs text-muted-foreground">{req.req_id}</span>
                                                            {getPriorityBadge(req.priority)}
                                                            {getStateBadge(req.state)}
                                                        </div>
                                                        <h3
                                                            className="font-semibold text-base truncate"
                                                            title={req.title}
                                                        >
                                                            {req.title}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                            {req.description || 'No description'}
                                                        </p>
                                                        <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                                            {req.business_owner && (
                                                                <span>Owner: <span className="font-medium">{req.business_owner}</span></span>
                                                            )}
                                                            {req.labels && req.labels.length > 0 && (
                                                                <span>Labels: {req.labels.length}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {hasEstimation ? (
                                                            <div className="text-right bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 px-3 py-2 rounded-lg shadow-sm">
                                                                <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                                    {estimation.total_days.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">days</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-right bg-slate-100/80 border border-slate-200/50 px-3 py-2 rounded-lg shadow-sm">
                                                                <div className="text-sm font-medium text-slate-600">Not</div>
                                                                <div className="text-xs text-muted-foreground">estimated</div>
                                                            </div>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    aria-label={`Options for requirement ${req.title}`}
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteRequirement(req);
                                                                    }}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div >

            <CreateRequirementDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                listId={listId!}
                onSuccess={loadData}
            />

            <ImportRequirementsDialog
                open={showImportDialog}
                onOpenChange={setShowImportDialog}
                listId={listId!}
                onSuccess={loadData}
            />

            <ClearListDialog
                open={showClearDialog}
                onOpenChange={setShowClearDialog}
                listId={listId!}
                listName={list?.name || ''}
                requirementCount={requirements.length}
                onSuccess={loadData}
            />

            {
                deleteRequirement && (
                    <DeleteRequirementDialog
                        open={!!deleteRequirement}
                        onOpenChange={(open) => !open && setDeleteRequirement(null)}
                        requirementId={deleteRequirement.id}
                        requirementTitle={deleteRequirement.title}
                        onSuccess={() => {
                            setDeleteRequirement(null);
                            loadData();
                        }}
                    />
                )
            }

            <BulkEstimateDialog
                open={showBulkEstimate}
                onOpenChange={setShowBulkEstimate}
                requirements={filteredRequirements}
                listId={listId!}
                listTechPresetId={list?.tech_preset_id || null}
                onSuccess={loadData}
            />
        </div >
    );
}
