import type {
  HealthPreferences,
  UpdateHealthPreferencesInput,
} from '@lumen/shared';
import { apiFetch } from './client';

export function getHealthPreferences(): Promise<{
  preferences: HealthPreferences;
}> {
  return apiFetch<{ preferences: HealthPreferences }>('/v1/health-preferences');
}

export function updateHealthPreferences(
  input: UpdateHealthPreferencesInput,
): Promise<{ preferences: HealthPreferences }> {
  return apiFetch<{ preferences: HealthPreferences }>('/v1/health-preferences', {
    method: 'PUT',
    body: input,
  });
}
