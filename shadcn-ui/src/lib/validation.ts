import { z } from 'zod';

const trimmedString = (max: number, min?: number) => {
  let schema = z.string();
  if (min) {
    schema = schema.min(min, `Min ${min} characters`);
  }
  schema = schema.max(max, `Max ${max} characters`);
  return schema.transform((val) => val.trim());
};

export const listSchema = z.object({
  name: trimmedString(255, 3),
  description: trimmedString(2000).optional().or(z.literal('')),
  owner: trimmedString(255).optional().or(z.literal('')),
  techPresetId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

export type ListFormValues = z.infer<typeof listSchema>;

export const requirementSchema = z.object({
  title: trimmedString(300, 3),
  description: trimmedString(4000).optional().or(z.literal('')),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  state: z.enum(['PROPOSED', 'SELECTED', 'SCHEDULED', 'DONE']),
  business_owner: trimmedString(255).optional().or(z.literal('')),
});

export type RequirementFormValues = z.infer<typeof requirementSchema>;
