/**
 * Canonical Zod schema for PipelineActivity
 *
 * Single source of truth — consumed by:
 * - src/types/ai-validation.ts (re-export for frontend + unit tests)
 * - netlify/functions/lib/ai/validation/preset-schema.ts (converted to JSON Schema via zod-to-json-schema)
 */

import { z } from 'zod';

export const PipelineActivitySchema = z.object({
    title: z.string().min(10).max(150),
    description: z.string().nullable().optional(),
    group: z.enum(['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE']),
    estimatedHours: z.number().min(1).max(320),
    priority: z.enum(['core', 'recommended', 'optional']),
    confidence: z.number().min(0).max(1).nullable().optional(),
    acceptanceCriteria: z.array(z.string()).nullable().optional(),
    technicalDetails: z.object({
        suggestedFiles: z.array(z.string()).nullable().optional(),
        suggestedCommands: z.array(z.string()).nullable().optional(),
        suggestedTests: z.array(z.string()).nullable().optional(),
        dependencies: z.array(z.string()).nullable().optional(),
    }).nullable().optional(),
    estimatedHoursJustification: z.string().nullable().optional(),
});

export type PipelineActivity = z.infer<typeof PipelineActivitySchema>;
