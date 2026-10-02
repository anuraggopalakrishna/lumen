import type {
  Recommendation,
  RecommendationFeedbackInput,
} from '@lumen/shared';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  recommendationFeedback,
  recommendations,
  type RecommendationRow,
} from '../../db/schema.js';
import { AppError } from '../../errors.js';

function toRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    category: row.category as Recommendation['category'],
    suggestion: row.suggestionJson,
    status: row.status as Recommendation['status'],
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class RecommendationService {
  constructor(private readonly db: Database) {}

  async listActive(userId: string): Promise<Recommendation[]> {
    const rows = await this.db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.status, 'active'),
          or(
            isNull(recommendations.expiresAt),
            gt(recommendations.expiresAt, new Date()),
          ),
        ),
      )
      .orderBy(desc(recommendations.createdAt));
    return rows.map(toRecommendation);
  }

  async addFeedback(
    userId: string,
    recommendationId: string,
    input: RecommendationFeedbackInput,
  ): Promise<{ ok: true }> {
    const [recommendation] = await this.db
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.id, recommendationId),
        ),
      )
      .limit(1);
    if (!recommendation) throw AppError.notFound('Recommendation not found');

    await this.db.insert(recommendationFeedback).values({
      userId,
      recommendationId,
      helpfulness: input.helpfulness,
      actionTaken: input.actionTaken,
      comment: input.comment ?? null,
    });
    return { ok: true };
  }
}
