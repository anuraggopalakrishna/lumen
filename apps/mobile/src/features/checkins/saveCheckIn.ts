import * as Crypto from 'expo-crypto';
import type {
  ActivityInput,
  CheckInInput,
  SleepInput,
  SymptomInput,
} from '@lumen/shared';
import type { CheckInDraft } from '../../types';
import { enqueueMutation, saveLocalCheckIn } from '../../services/storage/db';
import { flushQueue } from '../../services/storage/syncQueue';

function activityIntensity(movement: CheckInDraft['movement']): ActivityInput['intensity'] {
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

  await saveLocalCheckIn({
    ...draft,
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

  if (draft.movement !== 'rest' && draft.durationMinutes > 0) {
    const activityPayload: ActivityInput = {
      clientId: Crypto.randomUUID(),
      occurredAt: occurredAtFor(draft.localDate),
      activityType: draft.movement,
      durationMinutes: draft.durationMinutes,
      intensity: activityIntensity(draft.movement),
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
