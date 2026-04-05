import { z } from 'zod';

const trimmedString = (max: number, min?: number) => {
  let schema = z.string();
  if (min) {
    schema = schema.min(min, `Min ${min} characters`);
  }
  schema = schema.max(max, `Max ${max} characters`);
  return schema.transform((val) => val.trim());
};

export const projectSchema = z.object({
  name: trimmedString(255, 3),
  description: trimmedString(2000).optional().or(z.literal('')),
  owner: trimmedString(255).optional().or(z.literal('')),
  techPresetId: z.string().uuid({ message: 'Technology is required. Select a default technology for the project.' }),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  projectType: z.enum(['NEW_DEVELOPMENT', 'MAINTENANCE', 'MIGRATION', 'INTEGRATION', 'REFACTORING']).optional().nullable(),
  domain: trimmedString(50).optional().nullable().or(z.literal('')),
  scope: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional().nullable(),
  teamSize: z.number().int().min(1).max(100).optional().nullable(),
  deadlinePressure: z.enum(['RELAXED', 'NORMAL', 'TIGHT', 'CRITICAL']).optional().nullable(),
  methodology: z.enum(['AGILE', 'WATERFALL', 'HYBRID']).optional().nullable(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const requirementSchema = z.object({
  title: trimmedString(300, 3),
  description: trimmedString(4000).optional().or(z.literal('')),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  state: z.enum(['PROPOSED', 'SELECTED', 'SCHEDULED', 'DONE']),
  business_owner: trimmedString(255).optional().or(z.literal('')),
});

export type RequirementFormValues = z.infer<typeof requirementSchema>;
