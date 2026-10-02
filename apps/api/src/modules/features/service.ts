import {
  FEATURE_VERSION,
  type DailyFeatureValues,
} from '@lumen/shared';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  activityEntries,
  cycleEvents,
  dailyCheckins,
  dailyFeatures,
  sleepEntries,
  symptomEvents,
} from '../../db/schema.js';
import { lastNDates, localDayUtcRange } from '../../lib/time.js';
import { computeDailyFeatureValues } from './calculator.js';
import { estimateCycleContext } from './cycle-calculator.js';

/**
 * Recompute and persist one day's derived features. Called synchronously after a
 * write, and again by the nightly reconciliation job.
 */
export async function refreshDailyFeature(
  db: Database,
  userId: string,
  localDate: string,
  timezone: string,
): Promise<DailyFeatureValues> {
  const { start, end } = localDayUtcRange(localDate, timezone);

  const [checkIn] = await db
    .select()
    .from(dailyCheckins)
    .where(
      and(
        eq(dailyCheckins.userId, userId),
        eq(dailyCheckins.localDate, localDate),
      ),
    )
    .limit(1);

  const sleepRows = await db
    .select()
    .from(sleepEntries)
    .where(
      and(eq(sleepEntries.userId, userId), eq(sleepEntries.sleepDate, localDate)),
    )
    .orderBy(desc(sleepEntries.createdAt));
  const sleep = sleepRows.find((row) => row.source === 'manual') ?? sleepRows[0] ?? null;

  const activities = await db
    .select({ durationMinutes: activityEntries.durationMinutes })
    .from(activityEntries)
    .where(
      and(
        eq(activityEntries.userId, userId),
        gte(activityEntries.occurredAt, start),
        lt(activityEntries.occurredAt, end),
      ),
    );

  const symptoms = await db
    .select({ severity: symptomEvents.severity })
    .from(symptomEvents)
    .where(
      and(
        eq(symptomEvents.userId, userId),
        gte(symptomEvents.occurredAt, start),
        lt(symptomEvents.occurredAt, end),
      ),
    );

  const cycleRows = await db
    .select({
      eventDate: cycleEvents.eventDate,
      eventType: cycleEvents.eventType,
    })
    .from(cycleEvents)
    .where(eq(cycleEvents.userId, userId));

  const cycle = estimateCycleContext(cycleRows, localDate);
  const values = computeDailyFeatureValues({
    checkIn: checkIn
      ? {
          energy: checkIn.energy,
          exhaustion: checkIn.exhaustion,
          mood: checkIn.mood,
          stress: checkIn.stress,
        }
      : null,
    sleep: sleep
      ? { durationMinutes: sleep.durationMinutes, quality: sleep.quality }
      : null,
    activities,
    symptoms,
    cycle,
  });

  await db
    .insert(dailyFeatures)
    .values({
      userId,
      localDate,
      featureVersion: FEATURE_VERSION,
      valuesJson: values,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        dailyFeatures.userId,
        dailyFeatures.localDate,
        dailyFeatures.featureVersion,
      ],
      set: { valuesJson: values, computedAt: new Date() },
    });

  return values;
}

/** Refresh a rolling window ending at `endLocalDate` (inclusive). */
export async function refreshFeatureRange(
  db: Database,
  userId: string,
  endLocalDate: string,
  days: number,
  timezone: string,
): Promise<void> {
  const dates = lastNDates(endLocalDate, days);
  for (const date of dates) {
    await refreshDailyFeature(db, userId, date, timezone);
  }
}
