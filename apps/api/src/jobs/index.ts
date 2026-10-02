import { and, eq, inArray, lt, ne } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  activityEntries,
  auditEvents,
  consents,
  cycleEvents,
  dailyCheckins,
  dailyFeatures,
  deletionRequests,
  devices,
  healthPreferences,
  idempotencyKeys,
  profiles,
  recommendationFeedback,
  recommendationRuns,
  recommendations,
  sessions,
  sleepEntries,
  symptomEvents,
  users,
} from '../db/schema.js';
import { todayInTimeZone } from '../lib/time.js';
import { refreshDailyFeature } from '../modules/features/service.js';

/** Rebuild the day's derived snapshot for every active user. */
export async function reconcileDailyFeatures(db: Database): Promise<number> {
  const rows = await db
    .select({
      id: users.id,
      timezone: profiles.timezone,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(ne(users.status, 'deleted'));

  for (const row of rows) {
    const timezone = row.timezone ?? 'UTC';
    await refreshDailyFeature(db, row.id, todayInTimeZone(timezone), timezone);
  }
  return rows.length;
}

/** Expire suggestions that have passed their window. */
export async function expireRecommendations(db: Database): Promise<number> {
  const expired = await db
    .update(recommendations)
    .set({ status: 'expired' })
    .where(
      and(
        eq(recommendations.status, 'active'),
        lt(recommendations.expiresAt, new Date()),
      ),
    )
    .returning({ id: recommendations.id });
  return expired.length;
}

/**
 * Execute verified deletion requests: erase user-owned health records, anonymize
 * the account row, and mark the request complete for an auditable trail.
 */
export async function processDeletionRequests(db: Database): Promise<number> {
  const pending = await db
    .select()
    .from(deletionRequests)
    .where(inArray(deletionRequests.status, ['pending', 'in_progress']));

  for (const request of pending) {
    await db.transaction(async (tx) => {
      const userId = request.userId;
      await tx
        .delete(recommendationFeedback)
        .where(eq(recommendationFeedback.userId, userId));
      await tx.delete(recommendations).where(eq(recommendations.userId, userId));
      await tx
        .delete(recommendationRuns)
        .where(eq(recommendationRuns.userId, userId));
      await tx.delete(dailyFeatures).where(eq(dailyFeatures.userId, userId));
      await tx.delete(sleepEntries).where(eq(sleepEntries.userId, userId));
      await tx
        .delete(activityEntries)
        .where(eq(activityEntries.userId, userId));
      await tx.delete(symptomEvents).where(eq(symptomEvents.userId, userId));
      await tx.delete(cycleEvents).where(eq(cycleEvents.userId, userId));
      await tx.delete(dailyCheckins).where(eq(dailyCheckins.userId, userId));
      await tx.delete(consents).where(eq(consents.userId, userId));
      await tx
        .delete(healthPreferences)
        .where(eq(healthPreferences.userId, userId));
      await tx.delete(profiles).where(eq(profiles.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(devices).where(eq(devices.userId, userId));
      await tx.delete(auditEvents).where(eq(auditEvents.userId, userId));
      await tx
        .delete(idempotencyKeys)
        .where(eq(idempotencyKeys.userId, userId));

      await tx
        .update(users)
        .set({
          email: `deleted+${userId}@lumen.invalid`,
          passwordHash: '',
          status: 'deleted',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await tx
        .update(deletionRequests)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(deletionRequests.id, request.id));
    });
  }
  return pending.length;
}

export async function runScheduledJobs(db: Database): Promise<void> {
  await expireRecommendations(db);
  await processDeletionRequests(db);
  await reconcileDailyFeatures(db);
}
