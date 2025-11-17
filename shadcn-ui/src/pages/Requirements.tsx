import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, Search, FileText, Upload, Trash2, MoreVertical, Zap } from 'lucide-react';
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
    const [list, setList] = useState<List | null>(null);
    const [requirements, setRequirements] = useState<RequirementWithEstimation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterState, setFilterState] = useState<string>('all');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showBulkEstimate, setShowBulkEstimate] = useState(false);
    const [deleteRequirement, setDeleteRequirement] = useState<Requirement | null>(null);

    useEffect(() => {
        if (user && listId) {
            loadData();
        }
    }, [user, listId]);

    const loadData = async () => {
        if (!user || !listId) return;

        // Load list details
        const { data: listData, error: listError } = await supabase
            .from('lists')
            .select('*')
            .eq('id', listId)
            .eq('user_id', user.id)
            .single();

        if (listError) {
            console.error('Error loading list:', listError);
            navigate('/lists');
            return;
        }

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
        } else {
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
        setLoading(false);
    };

    const filteredRequirements = requirements.filter((req) => {
        const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.req_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
        const matchesState = filterState === 'all' || req.state === filterState;
        return matchesSearch && matchesPriority && matchesState;
    });

    const getPriorityBadge = (priority: string) => {
        const variants = {
            HIGH: 'destructive',
            MEDIUM: 'default',
            LOW: 'secondary',
        } as const;
        return (
            <Badge variant={variants[priority as keyof typeof variants] || 'secondary'}>
                {priority}
            </Badge>
        );
    };

    const getStateBadge = (state: string) => {
        const variants = {
            PROPOSED: 'outline',
            SELECTED: 'secondary',
            SCHEDULED: 'default',
            DONE: 'default',
        } as const;
        return (
            <Badge variant={variants[state as keyof typeof variants] || 'outline'}>
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
        <div className="h-screen flex flex-col">
            {/* Fixed Header */}
            <header className="border-b border-white/20 bg-white/60 backdrop-blur-md flex-none shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/lists')}
                            className="hover:bg-white/60"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{list?.name}</h1>
                            <p className="text-sm text-slate-600 mt-0.5">{list?.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right px-4 py-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50">
                                <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{totalEstimation.toFixed(1)} days</div>
                                <div className="text-xs text-slate-600 font-medium">
                                    {estimatedCount} estimated · {notEstimatedCount} pending
                                </div>
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="hover:bg-white/60">
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
                                    Clear All Requirements
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowBulkEstimate(true)}
                            disabled={filteredRequirements.length === 0}
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Estimate All
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)} className="hover:bg-white/60">
                            <Upload className="mr-2 h-4 w-4" />
                            Import Excel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Requirement
                        </Button>
                    </div>

                    {/* Compact Filters */}
                    <div className="flex gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search requirements..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                            <SelectTrigger className="w-36 h-11 border-slate-300">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-md">
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="HIGH">High</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="LOW">Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterState} onValueChange={setFilterState}>
                            <SelectTrigger className="w-36 h-11 border-slate-300">
                                <SelectValue placeholder="State" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-md">
                                <SelectItem value="all">All States</SelectItem>
                                <SelectItem value="PROPOSED">Proposed</SelectItem>
                                <SelectItem value="SELECTED">Selected</SelectItem>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="DONE">Done</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header >

            {/* Scrollable Content Area */}
            < div className="flex-1 overflow-hidden" >
                <div className="container mx-auto px-6 h-full">
                    {filteredRequirements.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <Card className="max-w-md border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl">
                                <CardContent className="flex flex-col items-center py-12 px-8">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
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
                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
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
                                            className="group border-slate-200/50 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                                            onClick={() => navigate(`/lists/${listId}/requirements/${req.id}`)}
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
                                                        <h3 className="font-semibold text-base truncate">{req.title}</h3>
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
                                                            <div className="text-right bg-primary/10 px-3 py-2 rounded">
                                                                <div className="text-lg font-bold text-primary">
                                                                    {estimation.total_days.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">days</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-right bg-muted px-3 py-2 rounded">
                                                                <div className="text-sm font-medium text-muted-foreground">Not</div>
                                                                <div className="text-xs text-muted-foreground">estimated</div>
                                                            </div>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
