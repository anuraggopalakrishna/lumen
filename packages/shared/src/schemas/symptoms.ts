import { z } from 'zod';
import { SYMPTOM_CODES } from '../constants.js';
import { integerScale, isoDateTimeSchema, uuidSchema } from '../primitives.js';

export const symptomInputSchema = z.object({
  clientId: uuidSchema,
  occurredAt: isoDateTimeSchema,
  symptomCode: z.enum(SYMPTOM_CODES),
  severity: integerScale(1, 5),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  userLabel: z.string().max(120).optional(),
});
export type SymptomInput = z.infer<typeof symptomInputSchema>;

export const symptomSchema = symptomInputSchema.extend({
  id: uuidSchema,
  createdAt: z.string(),
});
export type Symptom = z.infer<typeof symptomSchema>;

export const symptomQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type SymptomQuery = z.infer<typeof symptomQuerySchema>;
