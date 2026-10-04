/**
 * Shared vocabulary. Codes are stored canonically; labels are presentation-only
 * and may be localized later without migrating stored data.
 */

export const CONSENT_PURPOSES = [
  'account_operation',
  'ai_processing',
  'notifications',
  'sharing',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  account_operation: 'Account operation',
  ai_processing: 'AI processing',
  notifications: 'Notifications',
  sharing: 'Future sharing',
};

/** Bump when the text a user agreed to materially changes. */
export const CURRENT_POLICY_VERSION = '2026-10-01';

export const CYCLE_EVENT_TYPES = [
  'period_start',
  'period_end',
  'spotting',
] as const;
export type CycleEventType = (typeof CYCLE_EVENT_TYPES)[number];

export const CYCLE_FLOWS = ['none', 'light', 'medium', 'heavy'] as const;
export type CycleFlow = (typeof CYCLE_FLOWS)[number];

export const CYCLE_SOURCES = ['user', 'estimate'] as const;
export type CycleSource = (typeof CYCLE_SOURCES)[number];

/** Derived state of recent wellbeing, shared by the API and device. */
export const WELLBEING_STATES = [
  'no_data',
  'steady',
  'low',
  'recovering',
  'prolonged_low',
] as const;
export type WellbeingState = (typeof WELLBEING_STATES)[number];

export const ACTIVITY_TYPES = [
  'rest',
  'walk',
  'yoga',
  'strength',
  'run',
  'cycle',
  'swim',
  'other',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_INTENSITIES = ['low', 'moderate', 'high'] as const;
export type ActivityIntensity = (typeof ACTIVITY_INTENSITIES)[number];

export const SLEEP_SOURCES = ['manual', 'wearable'] as const;
export type SleepSource = (typeof SLEEP_SOURCES)[number];

export const SYMPTOM_CODES = [
  'cramping',
  'headache',
  'low_mood',
  'bloating',
  'sore_throat',
  'nausea',
  'fatigue',
  'back_pain',
  'breast_tenderness',
  'anxiety',
  'insomnia',
  'dizziness',
] as const;
export type SymptomCode = (typeof SYMPTOM_CODES)[number];

export const SYMPTOM_LABELS: Record<SymptomCode, string> = {
  cramping: 'Cramping',
  headache: 'Headache',
  low_mood: 'Low mood',
  bloating: 'Bloating',
  sore_throat: 'Sore throat',
  nausea: 'Nausea',
  fatigue: 'Fatigue',
  back_pain: 'Back pain',
  breast_tenderness: 'Breast tenderness',
  anxiety: 'Anxiety',
  insomnia: 'Insomnia',
  dizziness: 'Dizziness',
};

export const SUGGESTION_CATEGORIES = [
  'movement',
  'food',
  'recovery',
  'practice',
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_CONFIDENCES = ['low', 'medium', 'high'] as const;
export type SuggestionConfidence = (typeof SUGGESTION_CONFIDENCES)[number];

export const HELPFULNESS_VALUES = ['helpful', 'not_helpful'] as const;
export type Helpfulness = (typeof HELPFULNESS_VALUES)[number];

export const ACTION_TAKEN_VALUES = ['acted', 'skipped', 'none'] as const;
export type ActionTaken = (typeof ACTION_TAKEN_VALUES)[number];

export const USER_STATUSES = ['active', 'deletion_pending', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const FEATURE_VERSION = 'v1';
export const DISCLAIMER =
  'Lumen offers wellbeing guidance, not medical advice. It cannot diagnose or treat any condition.';
