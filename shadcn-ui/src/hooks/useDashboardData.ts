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
            // 1) Get user's active projects and keep the ids for next queries
            const { data: projects, count: projectCount, error: projectError } = await supabase
                .from('lists')
                .select('id', { count: 'exact' })
                .eq('user_id', user.id)
                .neq('status', 'ARCHIVED');

            if (projectError) throw projectError;

            const listIds = projects?.map(l => l.id) || [];

            let activeRequirementsCount = 0;
            let totalDays = 0;
            let avgDays = 0;

            if (listIds.length > 0) {
                // 2) Count requirements in those projects and collect their ids
                // Count active requirements in user's lists
                const { data: requirements, count: reqCount, error: reqError } = await supabase
                    .from('requirements')
                    .select('id', { count: 'exact' })
                    .in('list_id', listIds);

                if (reqError) throw reqError;
                activeRequirementsCount = reqCount || 0;

                const requirementIds = requirements?.map(r => r.id) || [];

                if (requirementIds.length > 0) {
                    // 3) Sum estimations linked to those requirements
                    const { data: estimations, error: estError } = await supabase
                        .from('estimations')
                        .select('total_days')
                        .in('requirement_id', requirementIds);

                    if (estError) throw estError;

                    const totals = estimations?.map(e => Number(e.total_days) || 0) || [];
                    if (totals.length > 0) {
                        totalDays = totals.reduce((sum, days) => sum + days, 0);
                        avgDays = totalDays / totals.length;
                    }
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
