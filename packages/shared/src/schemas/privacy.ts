import { z } from 'zod';

export const deletionRequestSchema = z.object({
  id: z.string().uuid(),
  requestedAt: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  completedAt: z.string().nullable(),
});
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;

export const exportEnvelopeSchema = z.object({
  formatVersion: z.string(),
  generatedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    status: z.string(),
    createdAt: z.string(),
  }),
  profile: z.unknown().nullable(),
  consents: z.array(z.unknown()),
  healthPreferences: z.unknown().nullable(),
  checkIns: z.array(z.unknown()),
  cycleEvents: z.array(z.unknown()),
  symptoms: z.array(z.unknown()),
  activities: z.array(z.unknown()),
  sleep: z.array(z.unknown()),
  dailyFeatures: z.array(z.unknown()),
  recommendations: z.array(z.unknown()),
  recommendationFeedback: z.array(z.unknown()),
  auditEvents: z.array(z.unknown()),
});
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

export const EXPORT_FORMAT_VERSION = '1';
