import type {
  DailyFeatureValues,
  Suggestion,
} from '@lumen/shared';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Canonical data model (§7). All user-owned records carry user_id and are scoped
 * by the authenticated session. Instants are TIMESTAMPTZ; day-scoped records keep
 * a local_date DATE so cycle logic never depends on server time.
 */

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('unknown'),
    pushToken: text('push_token'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('devices_user_idx').on(t.userId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_token_idx').on(t.refreshTokenHash),
  ],
);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  timezone: text('timezone').notNull().default('UTC'),
  birthDate: date('birth_date'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    policyVersion: text('policy_version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('consents_user_purpose_idx').on(t.userId, t.purpose)],
);

export const healthPreferences = pgTable('health_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  goals: jsonb('goals').$type<string[]>().notNull().default([]),
  dietaryConstraints: jsonb('dietary_constraints')
    .$type<string[]>()
    .notNull()
    .default([]),
  activityConstraints: jsonb('activity_constraints')
    .$type<string[]>()
    .notNull()
    .default([]),
  aiSharingEnabled: boolean('ai_sharing_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const dailyCheckins = pgTable(
  'daily_checkins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    localDate: date('local_date').notNull(),
    energy: integer('energy').notNull(),
    exhaustion: integer('exhaustion').notNull(),
    mood: integer('mood').notNull(),
    stress: integer('stress').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('daily_checkins_user_day_idx').on(t.userId, t.localDate),
    uniqueIndex('daily_checkins_user_client_idx').on(t.userId, t.clientId),
  ],
);

export const cycleEvents = pgTable(
  'cycle_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    eventDate: date('event_date').notNull(),
    eventType: text('event_type').notNull(),
    flow: text('flow'),
    source: text('source').notNull().default('user'),
    confidence: real('confidence'),
    note: text('note'),
    correctsEventId: uuid('corrects_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('cycle_events_user_client_idx').on(t.userId, t.clientId),
    index('cycle_events_user_date_idx').on(t.userId, t.eventDate),
  ],
);

export const symptomEvents = pgTable(
  'symptom_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    symptomCode: text('symptom_code').notNull(),
    severity: integer('severity').notNull(),
    durationMinutes: integer('duration_minutes'),
    userLabel: text('user_label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('symptom_events_user_client_idx').on(t.userId, t.clientId),
    index('symptom_events_user_time_idx').on(t.userId, t.occurredAt),
  ],
);

export const activityEntries = pgTable(
  'activity_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    activityType: text('activity_type').notNull(),
    userLabel: text('user_label'),
    durationMinutes: integer('duration_minutes').notNull(),
    intensity: text('intensity').notNull(),
    perceivedExertion: integer('perceived_exertion'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('activity_entries_user_client_idx').on(t.userId, t.clientId),
    index('activity_entries_user_time_idx').on(t.userId, t.occurredAt),
  ],
);

export const sleepEntries = pgTable(
  'sleep_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    sleepDate: date('sleep_date').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    quality: integer('quality').notNull(),
    source: text('source').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('sleep_entries_user_client_idx').on(t.userId, t.clientId),
    uniqueIndex('sleep_entries_user_day_source_idx').on(
      t.userId,
      t.sleepDate,
      t.source,
    ),
    index('sleep_entries_user_day_idx').on(t.userId, t.sleepDate),
  ],
);

export const dailyFeatures = pgTable(
  'daily_features',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    featureVersion: text('feature_version').notNull(),
    valuesJson: jsonb('values_json').$type<DailyFeatureValues>().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('daily_features_user_day_version_idx').on(
      t.userId,
      t.localDate,
      t.featureVersion,
    ),
    index('daily_features_user_day_idx').on(t.userId, t.localDate),
  ],
);

export const modelVersions = pgTable('model_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  ollamaModelRef: text('ollama_model_ref').notNull(),
  modelDigest: text('model_digest').notNull(),
  modelfileVersion: text('modelfile_version').notNull(),
  optionsJson: jsonb('options_json').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('candidate'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const recommendationRuns = pgTable(
  'recommendation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    featureVersion: text('feature_version').notNull(),
    policyVersion: text('policy_version').notNull(),
    modelVersionId: uuid('model_version_id').references(() => modelVersions.id, {
      onDelete: 'set null',
    }),
    promptVersion: text('prompt_version').notNull(),
    schemaVersion: text('schema_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('recommendation_runs_user_idx').on(t.userId)],
);

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => recommendationRuns.id, {
      onDelete: 'set null',
    }),
    category: text('category').notNull(),
    suggestionJson: jsonb('suggestion_json').$type<Suggestion>().notNull(),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('recommendations_user_status_idx').on(
      t.userId,
      t.status,
      t.expiresAt,
    ),
  ],
);

export const recommendationFeedback = pgTable(
  'recommendation_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recommendationId: uuid('recommendation_id')
      .notNull()
      .references(() => recommendations.id, { onDelete: 'cascade' }),
    helpfulness: text('helpfulness').notNull(),
    actionTaken: text('action_taken').notNull().default('none'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('recommendation_feedback_user_idx').on(t.userId)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('audit_events_user_time_idx').on(t.userId, t.occurredAt)],
);

export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
  },
  (t) => [index('deletion_requests_status_idx').on(t.status)],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code').notNull(),
    responseJson: jsonb('response_json').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex('idempotency_keys_user_key_idx').on(t.userId, t.key)],
);

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type DailyCheckinRow = typeof dailyCheckins.$inferSelect;
export type CycleEventRow = typeof cycleEvents.$inferSelect;
export type SymptomEventRow = typeof symptomEvents.$inferSelect;
export type ActivityEntryRow = typeof activityEntries.$inferSelect;
export type SleepEntryRow = typeof sleepEntries.$inferSelect;
export type RecommendationRow = typeof recommendations.$inferSelect;
