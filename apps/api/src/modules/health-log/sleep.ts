import type { Sleep, SleepInput } from '@lumen/shared';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { sleepEntries, type SleepEntryRow } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { refreshDailyFeature } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

function toSleep(row: SleepEntryRow): Sleep {
  return {
    id: row.id,
    clientId: row.clientId,
    sleepDate: row.sleepDate,
    durationMinutes: row.durationMinutes,
    quality: row.quality,
    source: row.source as Sleep['source'],
    createdAt: row.createdAt.toISOString(),
  };
}

export class SleepService {
  constructor(private readonly db: Database) {}

  async upsert(userId: string, input: SleepInput): Promise<Sleep> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);
    const [row] = await this.db
      .insert(sleepEntries)
      .values({
        userId,
        clientId: input.clientId,
        sleepDate: input.sleepDate,
        durationMinutes: input.durationMinutes,
        quality: input.quality,
        source: input.source,
      })
      .onConflictDoUpdate({
        target: [
          sleepEntries.userId,
          sleepEntries.sleepDate,
          sleepEntries.source,
        ],
        set: {
          clientId: input.clientId,
          durationMinutes: input.durationMinutes,
          quality: input.quality,
        },
      })
      .returning();
    if (!row) throw new AppError(500, 'write_failed', 'Could not save sleep');

    await refreshDailyFeature(this.db, userId, input.sleepDate, timezone);
    return toSleep(row);
  }

  async list(
    userId: string,
    range: { from?: string; to?: string },
  ): Promise<Sleep[]> {
    const filters = [eq(sleepEntries.userId, userId)];
    if (range.from) filters.push(gte(sleepEntries.sleepDate, range.from));
    if (range.to) filters.push(lte(sleepEntries.sleepDate, range.to));
    const rows = await this.db
      .select()
      .from(sleepEntries)
      .where(and(...filters))
      .orderBy(desc(sleepEntries.sleepDate));
    return rows.map(toSleep);
  }
}
