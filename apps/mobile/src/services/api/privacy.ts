import type { ExportEnvelope } from '@lumen/shared';
import { apiFetch } from './client';

export function exportData(): Promise<ExportEnvelope> {
  return apiFetch<ExportEnvelope>('/v1/privacy/export');
}

export function deleteAccount(): Promise<{
  deletionRequest: { id: string; status: string };
}> {
  return apiFetch('/v1/account', { method: 'DELETE' });
}
