import { z } from 'zod';
import { ACTIVITY_INTENSITIES, ACTIVITY_TYPES } from '../constants.js';
import { integerScale, isoDateTimeSchema, uuidSchema } from '../primitives.js';

export const activityInputSchema = z.object({
  clientId: uuidSchema,
  occurredAt: isoDateTimeSchema,
  activityType: z.enum(ACTIVITY_TYPES),
  userLabel: z.string().max(120).optional(),
  durationMinutes: z.number().int().min(0).max(1440),
  intensity: z.enum(ACTIVITY_INTENSITIES),
  perceivedExertion: integerScale(1, 10).optional(),
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

export const activitySchema = activityInputSchema.extend({
  id: uuidSchema,
  createdAt: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

export const activityQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
