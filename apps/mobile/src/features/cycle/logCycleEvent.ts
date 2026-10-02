import type { CycleEventInput } from '@lumen/shared';
import * as Crypto from 'expo-crypto';
import { todayLocalDate } from '../../lib/date';
import {
  enqueueMutation,
  saveLocalCycleEvent,
} from '../../services/storage/db';
import { flushQueue } from '../../services/storage/syncQueue';
import type { LocalCycleEvent } from '../../types';

export async function logCycleEvent(
  eventType: LocalCycleEvent['eventType'],
  eventDate: string = todayLocalDate(),
): Promise<void> {
  const now = new Date().toISOString();
  const clientId = Crypto.randomUUID();

  await saveLocalCycleEvent({
    clientId,
    eventDate,
    eventType,
    flow: null,
    createdAt: now,
    synced: false,
  });

  const payload: CycleEventInput = {
    clientId,
    eventDate,
    eventType,
    source: 'user',
  };
  await enqueueMutation({
    id: Crypto.randomUUID(),
    kind: 'cycle_event',
    payload,
    idempotencyKey: `cycle:${clientId}`,
    createdAt: now,
  });

  await flushQueue();
}
