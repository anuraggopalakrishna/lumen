import { z } from 'zod';
import { CONSENT_PURPOSES } from '../constants.js';

export const consentPurposeSchema = z.enum(CONSENT_PURPOSES);

export const consentDecisionSchema = z.object({
  granted: z.boolean(),
  policyVersion: z.string().min(1).max(64),
});

export const consentStateSchema = z.object({
  purpose: consentPurposeSchema,
  granted: z.boolean(),
  policyVersion: z.string().nullable(),
  grantedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});

export const consentListSchema = z.object({
  consents: z.array(consentStateSchema),
});

export type ConsentDecisionInput = z.infer<typeof consentDecisionSchema>;
export type ConsentState = z.infer<typeof consentStateSchema>;
