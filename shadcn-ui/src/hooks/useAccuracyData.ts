/**
 * useAccuracyData — Fetches estimation accuracy data from the estimation_accuracy view.
 *
 * Returns scatter data, KPIs, and technology breakdown for the analytics page.
 * Sprint 2 — S2-3a
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchProjectIds, PROJECT_FK } from '@/lib/projects';

export interface ScatterDatum {
    estimationId: string;
    title: string;
    estimatedDays: number;
    actualDays: number;
    deviationPercent: number;
    technology: string;
    scenarioName: string;
}

export interface TechnologyAccuracy {
    technology: string;
    avgDeviation: number;
    count: number;
}

export interface AccuracyStats {
    scatterData: ScatterDatum[];
    averageDeviation: number;
    medianDeviation: number;
    totalWithActuals: number;
    overEstimatedCount: number;
    underEstimatedCount: number;
    byTechnology: TechnologyAccuracy[];
    loading: boolean;
    error: string | null;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useAccuracyData() {
    const { currentOrganization } = useAuthStore();
    const [stats, setStats] = useState<AccuracyStats>({
        scatterData: [],
        averageDeviation: 0,
        medianDeviation: 0,
        totalWithActuals: 0,
        overEstimatedCount: 0,
        underEstimatedCount: 0,
        byTechnology: [],
        loading: true,
        error: null,
    });

    const load = useCallback(async () => {
        if (!currentOrganization) {
            setStats(prev => ({ ...prev, loading: false }));
            return;
        }

        setStats(prev => ({ ...prev, loading: true, error: null }));

        try {
            // 1) Get org's requirement IDs
            const projectIds = await fetchProjectIds(currentOrganization.id);

            if (projectIds.length === 0) {
                setStats(prev => ({ ...prev, loading: false, scatterData: [] }));
                return;
            }

            const { data: reqs, error: reqError } = await supabase
                .from('requirements')
                .select('id')
                .in(PROJECT_FK, projectIds);

            if (reqError) throw reqError;
            const reqIds = reqs?.map(r => r.id) || [];

            if (reqIds.length === 0) {
                setStats(prev => ({ ...prev, loading: false, scatterData: [] }));
                return;
            }

            // 2) Fetch from the accuracy view
            const { data: rows, error: viewError } = await supabase
                .from('estimation_accuracy')
                .select('*')
                .in('requirement_id', reqIds)
                .order('estimated_at', { ascending: false })
                .limit(200);

            if (viewError) throw viewError;

            if (!rows || rows.length === 0) {
                setStats(prev => ({ ...prev, loading: false, scatterData: [], totalWithActuals: 0 }));
                return;
            }

            // 3) Transform rows into scatter data
            const scatterData: ScatterDatum[] = rows.map((r: any) => ({
                estimationId: r.estimation_id,
                title: r.requirement_title || '',
                estimatedDays: Number(r.total_days),
                actualDays: Number(r.actual_hours) / 8,
                deviationPercent: Number(r.deviation_percent) || 0,
                technology: r.technology_name || 'N/A',
                scenarioName: r.scenario_name || 'Base',
            }));

            // 4) Compute KPIs
            const deviations = scatterData.map(d => d.deviationPercent);
            const absDeviations = deviations.map(d => Math.abs(d));
            const avgDev = absDeviations.length > 0
                ? absDeviations.reduce((s, v) => s + v, 0) / absDeviations.length
                : 0;

            const overEstimated = scatterData.filter(d => d.deviationPercent < -5).length;  // estimated more than actual
            const underEstimated = scatterData.filter(d => d.deviationPercent > 5).length;  // estimated less than actual

            // 5) Group by technology
            const techMap = new Map<string, { sum: number; count: number }>();
            for (const d of scatterData) {
                const existing = techMap.get(d.technology) || { sum: 0, count: 0 };
                existing.sum += Math.abs(d.deviationPercent);
                existing.count++;
                techMap.set(d.technology, existing);
            }
            const byTechnology: TechnologyAccuracy[] = Array.from(techMap.entries())
                .map(([tech, { sum, count }]) => ({
                    technology: tech,
                    avgDeviation: Math.round((sum / count) * 10) / 10,
                    count,
                }))
                .sort((a, b) => b.count - a.count);

            setStats({
                scatterData,
                averageDeviation: Math.round(avgDev * 10) / 10,
                medianDeviation: Math.round(median(absDeviations) * 10) / 10,
                totalWithActuals: scatterData.length,
                overEstimatedCount: overEstimated,
                underEstimatedCount: underEstimated,
                byTechnology,
                loading: false,
                error: null,
            });
        } catch (err: any) {
            console.error('Error loading accuracy data:', err);
            setStats(prev => ({
                ...prev,
                loading: false,
                error: err?.message || 'Errore nel caricamento dei dati di accuratezza',
            }));
        }
    }, [currentOrganization]);

    useEffect(() => {
        load();
    }, [load]);

    return { ...stats, refresh: load };
}
