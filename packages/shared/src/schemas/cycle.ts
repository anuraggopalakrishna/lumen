import { z } from 'zod';
import {
  CYCLE_EVENT_TYPES,
  CYCLE_FLOWS,
  CYCLE_SOURCES,
} from '../constants.js';
import { localDateSchema, uuidSchema } from '../primitives.js';

export const cycleEventInputSchema = z.object({
  clientId: uuidSchema,
  eventDate: localDateSchema,
  eventType: z.enum(CYCLE_EVENT_TYPES),
  flow: z.enum(CYCLE_FLOWS).optional(),
  source: z.enum(CYCLE_SOURCES).default('user'),
  confidence: z.number().min(0).max(1).optional(),
  note: z.string().max(500).optional(),
  /** When correcting history, points at the event being replaced. */
  correctsEventId: uuidSchema.optional(),
});
export type CycleEventInput = z.infer<typeof cycleEventInputSchema>;

export const cycleEventSchema = cycleEventInputSchema.extend({
  id: uuidSchema,
  createdAt: z.string(),
});
export type CycleEvent = z.infer<typeof cycleEventSchema>;

export const cycleQuerySchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
});
export type CycleQuery = z.infer<typeof cycleQuerySchema>;
