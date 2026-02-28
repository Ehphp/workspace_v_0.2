/**
 * Netlify Function: AI Senior Consultant Analysis
 * 
 * Provides expert-level review of requirement estimations
 * 
 * POST /.netlify/functions/ai-consultant
 */

import { createAIHandler } from './lib/handler';
import { analyzeEstimation, ConsultantAnalysisRequest } from './lib/ai/actions/consultant-analysis';

interface RequestBody {
    requirementTitle: string;
    requirementDescription: string;
    activities: Array<{
        code: string;
        name: string;
        description: string;
        base_hours: number;
        group: string;
    }>;
    drivers: Array<{
        code: string;
        name: string;
        selectedValue: string;
        multiplier: number;
    }>;
    projectContext: {
        name: string;
        description: string;
        owner?: string;
    };
    technologyName: string;
    technologyCategory: string;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-consultant',
    requireAuth: true,
    requireLLM: true,
    rateLimit: true, // Enable rate limiting for this expensive endpoint

    validateBody: (body) => {
        if (!body.requirementTitle) {
            return 'Missing required field: requirementTitle';
        }
        if (!body.requirementDescription) {
            return 'Missing required field: requirementDescription';
        }
        if (!body.activities || body.activities.length === 0) {
            return 'Missing required field: activities (at least one required)';
        }
        if (!body.projectContext) {
            return 'Missing required field: projectContext';
        }
        if (!body.projectContext.name) {
            return 'Missing required field: projectContext.name';
        }
        if (!body.technologyName) {
            return 'Missing required field: technologyName';
        }
        if (!body.technologyCategory) {
            return 'Missing required field: technologyCategory';
        }
        return null;
    },

    handler: async (body, ctx) => {
        console.log(`[ai-consultant] Analyzing estimation for: ${body.requirementTitle}`);
        console.log(`[ai-consultant] Project: ${body.projectContext.name}`);
        console.log(`[ai-consultant] Technology: ${body.technologyName} (${body.technologyCategory})`);
        console.log(`[ai-consultant] Activities: ${body.activities.length}, Drivers: ${body.drivers?.length || 0}`);

        const request: ConsultantAnalysisRequest = {
            requirementTitle: ctx.sanitize(body.requirementTitle),
            requirementDescription: ctx.sanitize(body.requirementDescription),
            activities: body.activities.map(a => ({
                code: a.code,
                name: ctx.sanitize(a.name),
                description: ctx.sanitize(a.description || ''),
                base_hours: a.base_hours,
                group: a.group,
            })),
            drivers: (body.drivers || []).map(d => ({
                code: d.code,
                name: ctx.sanitize(d.name),
                selectedValue: d.selectedValue,
                multiplier: d.multiplier,
            })),
            projectContext: {
                name: ctx.sanitize(body.projectContext.name),
                description: ctx.sanitize(body.projectContext.description || ''),
                owner: body.projectContext.owner ? ctx.sanitize(body.projectContext.owner) : undefined,
            },
            technologyName: ctx.sanitize(body.technologyName),
            technologyCategory: body.technologyCategory,
        };

        const analysis = await analyzeEstimation(request);

        console.log(`[ai-consultant] Analysis complete - Assessment: ${analysis.overallAssessment}, Confidence: ${analysis.estimatedConfidence}%`);

        return {
            success: true,
            analysis,
        };
    },
});
