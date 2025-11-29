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
            // Get total active projects
            const { count: projectCount, error: projectError } = await supabase
                .from('lists')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .neq('status', 'ARCHIVED');

            if (projectError) throw projectError;

            // Get active requirements count
            const { data: requirementsData, error: reqError } = await supabase
                .from('requirements')
                .select('id, list_id')
                .neq('state', 'ARCHIVED');

            if (reqError) throw reqError;

            // Filter requirements by user's lists
            const { data: userLists, error: listsError } = await supabase
                .from('lists')
                .select('id')
                .eq('user_id', user.id);

            if (listsError) throw listsError;

            const userListIds = new Set(userLists?.map(l => l.id) || []);
            const userRequirements = requirementsData?.filter(r => userListIds.has(r.list_id)) || [];
            const activeRequirementsCount = userRequirements.length;

            // Get estimation stats
            const requirementIds = userRequirements.map(r => r.id);

            if (requirementIds.length > 0) {
                const { data: estimations, error: estError } = await supabase
                    .from('estimations')
                    .select('total_days')
                    .in('requirement_id', requirementIds);

                if (estError) throw estError;

                const totalDays = estimations?.reduce((sum, e) => sum + (e.total_days || 0), 0) || 0;
                const avgDays = estimations && estimations.length > 0
                    ? totalDays / estimations.length
                    : 0;

                setStats({
                    totalProjects: projectCount || 0,
                    activeRequirements: activeRequirementsCount,
                    totalEstimatedDays: Math.round(totalDays),
                    averageDaysPerReq: Math.round(avgDays * 10) / 10,
                    loading: false,
                    error: null,
                });
            } else {
                setStats({
                    totalProjects: projectCount || 0,
                    activeRequirements: 0,
                    totalEstimatedDays: 0,
                    averageDaysPerReq: 0,
                    loading: false,
                    error: null,
                });
            }
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
