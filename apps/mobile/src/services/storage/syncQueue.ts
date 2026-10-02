import type {
  ActivityInput,
  CheckInInput,
  CycleEventInput,
  SleepInput,
  SymptomInput,
} from '@lumen/shared';
import NetInfo from '@react-native-community/netinfo';
import { ApiError, OfflineError } from '../api/client';
import {
  postActivity,
  postCheckIn,
  postCycleEvent,
  postSleep,
  postSymptom,
} from '../api/healthLog';
import {
  listPendingMutations,
  markCheckInsSynced,
  recordMutationFailure,
  removePendingMutation,
} from './db';
import type { PendingMutation } from '../../types';

async function send(mutation: PendingMutation): Promise<void> {
  switch (mutation.kind) {
    case 'check_in':
      await postCheckIn(
        mutation.payload as CheckInInput,
        mutation.idempotencyKey,
      );
      return;
    case 'cycle_event':
      await postCycleEvent(
        mutation.payload as CycleEventInput,
        mutation.idempotencyKey,
      );
      return;
    case 'activity':
      await postActivity(
        mutation.payload as ActivityInput,
        mutation.idempotencyKey,
      );
      return;
    case 'symptom':
      await postSymptom(
        mutation.payload as SymptomInput,
        mutation.idempotencyKey,
      );
      return;
    case 'sleep':
      await postSleep(
        mutation.payload as SleepInput,
        mutation.idempotencyKey,
      );
      return;
    default:
      throw new Error(`Unknown mutation kind: ${String(mutation.kind)}`);
  }
}

export type SyncOutcome = {
  synced: number;
  remaining: number;
  /** 'offline' when skipped, otherwise the last error message. */
  lastError: string | null;
};

/**
 * Replay queued mutations oldest-first. Stops at the first network failure so
 * ordering is preserved; idempotency keys make replays safe.
 */
export async function flushQueue(): Promise<SyncOutcome> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return {
      synced: 0,
      remaining: (await listPendingMutations()).length,
      lastError: 'offline',
    };
  }

  const pending = await listPendingMutations();
  let synced = 0;
  let lastError: string | null = null;
  let touchedCheckIns = false;

  for (const mutation of pending) {
    try {
      await send(mutation);
      await removePendingMutation(mutation.id);
      synced += 1;
      if (mutation.kind === 'check_in') touchedCheckIns = true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Sync failed';
      if (error instanceof OfflineError) break;
      await recordMutationFailure(mutation.id, lastError);
      const status = error instanceof ApiError ? error.status : undefined;
      // Retry later for transient/server errors; stop on this pass either way.
      if (status === undefined || status >= 500 || status === 429) break;
      // Permanent client errors are retained for inspection but don't block
      // the rest of the queue.
      continue;
    }
  }

  if (touchedCheckIns) await markCheckInsSynced();
  return {
    synced,
    remaining: (await listPendingMutations()).length,
    lastError,
  };
}
