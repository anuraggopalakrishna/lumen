import { z } from 'zod';
import { integerScale, localDateSchema, uuidSchema } from '../primitives.js';

/**
 * A daily check-in. `clientId` is generated on the device so offline retries are
 * idempotent; combined with the unique (user_id, local_date) index it also acts
 * as an upsert key for correcting the same day.
 */
export const checkInInputSchema = z.object({
  clientId: uuidSchema,
  localDate: localDateSchema,
  energy: integerScale(1, 5),
  exhaustion: integerScale(1, 5),
  mood: integerScale(1, 5),
  stress: integerScale(1, 5),
  note: z.string().max(2000).optional(),
});
export type CheckInInput = z.infer<typeof checkInInputSchema>;

export const checkInSchema = checkInInputSchema.extend({
  id: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CheckIn = z.infer<typeof checkInSchema>;

export const checkInQuerySchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
});
export type CheckInQuery = z.infer<typeof checkInQuerySchema>;
