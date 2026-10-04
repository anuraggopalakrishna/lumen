import * as Crypto from 'expo-crypto';
import type {
  ActivityInput,
  ActivityType,
  CheckInInput,
  SleepInput,
  SymptomInput,
} from '@lumen/shared';
import type { CheckInDraft } from '../../types';
import { enqueueMutation, saveLocalCheckIn } from '../../services/storage/db';
import { flushQueue } from '../../services/storage/syncQueue';

function activityIntensity(movement: ActivityType): ActivityInput['intensity'] {
  return movement === 'strength' ||
    movement === 'run' ||
    movement === 'cycle' ||
    movement === 'swim'
    ? 'moderate'
    : 'low';
}

function occurredAtFor(localDate: string): string {
  return new Date(`${localDate}T12:00:00`).toISOString();
}

/**
 * Persist a check-in locally first, then queue the canonical server writes.
 * Nothing waits on the network, so a check-in is never lost offline.
 */
export async function saveCheckIn(draft: CheckInDraft): Promise<void> {
  const now = new Date().toISOString();
  const checkInClientId = Crypto.randomUUID();

  // Canonical multi-activity list; fall back to the legacy single fields.
  // 'rest' is never a queued activity — it means no activity.
  const activities = (
    draft.activities.length > 0
      ? draft.activities
      : draft.movement !== 'rest' && draft.durationMinutes > 0
        ? [{ type: draft.movement, durationMinutes: draft.durationMinutes }]
        : []
  ).filter((entry) => entry.type !== 'rest' && entry.durationMinutes > 0);
  const primary = activities[0];
  const totalMinutes = activities.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );

  await saveLocalCheckIn({
    ...draft,
    activities,
    movement: primary ? primary.type : 'rest',
    durationMinutes: primary ? totalMinutes : 0,
    clientId: checkInClientId,
    updatedAt: now,
    synced: false,
  });

  const checkInPayload: CheckInInput = {
    clientId: checkInClientId,
    localDate: draft.localDate,
    energy: draft.energy,
    exhaustion: draft.exhaustion,
    mood: draft.mood,
    stress: draft.stress,
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  };
  await enqueueMutation({
    id: Crypto.randomUUID(),
    kind: 'check_in',
    payload: checkInPayload,
    idempotencyKey: `checkin:${checkInClientId}`,
    createdAt: now,
  });

  for (const entry of activities) {
    if (entry.durationMinutes <= 0) continue;
    const activityPayload: ActivityInput = {
      clientId: Crypto.randomUUID(),
      occurredAt: occurredAtFor(draft.localDate),
      activityType: entry.type,
      durationMinutes: entry.durationMinutes,
      intensity: activityIntensity(entry.type),
    };
    await enqueueMutation({
      id: Crypto.randomUUID(),
      kind: 'activity',
      payload: activityPayload,
      idempotencyKey: `activity:${activityPayload.clientId}`,
      createdAt: now,
    });
  }

  if (draft.sleepHours > 0) {
    const sleepPayload: SleepInput = {
      clientId: Crypto.randomUUID(),
      sleepDate: draft.localDate,
      durationMinutes: Math.round(draft.sleepHours * 60),
      quality: draft.sleepQuality,
      source: 'manual',
    };
    await enqueueMutation({
      id: Crypto.randomUUID(),
      kind: 'sleep',
      payload: sleepPayload,
      idempotencyKey: `sleep:${sleepPayload.clientId}`,
      createdAt: now,
    });
  }

  for (const symptomCode of draft.symptoms) {
    const symptomPayload: SymptomInput = {
      clientId: Crypto.randomUUID(),
      occurredAt: occurredAtFor(draft.localDate),
      symptomCode,
      severity: 3,
    };
    await enqueueMutation({
      id: Crypto.randomUUID(),
      kind: 'symptom',
      payload: symptomPayload,
      idempotencyKey: `symptom:${symptomPayload.clientId}`,
      createdAt: now,
    });
  }

  // Best-effort immediate flush; failures remain queued.
  await flushQueue();
}
