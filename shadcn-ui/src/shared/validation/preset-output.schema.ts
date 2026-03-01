/**
 * Canonical Zod schema for PresetOutput
 *
 * Single source of truth — replaces the manual AJV JSON Schema in preset-schema.ts.
 * Use `zodToJsonSchema(PresetOutputSchema)` when AJV validation is needed at runtime.
 */

import { z } from 'zod';
import { PipelineActivitySchema } from './pipeline-activity.schema';

export const PresetOutputSchema = z.object({
    name: z.string().min(5).max(100),
    description: z.string().min(20).max(500),
    detailedDescription: z.string().min(100).max(2000),
    techCategory: z.enum(['FRONTEND', 'BACKEND', 'MULTI']),
    activities: z.array(PipelineActivitySchema).min(5).max(20),
    driverValues: z.record(z.number()),
    riskCodes: z.array(z.string()),
    reasoning: z.string().min(50).max(2000),
    confidence: z.number().min(0).max(1),
});

export type PresetOutput = z.infer<typeof PresetOutputSchema>;
