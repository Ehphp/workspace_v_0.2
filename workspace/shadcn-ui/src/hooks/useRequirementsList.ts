import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { List, Requirement, RequirementWithEstimation, Estimation } from '@/types/database';

interface UseRequirementsListProps {
    listId: string | undefined;
    userId: string | undefined;
}

interface UseRequirementsListReturn {
    // Data
    list: List | null;
    requirements: RequirementWithEstimation[];
    filteredRequirements: RequirementWithEstimation[];
    paginatedRequirements: RequirementWithEstimation[];

    // State
    loading: boolean;
    errorMessage: string | null;

    // Filters
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterPriority: string;
    setFilterPriority: (priority: string) => void;
    filterState: string;
    setFilterState: (state: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;

    // Pagination
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (size: number) => void;
    totalPages: number;
    showingFrom: number;
    showingTo: number;

    // Stats
    totalEstimation: number;
    estimatedCount: number;
    notEstimatedCount: number;

    // Actions
    loadData: (signal?: AbortSignal) => Promise<void>;
    updateRequirement: (id: string, updates: Partial<RequirementWithEstimation>) => void;
}

export function useRequirementsList({ listId, userId }: UseRequirementsListProps): UseRequirementsListReturn {
    const navigate = useNavigate();
    const { toast } = useToast();

    // Data state
    const [list, setList] = useState<List | null>(null);
    const [requirements, setRequirements] = useState<RequirementWithEstimation[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterState, setFilterState] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('updated-desc');

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const updateRequirement = useCallback((id: string, updates: Partial<RequirementWithEstimation>) => {
        setRequirements(prev => prev.map(req =>
            req.id === id ? { ...req, ...updates } : req
        ));
    }, []);

    const addRequirement = useCallback((req: RequirementWithEstimation) => {
        setRequirements(prev => [req, ...prev]);
    }, []);

    const loadData = useCallback(async (signal?: AbortSignal) => {
        if (!userId || !listId) return;

        setLoading(true);
        setErrorMessage(null);

        try {
            // Load list details
            const { data: listData, error: listError } = await supabase
                .from('lists')
                .select('*')
                .eq('id', listId)
                .eq('user_id', userId)
                .abortSignal(signal as AbortSignal)
                .single();

            const isAborted =
                signal?.aborted ||
                listError?.name === 'AbortError' ||
                listError?.message?.includes('AbortError');

            if (listError && !isAborted) {
                console.error('Error loading list:', listError);
                toast({
                    title: 'Error',
                    description: 'Failed to load project details',
                    variant: 'destructive',
                });
                setErrorMessage('Failed to load project details');
                navigate('/dashboard');
                return;
            }

            if (isAborted) return;
            setList(listData);

            // Load requirements with their latest estimation
            // Using estimations!requirement_id to explicitly specify which foreign key to use
            // (now that we have both requirement_id and assigned_estimation_id relationships)
            const { data: reqData, error: reqError } = await supabase
                .from('requirements')
                .select(`
          *,
          estimations!requirement_id(
            id,
            total_days,
            created_at
          )
        `)
                .eq('list_id', listId)
                .order('created_at', { ascending: false })
                .abortSignal(signal as AbortSignal);

            const reqAborted =
                signal?.aborted ||
                reqError?.name === 'AbortError' ||
                reqError?.message?.includes('AbortError');

            if (reqError && !reqAborted) {
                console.error('Error loading requirements:', reqError);
                if (!reqAborted) {
                    toast({
                        title: 'Error',
                        description: 'Failed to load requirements',
                        variant: 'destructive',
                    });
                    setErrorMessage('Failed to load requirements. Please retry.');
                }
            } else if (!reqAborted) {
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
            const isAbortError =
                (error as Error)?.name === 'AbortError' ||
                (error as Error)?.message?.includes?.('AbortError') ||
                signal?.aborted;
            if (isAbortError) return;

            console.error('Unexpected error loading data:', error);
            if (!signal?.aborted) {
                toast({
                    title: 'Error',
                    description: 'An unexpected error occurred',
                    variant: 'destructive',
                });
                setErrorMessage('Unexpected error while loading requirements.');
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [userId, listId, navigate, toast]);

    // Load data on mount
    useEffect(() => {
        const abortController = new AbortController();
        if (userId && listId) {
            loadData(abortController.signal);
        }

        return () => {
            abortController.abort();
        };
    }, [userId, listId, loadData]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterPriority, filterState, sortBy, requirements.length]);

    // Filtering and sorting
    const filteredRequirements = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();

        // Filter
        const filtered = requirements.filter((req) => {
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

    // Pagination
    const paginatedRequirements = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRequirements.slice(start, start + pageSize);
    }, [filteredRequirements, page, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredRequirements.length / pageSize));
    const showingFrom = filteredRequirements.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const showingTo = Math.min(filteredRequirements.length, page * pageSize);

    // Ensure page is within bounds
    useEffect(() => {
        setPage((prev) => Math.min(prev, totalPages));
    }, [totalPages]);

    // Calculate total estimation
    const totalEstimation = filteredRequirements.reduce((sum, req) => {
        return sum + (req.latest_estimation?.total_days || 0);
    }, 0);

    const estimatedCount = filteredRequirements.filter((req) => req.latest_estimation).length;
    const notEstimatedCount = filteredRequirements.length - estimatedCount;

    return {
        // Data
        list,
        requirements,
        filteredRequirements,
        paginatedRequirements,

        // State
        loading,
        errorMessage,

        // Filters
        searchTerm,
        setSearchTerm,
        filterPriority,
        setFilterPriority,
        filterState,
        setFilterState,
        sortBy,
        setSortBy,

        // Pagination
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        showingFrom,
        showingTo,

        // Stats
        totalEstimation,
        estimatedCount,
        notEstimatedCount,

        // Actions
        loadData,
        updateRequirement,
        addRequirement,
    };
}
