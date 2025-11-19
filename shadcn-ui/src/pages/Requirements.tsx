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
import { Header } from '@/components/layout/Header';

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

    const getPriorityConfig = (priority: string) => {
        const configs = {
            HIGH: {
                gradient: 'from-red-500 to-rose-500',
                bgGradient: 'from-red-50 to-rose-50',
                textColor: 'text-red-700',
                borderColor: 'border-red-200/50',
                leftBorder: 'border-l-red-500',
                icon: '🔴'
            },
            MEDIUM: {
                gradient: 'from-amber-500 to-orange-500',
                bgGradient: 'from-amber-50 to-orange-50',
                textColor: 'text-amber-700',
                borderColor: 'border-amber-200/50',
                leftBorder: 'border-l-amber-500',
                icon: '🟡'
            },
            LOW: {
                gradient: 'from-emerald-500 to-teal-500',
                bgGradient: 'from-emerald-50 to-teal-50',
                textColor: 'text-emerald-700',
                borderColor: 'border-emerald-200/50',
                leftBorder: 'border-l-emerald-500',
                icon: '🟢'
            },
        };
        return configs[priority as keyof typeof configs] || configs.MEDIUM;
    };

    const getPriorityBadge = (priority: string) => {
        const config = getPriorityConfig(priority);

        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} shadow-sm`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${config.gradient} animate-pulse`}></div>
                <span className={`text-xs font-semibold ${config.textColor}`}>{priority}</span>
            </div>
        );
    };

    const getStateBadge = (state: string) => {
        const stateConfig = {
            PROPOSED: {
                gradient: 'from-blue-500 to-indigo-500',
                bgGradient: 'from-blue-50 to-indigo-50',
                textColor: 'text-blue-700',
                borderColor: 'border-blue-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                )
            },
            APPROVED: {
                gradient: 'from-emerald-500 to-teal-500',
                bgGradient: 'from-emerald-50 to-teal-50',
                textColor: 'text-emerald-700',
                borderColor: 'border-emerald-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )
            },
            SELECTED: {
                gradient: 'from-violet-500 to-purple-500',
                bgGradient: 'from-violet-50 to-purple-50',
                textColor: 'text-violet-700',
                borderColor: 'border-violet-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )
            },
            SCHEDULED: {
                gradient: 'from-orange-500 to-amber-500',
                bgGradient: 'from-orange-50 to-amber-50',
                textColor: 'text-orange-700',
                borderColor: 'border-orange-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                )
            },
            DONE: {
                gradient: 'from-teal-500 to-cyan-500',
                bgGradient: 'from-teal-50 to-cyan-50',
                textColor: 'text-teal-700',
                borderColor: 'border-teal-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )
            },
            REJECTED: {
                gradient: 'from-red-500 to-rose-500',
                bgGradient: 'from-red-50 to-rose-50',
                textColor: 'text-red-700',
                borderColor: 'border-red-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )
            },
            IN_PROGRESS: {
                gradient: 'from-purple-500 to-pink-500',
                bgGradient: 'from-purple-50 to-pink-50',
                textColor: 'text-purple-700',
                borderColor: 'border-purple-200/50',
                icon: (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                )
            },
        };

        const config = stateConfig[state as keyof typeof stateConfig] || stateConfig.PROPOSED;

        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} shadow-sm transition-all duration-200 hover:shadow-md`}>
                <div className={config.textColor}>{config.icon}</div>
                <span className={`text-xs font-semibold ${config.textColor}`}>{state.replace('_', ' ')}</span>
            </div>
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

            {/* Use shared Header component */}
            <Header />

            {/* Page specific info bar - cleaner and more spacious */}
            <div className="relative border-b border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between gap-6">
                        {/* Left side: Project info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                                <FileText className="w-5 h-5 text-white" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold text-slate-900 truncate mb-1">
                                    {list?.name}
                                </h1>
                                {list?.description && (
                                    <p className="text-sm text-slate-600 truncate">{list.description}</p>
                                )}
                            </div>

                            {/* Summary Card - more elegant */}
                            <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 shadow-sm">
                                <div className="text-center">
                                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                        {totalEstimation.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium">Total Days</div>
                                </div>
                                <div className="h-10 w-px bg-blue-300/30"></div>
                                <div className="text-left space-y-0.5">
                                    <div className="text-sm text-slate-700">
                                        <span className="font-bold text-blue-600">{estimatedCount}</span> estimated
                                    </div>
                                    <div className="text-sm text-slate-700">
                                        <span className="font-bold text-slate-800">{notEstimatedCount}</span> pending
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right side: Actions */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => setShowBulkEstimate(true)}
                                disabled={filteredRequirements.length === 0}
                                variant="outline"
                                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-300"
                            >
                                <Zap className="mr-2 h-4 w-4" />
                                Estimate All
                            </Button>
                            <Button
                                onClick={() => setShowCreateDialog(true)}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                New Requirement
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="container mx-auto px-6 py-12">
                    {filteredRequirements.length === 0 ? (
                        <div className="max-w-7xl mx-auto">
                            <div className="grid lg:grid-cols-2 gap-12 items-center">
                                {/* Left: Welcome Message */}
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                            <span className="text-xs font-medium text-blue-900">
                                                {requirements.length === 0 ? 'Start Building' : 'No Results'}
                                            </span>
                                        </div>

                                        <h2 className="text-5xl font-bold text-slate-900 leading-tight">
                                            {requirements.length === 0 ? (
                                                <>
                                                    Add Your First
                                                    <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                        Requirement
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    No Matching
                                                    <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                        Requirements
                                                    </span>
                                                </>
                                            )}
                                        </h2>

                                        <p className="text-lg text-slate-600 leading-relaxed">
                                            {requirements.length === 0
                                                ? 'Start by creating requirements or import them from Excel. Each requirement can be estimated individually with detailed analysis of activities, drivers, and risks.'
                                                : 'Try adjusting your search filters or criteria to find what you\'re looking for. You can filter by priority, state, or use the search bar.'}
                                        </p>
                                    </div>

                                    {requirements.length === 0 && (
                                        <>
                                            <div className="flex flex-wrap gap-3">
                                                <Button
                                                    size="lg"
                                                    onClick={() => setShowCreateDialog(true)}
                                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                                                >
                                                    <Plus className="mr-2 h-5 w-5" />
                                                    Create Requirement
                                                </Button>
                                                <Button
                                                    size="lg"
                                                    variant="outline"
                                                    onClick={() => setShowImportDialog(true)}
                                                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300"
                                                >
                                                    <Upload className="mr-2 h-5 w-5" />
                                                    Import from Excel
                                                </Button>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-3 gap-4 pt-4">
                                                <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-blue-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                                    <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                                                        <FileText className="h-8 w-8" />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-900">Requirements</p>
                                                    <p className="text-xs text-slate-500 mt-1">Track & organize</p>
                                                </div>
                                                <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                                    <div className="text-3xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                                                        <Zap className="h-8 w-8" />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-900">AI Estimates</p>
                                                    <p className="text-xs text-slate-500 mt-1">Smart analysis</p>
                                                </div>
                                                <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                                    <div className="text-3xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                                                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-900">Reports</p>
                                                    <p className="text-xs text-slate-500 mt-1">Detailed insights</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right: Features Card */}
                                <div className="space-y-6">
                                    <Card className="border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
                                        <CardContent className="p-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-900">Requirement Management</h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">Powerful tools at your fingertips</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3 mt-6">
                                                {[
                                                    {
                                                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
                                                        title: 'Create & Organize',
                                                        desc: 'Add requirements manually or import from Excel spreadsheets',
                                                        color: 'from-blue-500 to-cyan-500'
                                                    },
                                                    {
                                                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                                                        title: 'Bulk Estimation',
                                                        desc: 'Estimate multiple requirements at once with AI assistance',
                                                        color: 'from-indigo-500 to-purple-500'
                                                    },
                                                    {
                                                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />,
                                                        title: 'Filter & Sort',
                                                        desc: 'Organize by priority, state, estimation, or custom criteria',
                                                        color: 'from-purple-500 to-pink-500'
                                                    },
                                                    {
                                                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
                                                        title: 'Track Progress',
                                                        desc: 'Monitor estimation status and total effort in real-time',
                                                        color: 'from-pink-500 to-rose-500'
                                                    },
                                                ].map((feature, index) => (
                                                    <div
                                                        key={index}
                                                        className="group flex gap-4 items-start p-4 rounded-xl hover:bg-white/80 transition-all duration-300 hover:shadow-md cursor-default"
                                                    >
                                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                {feature.icon}
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0 pt-1">
                                                            <p className="text-sm font-bold text-slate-900 mb-1">{feature.title}</p>
                                                            <p className="text-xs text-slate-600 leading-relaxed">{feature.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto">
                            {/* Controls Section */}
                            <div className="mb-6">
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Search */}
                                    <div className="relative flex-1 min-w-[240px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Search requirements..."
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
                                        <SelectTrigger className="w-44 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
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

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 ml-auto">
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
                                    </div>
                                </div>
                            </div>

                            {/* Requirements Grid */}
                            <div className="grid gap-5">
                                {filteredRequirements.map((req) => {
                                    const estimation = req.latest_estimation;
                                    const hasEstimation = !!estimation;
                                    const priorityConfig = getPriorityConfig(req.priority);

                                    return (
                                        <Card
                                            key={req.id}
                                            className={`group relative overflow-hidden border-slate-200/60 bg-white/90 backdrop-blur-md hover:bg-white hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 ease-out cursor-pointer border-l-4 ${priorityConfig.leftBorder}`}
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
                                            {/* Subtle gradient overlay on hover */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/0 to-indigo-50/0 group-hover:via-blue-50/30 group-hover:to-indigo-50/20 transition-all duration-500 pointer-events-none" />

                                            <CardHeader className="pb-4 pt-5 px-5 relative">
                                                <div className="flex items-start gap-4">
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer space-y-3"
                                                        onClick={() => navigate(`/lists/${listId}/requirements/${req.id}`)}
                                                    >
                                                        {/* Top row: ID and badges */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100/80 px-2 py-1 rounded">{req.req_id}</span>
                                                            {getPriorityBadge(req.priority)}
                                                            {getStateBadge(req.state)}
                                                        </div>

                                                        {/* Title - more prominent */}
                                                        <h3
                                                            className="font-bold text-lg text-slate-900 group-hover:text-blue-700 transition-colors duration-300 line-clamp-2 leading-snug"
                                                            title={req.title}
                                                        >
                                                            {req.title}
                                                        </h3>

                                                        {/* Description - better spacing */}
                                                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                                            {req.description || 'No description provided'}
                                                        </p>

                                                        {/* Metadata row - refined styling */}
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                                                            {req.business_owner && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                    </svg>
                                                                    <span className="font-medium text-slate-700">{req.business_owner}</span>
                                                                </div>
                                                            )}
                                                            {req.labels && req.labels.length > 0 && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                                    </svg>
                                                                    <span>{req.labels.length} label{req.labels.length !== 1 ? 's' : ''}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>{new Date(req.updated_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right side: Estimation and Actions */}
                                                    <div className="flex items-start gap-3 flex-shrink-0">
                                                        {hasEstimation ? (
                                                            <div className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/60 px-4 py-2.5 rounded-xl shadow-sm group-hover:shadow-md group-hover:border-blue-300/70 transition-all duration-300">
                                                                <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                                    {estimation.total_days.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-slate-600 font-medium mt-0.5">days</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center bg-slate-50 border-2 border-slate-200/60 px-4 py-2.5 rounded-xl shadow-sm">
                                                                <div className="text-sm font-semibold text-slate-500">Not</div>
                                                                <div className="text-xs text-slate-400 mt-0.5">estimated</div>
                                                            </div>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-9 w-9 p-0 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                                                                    aria-label={`Options for requirement ${req.title}`}
                                                                >
                                                                    <MoreVertical className="h-4 w-4 text-slate-600" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-lg border-slate-200/60">
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive cursor-pointer"
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
