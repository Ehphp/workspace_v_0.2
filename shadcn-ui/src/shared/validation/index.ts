/**
 * Shared Validation Schemas — barrel export
 *
 * All canonical Zod schemas live here and are importable as:
 *   import { PipelineActivitySchema, PresetOutputSchema } from '@/shared/validation'
 */

export {
    PipelineActivitySchema,
    type PipelineActivity,
} from './pipeline-activity.schema';

export {
    PresetOutputSchema,
    type PresetOutput,
} from './preset-output.schema';
