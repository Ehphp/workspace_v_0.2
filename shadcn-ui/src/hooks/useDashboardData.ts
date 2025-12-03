import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
    totalProjects: number;
    activeRequirements: number;
    totalEstimatedDays: number;
    averageDaysPerReq: number;
    loading: boolean;
    error: string | null;
}

export function useDashboardData() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalProjects: 0,
        activeRequirements: 0,
        totalEstimatedDays: 0,
        averageDaysPerReq: 0,
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!user) {
            setStats({
                totalProjects: 0,
                activeRequirements: 0,
                totalEstimatedDays: 0,
                averageDaysPerReq: 0,
                loading: false,
                error: null,
            });
            return;
        }

        loadDashboardStats();
    }, [user]);

    const loadDashboardStats = async () => {
        if (!user) return;

        setStats(prev => ({ ...prev, loading: true, error: null }));

        try {
            // 1. Get total active projects (count only)
            const { count: projectCount, error: projectError } = await supabase
                .from('lists')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .neq('status', 'ARCHIVED');

            if (projectError) throw projectError;

            // 2. Get active requirements count (count only, filtered by user's lists via inner join logic or two-step)
            // Since RLS is per user, we can trust the user_id on lists. 
            // Requirements don't have user_id directly usually, they link to lists.
            // Efficient way: Get all list IDs first (lightweight), then count reqs in those lists.

            const { data: userLists, error: listsError } = await supabase
                .from('lists')
                .select('id')
                .eq('user_id', user.id);

            if (listsError) throw listsError;

            const listIds = userLists?.map(l => l.id) || [];

            let activeRequirementsCount = 0;
            let totalDays = 0;
            let avgDays = 0;

            if (listIds.length > 0) {
                // Count active requirements in user's lists
                const { count: reqCount, error: reqError } = await supabase
                    .from('requirements')
                    .select('*', { count: 'exact', head: true })
                    .in('list_id', listIds)
                    .neq('state', 'ARCHIVED');

                if (reqError) throw reqError;
                activeRequirementsCount = reqCount || 0;

                // 3. Get total estimated days
                // We need to sum 'total_days' from estimations for these requirements.
                // We can use a join if possible, or fetch just the 'total_days' column for relevant estimations.
                // To avoid fetching ALL estimations, we can try to use an RPC if available, or just fetch the column.
                // For now, fetching just the column is better than fetching full objects.
                // Optimization: We only need estimations for the active requirements in these lists.

                // Fetching just total_days for all estimations linked to user's requirements
                // This might still be large if there are 10k requirements, but better than before.
                // Ideally we'd have a DB view: view_user_stats

                const { data: estimations, error: estError } = await supabase
                    .from('estimations')
                    .select('total_days, requirements!inner(list_id)') // Inner join to filter by requirements
                    .in('requirements.list_id', listIds);

                if (estError) throw estError;

                if (estimations && estimations.length > 0) {
                    totalDays = estimations.reduce((sum, e) => sum + (e.total_days || 0), 0);
                    avgDays = totalDays / estimations.length;
                }
            }

            setStats({
                totalProjects: projectCount || 0,
                activeRequirements: activeRequirementsCount,
                totalEstimatedDays: Math.round(totalDays),
                averageDaysPerReq: Math.round(avgDays * 10) / 10,
                loading: false,
                error: null,
            });

        } catch (err) {
            console.error('Error loading dashboard stats:', err);
            setStats(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to load dashboard stats',
            }));
        }
    };

    return { stats, refetch: loadDashboardStats };
}
