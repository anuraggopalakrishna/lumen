import type { ActivityType, SymptomCode } from '@lumen/shared';

export type NavTab = 'Today' | 'History' | 'Insights' | 'Profile';

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
};

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'localOnly';

export type ActivityEntry = {
  type: ActivityType;
  durationMinutes: number;
};

/** The in-progress daily check-in shown in the sheet. */
export type CheckInDraft = {
  localDate: string;
  energy: number;
  exhaustion: number;
  mood: number;
  stress: number;
  movement: ActivityType;
  durationMinutes: number;
  activities: ActivityEntry[];
  sleepHours: number;
  sleepQuality: number;
  symptoms: SymptomCode[];
  note: string;
};

export type LocalCheckIn = CheckInDraft & {
  clientId: string;
  updatedAt: string;
  synced: boolean;
};

export type LocalCycleEvent = {
  clientId: string;
  eventDate: string;
  eventType: 'period_start' | 'period_end' | 'spotting';
  flow: 'none' | 'light' | 'medium' | 'heavy' | null;
  createdAt: string;
  synced: boolean;
};

export type PendingMutation = {
  id: string;
  kind: MutationKind;
  payload: unknown;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

export type MutationKind =
  | 'check_in'
  | 'cycle_event'
  | 'activity'
  | 'symptom'
  | 'sleep';
