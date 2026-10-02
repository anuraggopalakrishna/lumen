import { z } from 'zod';
import { localDateSchema } from '../primitives.js';

export const profileSchema = z.object({
  displayName: z.string().max(80).nullable(),
  timezone: z.string().min(1).max(64),
  birthDate: localDateSchema.nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().max(80).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  birthDate: localDateSchema.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const healthPreferencesSchema = z.object({
  goals: z.array(z.string().max(120)).max(20).default([]),
  dietaryConstraints: z.array(z.string().max(120)).max(20).default([]),
  activityConstraints: z.array(z.string().max(120)).max(20).default([]),
  aiSharingEnabled: z.boolean().default(false),
});
export type HealthPreferences = z.infer<typeof healthPreferencesSchema>;

export const updateHealthPreferencesSchema = healthPreferencesSchema.partial();
export type UpdateHealthPreferencesInput = z.infer<
  typeof updateHealthPreferencesSchema
>;
