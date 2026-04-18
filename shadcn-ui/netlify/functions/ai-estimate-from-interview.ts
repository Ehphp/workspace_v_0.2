/**
 * Netlify Function: AI Estimate from Interview
 *
 * HTTP entry point — parses the request, resolves kill-switches,
 * then delegates to runEstimationOrchestrator for the full pipeline.
 *
 * POST /.netlify/functions/ai-estimate-from-interview
 */

import { createAIHandler } from './lib/handler';
import { readKillSwitches } from './lib/domain/pipeline/kill-switches';
import { runEstimationOrchestrator } from './lib/domain/estimation/estimation-orchestrator';
import type { Activity, InterviewAnswerRecord } from './lib/infrastructure/db/activities';

// ─── Request body ─────────────────────────────────────────────────────────────

interface RequestBody {
    description: string;
    techPresetId?: string;
    techCategory?: string;
    answers: Record<string, InterviewAnswerRecord>;
    /** @deprecated Activities are now fetched server-side. Kept for backward compat. */
    activities?: Activity[];
    projectId?: string;
    projectContext?: {
        name: string;
        description: string;
        owner?: string;
        projectType?: string;
        domain?: string;
        scope?: string;
        teamSize?: number;
        deadlinePressure?: string;
        methodology?: string;
    };
    requirementUnderstanding?: Record<string, unknown>;
    impactMap?: Record<string, unknown>;
    estimationBlueprint?: Record<string, unknown>;
    projectTechnicalBlueprint?: Record<string, unknown>;
    /**
     * Dev-only: kill-switch overrides injected from the debug dashboard.
     * Ignored in production (process.env.CONTEXT === 'production').
     */
    devConfig?: {
        killSwitches?: Partial<import('./lib/domain/pipeline/kill-switches').KillSwitches>;
        forceMode?: 'agentic' | 'deterministic';
    };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-estimate-from-interview',
    requireAuth: false,
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'La descrizione del requisito è obbligatoria.';
        }
        if (!body.answers || typeof body.answers !== 'object') {
            return 'Le risposte all\'interview sono obbligatorie.';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const isProd = process.env.CONTEXT === 'production';
        const baseKs = readKillSwitches();

        const ks = (!isProd && body.devConfig?.killSwitches)
            ? { ...baseKs, ...body.devConfig.killSwitches }
            : baseKs;

        if (!isProd && body.devConfig?.forceMode === 'deterministic') {
            (ks as any).agenticEnabled = false;
        }

        return runEstimationOrchestrator({
            description: body.description,
            sanitizedDescription: ctx.sanitize(body.description),
            answers: body.answers,
            techCategory: body.techCategory || 'MULTI',
            techPresetId: body.techPresetId,
            activities: body.activities,
            projectId: body.projectId,
            projectContext: body.projectContext,
            requirementUnderstanding: body.requirementUnderstanding,
            impactMap: body.impactMap,
            estimationBlueprint: body.estimationBlueprint,
            projectTechnicalBlueprint: body.projectTechnicalBlueprint,
            killSwitches: ks,
            requestId: ctx.requestId ?? `est-${Date.now()}`,
            userId: ctx.userId,
        });
    },
});
