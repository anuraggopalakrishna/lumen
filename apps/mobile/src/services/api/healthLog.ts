import type {
  Activity,
  ActivityInput,
  CheckIn,
  CheckInInput,
  CycleEvent,
  CycleEventInput,
  DashboardToday,
  Sleep,
  SleepInput,
  Symptom,
  SymptomInput,
} from '@lumen/shared';
import { apiFetch } from './client';

export function postCheckIn(
  input: CheckInInput,
  idempotencyKey: string,
): Promise<CheckIn> {
  return apiFetch<CheckIn>('/v1/check-ins', {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function postCycleEvent(
  input: CycleEventInput,
  idempotencyKey: string,
): Promise<CycleEvent> {
  return apiFetch<CycleEvent>('/v1/cycle-events', {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function postActivity(
  input: ActivityInput,
  idempotencyKey: string,
): Promise<Activity> {
  return apiFetch<Activity>('/v1/activities', {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function postSymptom(
  input: SymptomInput,
  idempotencyKey: string,
): Promise<Symptom> {
  return apiFetch<Symptom>('/v1/symptoms', {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function postSleep(
  input: SleepInput,
  idempotencyKey: string,
): Promise<Sleep> {
  return apiFetch<Sleep>('/v1/sleep', {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function getDashboard(date?: string): Promise<DashboardToday> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<DashboardToday>(`/v1/dashboard/today${query}`);
}
