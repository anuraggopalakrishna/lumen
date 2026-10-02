import type { Activity, ActivityInput } from '@lumen/shared';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { activityEntries, type ActivityEntryRow } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { toLocalDate } from '../../lib/time.js';
import { refreshDailyFeature } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

function toActivity(row: ActivityEntryRow): Activity {
  return {
    id: row.id,
    clientId: row.clientId,
    occurredAt: row.occurredAt.toISOString(),
    activityType: row.activityType as Activity['activityType'],
    userLabel: row.userLabel ?? undefined,
    durationMinutes: row.durationMinutes,
    intensity: row.intensity as Activity['intensity'],
    perceivedExertion: row.perceivedExertion ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ActivityService {
  constructor(private readonly db: Database) {}

  async create(userId: string, input: ActivityInput): Promise<Activity> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);
    const occurredAt = new Date(input.occurredAt);

    const [inserted] = await this.db
      .insert(activityEntries)
      .values({
        userId,
        clientId: input.clientId,
        occurredAt,
        activityType: input.activityType,
        userLabel: input.userLabel ?? null,
        durationMinutes: input.durationMinutes,
        intensity: input.intensity,
        perceivedExertion: input.perceivedExertion ?? null,
      })
      .onConflictDoNothing({
        target: [activityEntries.userId, activityEntries.clientId],
      })
      .returning();

    let row = inserted;
    if (!row) {
      const [existing] = await this.db
        .select()
        .from(activityEntries)
        .where(
          and(
            eq(activityEntries.userId, userId),
            eq(activityEntries.clientId, input.clientId),
          ),
        )
        .limit(1);
      row = existing;
    }
    if (!row) {
      throw new AppError(500, 'write_failed', 'Could not save activity');
    }

    await refreshDailyFeature(
      this.db,
      userId,
      toLocalDate(occurredAt, timezone),
      timezone,
    );
    return toActivity(row);
  }

  async list(
    userId: string,
    range: { from?: string; to?: string },
    limit = 60,
  ): Promise<Activity[]> {
    const filters = [eq(activityEntries.userId, userId)];
    if (range.from) filters.push(gte(activityEntries.occurredAt, new Date(range.from)));
    if (range.to) filters.push(lte(activityEntries.occurredAt, new Date(range.to)));
    const rows = await this.db
      .select()
      .from(activityEntries)
      .where(and(...filters))
      .orderBy(desc(activityEntries.occurredAt))
      .limit(limit);
    return rows.map(toActivity);
  }
}
