import { z } from 'zod';
import { localDateSchema } from '../primitives.js';
import { cycleContextSchema } from './dashboard.js';

/**
 * The derived, versioned snapshot persisted in `daily_features.values_json`.
 * Everything here is rebuildable from canonical events.
 */
export const dailyFeatureValuesSchema = z.object({
  energy: z.number().nullable(),
  exhaustion: z.number().nullable(),
  mood: z.number().nullable(),
  stress: z.number().nullable(),
  sleepMinutes: z.number().nullable(),
  sleepQuality: z.number().nullable(),
  movementMinutes: z.number().nullable(),
  symptomCount: z.number().int(),
  symptomSeverityAvg: z.number().nullable(),
  cycle: cycleContextSchema,
});
export type DailyFeatureValues = z.infer<typeof dailyFeatureValuesSchema>;

export const dailyFeatureSchema = z.object({
  userId: z.string().uuid(),
  localDate: localDateSchema,
  featureVersion: z.string(),
  values: dailyFeatureValuesSchema,
  computedAt: z.string(),
});
export type DailyFeature = z.infer<typeof dailyFeatureSchema>;
