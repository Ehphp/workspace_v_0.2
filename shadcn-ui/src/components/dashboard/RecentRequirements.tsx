import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentRequirement {
    id: string;
    title: string;
    priority: string;
    state: string;
    list_id: string;
    list_name: string;
    total_days: number | null;
    updated_at: string;
}

export function RecentRequirements() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [requirements, setRequirements] = useState<RecentRequirement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadRecentRequirements();
        }
    }, [user]);

    const loadRecentRequirements = async () => {
        if (!user) return;

        try {
            // Get user's lists
            const { data: lists, error: listsError } = await supabase
                .from('lists')
                .select('id, name')
                .eq('user_id', user.id);

            if (listsError) throw listsError;

            const listIds = lists?.map(l => l.id) || [];

            if (listIds.length === 0) {
                setRequirements([]);
                setLoading(false);
                return;
            }

            // Get recent requirements
            const { data: reqs, error: reqsError } = await supabase
                .from('requirements')
                .select('id, title, priority, state, list_id, updated_at')
                .in('list_id', listIds)
                .order('updated_at', { ascending: false })
                .limit(10);

            if (reqsError) throw reqsError;

            // Get latest estimation for each requirement
            const requirementsWithEstimations = await Promise.all(
                (reqs || []).map(async (req) => {
                    const { data: estimation } = await supabase
                        .from('estimations')
                        .select('total_days')
                        .eq('requirement_id', req.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    const list = lists?.find(l => l.id === req.list_id);

                    return {
                        ...req,
                        list_name: list?.name || 'Unknown',
                        total_days: estimation?.total_days || null,
                    };
                })
            );

            setRequirements(requirementsWithEstimations);
        } catch (err) {
            console.error('Error loading recent requirements:', err);
        } finally {
            setLoading(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            HIGH: 'text-red-600 bg-red-50 border-red-100',
            MEDIUM: 'text-amber-600 bg-amber-50 border-amber-100',
            LOW: 'text-blue-600 bg-blue-50 border-blue-100',
        };
        return colors[priority] || 'text-slate-600 bg-slate-50 border-slate-100';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (requirements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <Clock className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500">No recent activity</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {requirements.map((req) => (
                <div
                    key={req.id}
                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                    onClick={() => navigate(`/dashboard/${req.list_id}/requirements/${req.id}`)}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                            <h4 className="text-sm font-medium text-slate-900 truncate pr-2">
                                {req.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                                {new Date(req.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 truncate max-w-[100px]">{req.list_name}</span>
                            <span className="text-slate-300">•</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getPriorityColor(req.priority)}`}>
                                {req.priority}
                            </span>
                        </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                </div>
            ))}
        </div>
    );
}

