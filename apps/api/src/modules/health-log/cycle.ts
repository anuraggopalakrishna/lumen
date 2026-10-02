import type { CycleEvent, CycleEventInput } from '@lumen/shared';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { cycleEvents, type CycleEventRow } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { recordAudit } from '../../lib/audit.js';
import { todayInTimeZone } from '../../lib/time.js';
import { refreshFeatureRange } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

const REFRESH_WINDOW_DAYS = 90;

function toCycleEvent(row: CycleEventRow): CycleEvent {
  return {
    id: row.id,
    clientId: row.clientId,
    eventDate: row.eventDate,
    eventType: row.eventType as CycleEvent['eventType'],
    flow: (row.flow ?? undefined) as CycleEvent['flow'],
    source: row.source as CycleEvent['source'],
    confidence: row.confidence ?? undefined,
    note: row.note ?? undefined,
    correctsEventId: row.correctsEventId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export class CycleService {
  constructor(private readonly db: Database) {}

  async create(userId: string, input: CycleEventInput): Promise<CycleEvent> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);

    const row = await this.db.transaction(async (tx) => {
      if (input.correctsEventId) {
        const [corrected] = await tx
          .select()
          .from(cycleEvents)
          .where(
            and(
              eq(cycleEvents.userId, userId),
              eq(cycleEvents.id, input.correctsEventId),
            ),
          )
          .limit(1);
        if (!corrected) {
          throw AppError.notFound('The cycle event being corrected was not found');
        }
        await tx.delete(cycleEvents).where(eq(cycleEvents.id, corrected.id));
      }

      const [inserted] = await tx
        .insert(cycleEvents)
        .values({
          userId,
          clientId: input.clientId,
          eventDate: input.eventDate,
          eventType: input.eventType,
          flow: input.flow ?? null,
          source: input.source,
          confidence: input.confidence ?? null,
          note: input.note ?? null,
          correctsEventId: input.correctsEventId ?? null,
        })
        .onConflictDoNothing({
          target: [cycleEvents.userId, cycleEvents.clientId],
        })
        .returning();

      if (inserted) return inserted;
      const [existing] = await tx
        .select()
        .from(cycleEvents)
        .where(
          and(
            eq(cycleEvents.userId, userId),
            eq(cycleEvents.clientId, input.clientId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new AppError(500, 'write_failed', 'Could not save cycle event');
      }
      return existing;
    });

    if (input.correctsEventId) {
      await recordAudit(this.db, userId, 'cycle_event.corrected', {
        correctedId: input.correctsEventId,
      });
    }

    await refreshFeatureRange(
      this.db,
      userId,
      todayInTimeZone(timezone),
      REFRESH_WINDOW_DAYS,
      timezone,
    );
    return toCycleEvent(row);
  }

  async list(
    userId: string,
    range: { from?: string; to?: string },
  ): Promise<CycleEvent[]> {
    const filters = [eq(cycleEvents.userId, userId)];
    if (range.from) filters.push(gte(cycleEvents.eventDate, range.from));
    if (range.to) filters.push(lte(cycleEvents.eventDate, range.to));
    const rows = await this.db
      .select()
      .from(cycleEvents)
      .where(and(...filters))
      .orderBy(asc(cycleEvents.eventDate));
    return rows.map(toCycleEvent);
  }
}
