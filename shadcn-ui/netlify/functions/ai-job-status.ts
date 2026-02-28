import { createAIHandler } from './lib/handler';
import { getJob } from './lib/ai/job-manager';

export const handler = createAIHandler<{ id?: string }>({
    name: 'ai-job-status',
    requireAuth: false,
    requireLLM: false,
    allowMethod: 'GET',
    validateBody: (body) => {
        if (!body.id) return 'Missing job ID (id parameter)';
        return null;
    },
    handler: async (body) => {
        const job = await getJob(body.id!);
        if (!job) {
            return {
                success: false,
                status: 'NOT_FOUND',
                error: 'Job non trovato o scaduto'
            };
        }

        return {
            success: true,
            jobId: job.id,
            status: job.status,
            result: job.result,
            error: job.error
        };
    }
});
