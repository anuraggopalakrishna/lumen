import type { ConsentPurpose, ConsentState } from '@lumen/shared';
import { apiFetch } from './client';

export function listConsents(): Promise<{ consents: ConsentState[] }> {
  return apiFetch<{ consents: ConsentState[] }>('/v1/consents');
}

export function setConsent(
  purpose: ConsentPurpose,
  granted: boolean,
  policyVersion: string,
): Promise<{ consents: ConsentState[] }> {
  return apiFetch<{ consents: ConsentState[] }>(`/v1/consents/${purpose}`, {
    method: 'PUT',
    body: { granted, policyVersion },
  });
}
