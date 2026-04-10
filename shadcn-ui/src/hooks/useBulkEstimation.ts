/**
 * Hook for bulk AI estimation with live per-requirement status.
 *
 * Processes requirements through the Understanding → Blueprint → Estimation
 * pipeline and exposes a status map so callers (e.g. RequirementRow) can
 * show live feedback without keeping a dialog open.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { saveEstimationByIds, fetchEstimationMasterData } from '@/lib/api';
import { interviewFinalizeEstimation } from '@/lib/estimation-utils';
import { generateRequirementUnderstanding } from '@/lib/requirement-understanding-api';
import { generateEstimationBlueprint } from '@/lib/estimation-blueprint-api';
import { generateEstimateFromInterview } from '@/lib/requirement-interview-api';
import type { Technology } from '@/types/database';

const MAX_CONCURRENT = 2;

export type BulkItemStatus = 'pending' | 'processing' | 'success' | 'error';

export interface BulkItemState {
    status: BulkItemStatus;
    /** Set when status === 'success' */
    totalDays?: number;
    /** Set when status === 'error' */
    error?: string;
}

export interface BulkRequirement {
    id: string;
    req_id: string;
    title: string;
    description: string;
    technology_id: string | null;
    tech_preset_id?: string | null;
}

interface UseBulkEstimationReturn {
    /** Per-requirement live status */
    statusMap: Map<string, BulkItemState>;
    /** True while any requirement is still being processed */
    isRunning: boolean;
    /** Start the bulk pipeline for the given requirements */
    start: (requirements: BulkRequirement[], projectTechnologyId: string | null) => Promise<void>;
    /** Cancel in-flight processing */
    cancel: () => void;
    /** Reset state (clear status map) */
    reset: () => void;
}

export function useBulkEstimation(): UseBulkEstimationReturn {
    const [statusMap, setStatusMap] = useState<Map<string, BulkItemState>>(new Map());
    const [isRunning, setIsRunning] = useState(false);
    const cancelledRef = useRef(false);

    const updateItem = useCallback((id: string, state: BulkItemState) => {
        setStatusMap(prev => {
            const next = new Map(prev);
            next.set(id, state);
            return next;
        });
    }, []);

    const start = useCallback(async (
        requirements: BulkRequirement[],
        projectTechnologyId: string | null,
    ) => {
        cancelledRef.current = false;
        setIsRunning(true);

        // Filter estimable
        const estimable = requirements.filter(r => {
            const techId = r.technology_id || r.tech_preset_id || projectTechnologyId;
            return techId && r.description?.trim();
        });

        // Initialise all as pending
        const initial = new Map<string, BulkItemState>();
        estimable.forEach(r => initial.set(r.id, { status: 'pending' }));
        setStatusMap(initial);

        // Auth
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (sessionError || !userId) {
            estimable.forEach(r => updateItem(r.id, { status: 'error', error: 'Non autenticato' }));
            setIsRunning(false);
            return;
        }

        // Master data
        let masterData: Awaited<ReturnType<typeof fetchEstimationMasterData>>;
        try {
            masterData = await fetchEstimationMasterData();
        } catch {
            estimable.forEach(r => updateItem(r.id, { status: 'error', error: 'Errore caricamento dati' }));
            setIsRunning(false);
            return;
        }

        const presetsMap = new Map<string, Technology>(
            masterData.presets.map(p => [p.id, p]),
        );

        // Process in batches
        for (let i = 0; i < estimable.length; i += MAX_CONCURRENT) {
            if (cancelledRef.current) break;

            const batch = estimable.slice(i, i + MAX_CONCURRENT);

            // Mark batch as processing
            batch.forEach(r => updateItem(r.id, { status: 'processing' }));

            const promises = batch.map(async (req) => {
                const t0 = performance.now();
                try {
                    const technologyId = req.technology_id || req.tech_preset_id || projectTechnologyId;
                    if (!technologyId) throw new Error('Tecnologia mancante');

                    const preset = presetsMap.get(technologyId);
                    if (!preset) throw new Error('Tecnologia non trovata');

                    const techCategory = preset.tech_category || 'MULTI';

                    // 1 — Understanding
                    const uRes = await generateRequirementUnderstanding({
                        description: req.description,
                        techCategory,
                        techPresetId: technologyId,
                    });
                    if (!uRes.success || !uRes.understanding) {
                        throw new Error(uRes.error || 'Understanding fallito');
                    }

                    // 2 — Blueprint (soft-optional)
                    const bRes = await generateEstimationBlueprint({
                        description: req.description,
                        techCategory,
                        techPresetId: technologyId,
                        requirementUnderstanding: uRes.understanding,
                    });
                    const blueprint = bRes.success ? bRes.blueprint : undefined;

                    // 3 — Estimation
                    const eRes = await generateEstimateFromInterview({
                        description: req.description,
                        techPresetId: technologyId,
                        techCategory,
                        answers: {},
                        requirementUnderstanding: uRes.understanding,
                        estimationBlueprint: blueprint,
                    });
                    if (!eRes.success || !eRes.activities?.length) {
                        throw new Error(eRes.error || 'Stima vuota');
                    }

                    // 4 — Deterministic finalization
                    const activityCodes = eRes.activities.map(a => a.code);
                    const finalized = interviewFinalizeEstimation(
                        activityCodes,
                        masterData.activities,
                        masterData.drivers,
                        masterData.risks,
                        eRes.suggestedDrivers?.map(d => ({ code: d.code, suggestedValue: d.suggestedValue })),
                        eRes.suggestedRisks,
                        preset,
                    );
                    if (!finalized.selectedActivities?.length) {
                        throw new Error('Finalizzazione fallita');
                    }

                    // 5 — Save
                    await saveEstimationByIds({
                        requirementId: req.id,
                        userId,
                        totalDays: finalized.totalDays,
                        baseHours: finalized.baseDays * 8,
                        driverMultiplier: finalized.driverMultiplier,
                        riskScore: finalized.riskScore,
                        contingencyPercent: finalized.contingencyPercent,
                        scenarioName: 'AI Bulk Estimate',
                        activities: finalized.selectedActivities.map(a => ({
                            activity_id: masterData.activities.find(ma => ma.code === a.code)?.id || '',
                            is_ai_suggested: a.isAiSuggested,
                            notes: '',
                        })),
                        drivers: finalized.appliedDrivers.length > 0
                            ? finalized.appliedDrivers.map(d => ({ driver_id: d.id, selected_value: d.selectedValue }))
                            : null,
                        risks: finalized.appliedRisks.length > 0
                            ? finalized.appliedRisks.map(r => ({ risk_id: r.id }))
                            : null,
                        aiReasoning: eRes.reasoning || null,
                    });

                    const ms = Math.round(performance.now() - t0);
                    console.log('[BulkEstimate]', { id: req.id, ms, activities: activityCodes.length });

                    updateItem(req.id, { status: 'success', totalDays: finalized.totalDays });
                } catch (error) {
                    console.error(`[BulkEstimate] ${req.req_id}:`, error);
                    updateItem(req.id, {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Errore sconosciuto',
                    });
                }
            });

            await Promise.all(promises);
        }

        setIsRunning(false);
    }, [updateItem]);

    const cancel = useCallback(() => {
        cancelledRef.current = true;
    }, []);

    const reset = useCallback(() => {
        cancelledRef.current = false;
        setStatusMap(new Map());
        setIsRunning(false);
    }, []);

    return { statusMap, isRunning, start, cancel, reset };
}
