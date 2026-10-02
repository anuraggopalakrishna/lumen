import type { Symptom, SymptomInput } from '@lumen/shared';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { symptomEvents, type SymptomEventRow } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { toLocalDate } from '../../lib/time.js';
import { refreshDailyFeature } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

function toSymptom(row: SymptomEventRow): Symptom {
  return {
    id: row.id,
    clientId: row.clientId,
    occurredAt: row.occurredAt.toISOString(),
    symptomCode: row.symptomCode as Symptom['symptomCode'],
    severity: row.severity,
    durationMinutes: row.durationMinutes ?? undefined,
    userLabel: row.userLabel ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export class SymptomService {
  constructor(private readonly db: Database) {}

  async create(userId: string, input: SymptomInput): Promise<Symptom> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);
    const occurredAt = new Date(input.occurredAt);

    const [inserted] = await this.db
      .insert(symptomEvents)
      .values({
        userId,
        clientId: input.clientId,
        occurredAt,
        symptomCode: input.symptomCode,
        severity: input.severity,
        durationMinutes: input.durationMinutes ?? null,
        userLabel: input.userLabel ?? null,
      })
      .onConflictDoNothing({
        target: [symptomEvents.userId, symptomEvents.clientId],
      })
      .returning();

    let row = inserted;
    if (!row) {
      const [existing] = await this.db
        .select()
        .from(symptomEvents)
        .where(
          and(
            eq(symptomEvents.userId, userId),
            eq(symptomEvents.clientId, input.clientId),
          ),
        )
        .limit(1);
      row = existing;
    }
    if (!row) {
      throw new AppError(500, 'write_failed', 'Could not save symptom');
    }

    await refreshDailyFeature(
      this.db,
      userId,
      toLocalDate(occurredAt, timezone),
      timezone,
    );
    return toSymptom(row);
  }

  async list(
    userId: string,
    range: { from?: string; to?: string },
    limit = 100,
  ): Promise<Symptom[]> {
    const filters = [eq(symptomEvents.userId, userId)];
    if (range.from) filters.push(gte(symptomEvents.occurredAt, new Date(range.from)));
    if (range.to) filters.push(lte(symptomEvents.occurredAt, new Date(range.to)));
    const rows = await this.db
      .select()
      .from(symptomEvents)
      .where(and(...filters))
      .orderBy(desc(symptomEvents.occurredAt))
      .limit(limit);
    return rows.map(toSymptom);
  }
}
