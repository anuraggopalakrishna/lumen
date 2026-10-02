import type { CheckIn, CheckInInput } from '@lumen/shared';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { dailyCheckins, type DailyCheckinRow } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { refreshDailyFeature } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

function toCheckIn(row: DailyCheckinRow): CheckIn {
  return {
    id: row.id,
    clientId: row.clientId,
    localDate: row.localDate,
    energy: row.energy,
    exhaustion: row.exhaustion,
    mood: row.mood,
    stress: row.stress,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CheckInService {
  constructor(private readonly db: Database) {}

  async upsert(userId: string, input: CheckInInput): Promise<CheckIn> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);
    const [row] = await this.db
      .insert(dailyCheckins)
      .values({
        userId,
        clientId: input.clientId,
        localDate: input.localDate,
        energy: input.energy,
        exhaustion: input.exhaustion,
        mood: input.mood,
        stress: input.stress,
        note: input.note ?? null,
      })
      .onConflictDoUpdate({
        target: [dailyCheckins.userId, dailyCheckins.localDate],
        set: {
          clientId: input.clientId,
          energy: input.energy,
          exhaustion: input.exhaustion,
          mood: input.mood,
          stress: input.stress,
          note: input.note ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new AppError(500, 'write_failed', 'Could not save check-in');
    await refreshDailyFeature(this.db, userId, input.localDate, timezone);
    return toCheckIn(row);
  }

  async list(
    userId: string,
    range: { from?: string; to?: string },
  ): Promise<CheckIn[]> {
    const filters = [eq(dailyCheckins.userId, userId)];
    if (range.from) filters.push(gte(dailyCheckins.localDate, range.from));
    if (range.to) filters.push(lte(dailyCheckins.localDate, range.to));
    const rows = await this.db
      .select()
      .from(dailyCheckins)
      .where(and(...filters))
      .orderBy(asc(dailyCheckins.localDate));
    return rows.map(toCheckIn);
  }

  async getByDate(userId: string, localDate: string): Promise<CheckIn | null> {
    const [row] = await this.db
      .select()
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, userId),
          eq(dailyCheckins.localDate, localDate),
        ),
      )
      .limit(1);
    return row ? toCheckIn(row) : null;
  }
}
