import * as SQLite from 'expo-sqlite';
import type {
  LocalCheckIn,
  LocalCycleEvent,
  MutationKind,
  PendingMutation,
} from '../../types';

/**
 * Local, offline-first store. It mirrors what the user needs to read and write
 * without a connection: the aggregate daily check-in plus an ordered queue of
 * mutations to replay idempotently. The backend remains the source of truth
 * after sync.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('lumen.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_checkins (
      local_date TEXT PRIMARY KEY NOT NULL,
      energy INTEGER NOT NULL,
      exhaustion INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      stress INTEGER NOT NULL,
      movement TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      sleep_hours REAL NOT NULL,
      sleep_quality INTEGER NOT NULL,
      symptoms TEXT NOT NULL,
      note TEXT NOT NULL,
      client_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS local_cycle_events (
      client_id TEXT PRIMARY KEY NOT NULL,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      flow TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

type CheckInRow = {
  local_date: string;
  energy: number;
  exhaustion: number;
  mood: number;
  stress: number;
  movement: string;
  duration_minutes: number;
  sleep_hours: number;
  sleep_quality: number;
  symptoms: string;
  note: string;
  client_id: string;
  updated_at: string;
  synced: number;
};

function rowToCheckIn(row: CheckInRow): LocalCheckIn {
  return {
    localDate: row.local_date,
    energy: row.energy,
    exhaustion: row.exhaustion,
    mood: row.mood,
    stress: row.stress,
    movement: row.movement as LocalCheckIn['movement'],
    durationMinutes: row.duration_minutes,
    sleepHours: row.sleep_hours,
    sleepQuality: row.sleep_quality,
    symptoms: JSON.parse(row.symptoms) as LocalCheckIn['symptoms'],
    note: row.note,
    clientId: row.client_id,
    updatedAt: row.updated_at,
    synced: row.synced === 1,
  };
}

export async function saveLocalCheckIn(record: LocalCheckIn): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_checkins
      (local_date, energy, exhaustion, mood, stress, movement, duration_minutes,
       sleep_hours, sleep_quality, symptoms, note, client_id, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(local_date) DO UPDATE SET
       energy = excluded.energy,
       exhaustion = excluded.exhaustion,
       mood = excluded.mood,
       stress = excluded.stress,
       movement = excluded.movement,
       duration_minutes = excluded.duration_minutes,
       sleep_hours = excluded.sleep_hours,
       sleep_quality = excluded.sleep_quality,
       symptoms = excluded.symptoms,
       note = excluded.note,
       client_id = excluded.client_id,
       updated_at = excluded.updated_at,
       synced = excluded.synced`,
    record.localDate,
    record.energy,
    record.exhaustion,
    record.mood,
    record.stress,
    record.movement,
    record.durationMinutes,
    record.sleepHours,
    record.sleepQuality,
    JSON.stringify(record.symptoms),
    record.note,
    record.clientId,
    record.updatedAt,
    record.synced ? 1 : 0,
  );
}

export async function getLocalCheckIn(
  localDate: string,
): Promise<LocalCheckIn | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CheckInRow>(
    'SELECT * FROM local_checkins WHERE local_date = ?',
    localDate,
  );
  return row ? rowToCheckIn(row) : null;
}

export async function listLocalCheckIns(limit = 60): Promise<LocalCheckIn[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckInRow>(
    'SELECT * FROM local_checkins ORDER BY local_date DESC LIMIT ?',
    limit,
  );
  return rows.map(rowToCheckIn);
}

export async function markCheckInsSynced(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE local_checkins SET synced = 1 WHERE synced = 0');
}

type CycleRow = {
  client_id: string;
  event_date: string;
  event_type: string;
  flow: string | null;
  created_at: string;
  synced: number;
};

export async function saveLocalCycleEvent(
  event: LocalCycleEvent,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO local_cycle_events
      (client_id, event_date, event_type, flow, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?)`,
    event.clientId,
    event.eventDate,
    event.eventType,
    event.flow,
    event.createdAt,
    event.synced ? 1 : 0,
  );
}

export async function listLocalCycleEvents(): Promise<LocalCycleEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CycleRow>(
    'SELECT * FROM local_cycle_events ORDER BY event_date ASC',
  );
  return rows.map((row) => ({
    clientId: row.client_id,
    eventDate: row.event_date,
    eventType: row.event_type as LocalCycleEvent['eventType'],
    flow: row.flow as LocalCycleEvent['flow'],
    createdAt: row.created_at,
    synced: row.synced === 1,
  }));
}

export async function deleteLocalCycleEvent(clientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM local_cycle_events WHERE client_id = ?',
    clientId,
  );
}

type MutationRow = {
  id: string;
  kind: string;
  payload: string;
  idempotency_key: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

export async function enqueueMutation(
  mutation: Omit<PendingMutation, 'attempts' | 'lastError'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO pending_mutations
      (id, kind, payload, idempotency_key, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    mutation.id,
    mutation.kind,
    JSON.stringify(mutation.payload),
    mutation.idempotencyKey,
    mutation.createdAt,
  );
}

export async function listPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MutationRow>(
    'SELECT * FROM pending_mutations ORDER BY created_at ASC',
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as MutationKind,
    payload: JSON.parse(row.payload) as unknown,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

export async function removePendingMutation(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', id);
}

export async function recordMutationFailure(
  id: string,
  error: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE pending_mutations SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    error,
    id,
  );
}

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
