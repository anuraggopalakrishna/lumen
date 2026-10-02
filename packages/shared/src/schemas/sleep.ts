import { z } from 'zod';
import { SLEEP_SOURCES } from '../constants.js';
import { integerScale, localDateSchema, uuidSchema } from '../primitives.js';

export const sleepInputSchema = z.object({
  clientId: uuidSchema,
  sleepDate: localDateSchema,
  durationMinutes: z.number().int().min(0).max(1440),
  quality: integerScale(1, 5),
  source: z.enum(SLEEP_SOURCES).default('manual'),
});
export type SleepInput = z.infer<typeof sleepInputSchema>;

export const sleepSchema = sleepInputSchema.extend({
  id: uuidSchema,
  createdAt: z.string(),
});
export type Sleep = z.infer<typeof sleepSchema>;

export const sleepQuerySchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
});
export type SleepQuery = z.infer<typeof sleepQuerySchema>;
