import {
  EXPORT_FORMAT_VERSION,
  type DeletionRequest,
  type ExportEnvelope,
} from '@lumen/shared';
import { eq, inArray, and } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  activityEntries,
  auditEvents,
  consents,
  cycleEvents,
  dailyCheckins,
  dailyFeatures,
  deletionRequests,
  healthPreferences,
  profiles,
  recommendationFeedback,
  recommendations,
  sessions,
  sleepEntries,
  symptomEvents,
  users,
} from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { recordAudit } from '../../lib/audit.js';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export class PrivacyService {
  constructor(private readonly db: Database) {}

  async exportAll(userId: string): Promise<ExportEnvelope> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw AppError.notFound('User not found');

    const recommendationRows = await this.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, userId));
    const recommendationIds = recommendationRows.map((row) => row.id);

    const [
      profileRows,
      consentRows,
      preferenceRows,
      checkInRows,
      cycleRows,
      symptomRows,
      activityRows,
      sleepRows,
      featureRows,
      auditRows,
    ] = await Promise.all([
      this.db.select().from(profiles).where(eq(profiles.userId, userId)),
      this.db.select().from(consents).where(eq(consents.userId, userId)),
      this.db
        .select()
        .from(healthPreferences)
        .where(eq(healthPreferences.userId, userId)),
      this.db.select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId)),
      this.db.select().from(cycleEvents).where(eq(cycleEvents.userId, userId)),
      this.db.select().from(symptomEvents).where(eq(symptomEvents.userId, userId)),
      this.db
        .select()
        .from(activityEntries)
        .where(eq(activityEntries.userId, userId)),
      this.db.select().from(sleepEntries).where(eq(sleepEntries.userId, userId)),
      this.db.select().from(dailyFeatures).where(eq(dailyFeatures.userId, userId)),
      this.db.select().from(auditEvents).where(eq(auditEvents.userId, userId)),
    ]);

    const feedbackRows =
      recommendationIds.length > 0
        ? await this.db
            .select()
            .from(recommendationFeedback)
            .where(
              and(
                eq(recommendationFeedback.userId, userId),
                inArray(recommendationFeedback.recommendationId, recommendationIds),
              ),
            )
        : [];

    await recordAudit(this.db, userId, 'privacy.exported');

    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      profile: profileRows[0] ?? null,
      consents: consentRows,
      healthPreferences: preferenceRows[0] ?? null,
      checkIns: checkInRows,
      cycleEvents: cycleRows,
      symptoms: symptomRows,
      activities: activityRows,
      sleep: sleepRows,
      dailyFeatures: featureRows,
      recommendations: recommendationRows,
      recommendationFeedback: feedbackRows,
      auditEvents: auditRows,
    };
  }

  async requestDeletion(userId: string): Promise<DeletionRequest> {
    const result = await this.db.transaction(async (tx) => {
      const [pending] = await tx
        .select()
        .from(deletionRequests)
        .where(
          and(
            eq(deletionRequests.userId, userId),
            inArray(deletionRequests.status, ['pending', 'in_progress']),
          ),
        )
        .limit(1);
      if (pending) return pending;

      const [request] = await tx
        .insert(deletionRequests)
        .values({ userId, status: 'pending' })
        .returning();
      if (!request) throw new Error('Failed to create deletion request');

      await tx
        .update(users)
        .set({ status: 'deletion_pending', updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, userId));

      return request;
    });

    await recordAudit(this.db, userId, 'privacy.deletion_requested');
    return {
      id: result.id,
      requestedAt: result.requestedAt.toISOString(),
      status: result.status as DeletionRequest['status'],
      completedAt: iso(result.completedAt),
    };
  }
}
