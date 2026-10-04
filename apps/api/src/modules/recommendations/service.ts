import type {
  Recommendation,
  RecommendationFeedbackInput,
} from '@lumen/shared';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  recommendationFeedback,
  recommendationRuns,
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

/** How many suggestions a user sees at once. */
export const MAX_VISIBLE_RECOMMENDATIONS = 4;
const FEEDBACK_WINDOW_DAYS = 30;

/**
 * Deterministic feedback re-ranking: categories the user recently marked
 * helpful float up, categories marked not helpful sink. This steers what is
 * shown without touching model weights.
 */
export function rankByFeedback<T extends { category: string }>(
  items: T[],
  categoryScores: Map<string, number>,
): T[] {
  return [...items].sort(
    (a, b) =>
      (categoryScores.get(b.category) ?? 0) -
      (categoryScores.get(a.category) ?? 0),
  );
}

export class RecommendationService {
  constructor(private readonly db: Database) {}

  private async recentCategoryScores(
    userId: string,
  ): Promise<Map<string, number>> {
    const since = new Date(
      Date.now() - FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.db
      .select({
        category: recommendations.category,
        helpfulness: recommendationFeedback.helpfulness,
      })
      .from(recommendationFeedback)
      .innerJoin(
        recommendations,
        eq(recommendations.id, recommendationFeedback.recommendationId),
      )
      .where(
        and(
          eq(recommendationFeedback.userId, userId),
          gt(recommendationFeedback.createdAt, since),
        ),
      );
    const scores = new Map<string, number>();
    for (const row of rows) {
      const delta = row.helpfulness === 'helpful' ? 1 : -1;
      scores.set(row.category, (scores.get(row.category) ?? 0) + delta);
    }
    return scores;
  }

  async listActive(userId: string): Promise<Recommendation[]> {
    const rows = await this.db
      .select({
        recommendation: recommendations,
        runCreatedAt: recommendationRuns.createdAt,
      })
      .from(recommendations)
      .leftJoin(
        recommendationRuns,
        eq(recommendationRuns.id, recommendations.runId),
      )
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
      .orderBy(desc(recommendationRuns.createdAt), desc(recommendations.createdAt));

    if (rows.length === 0) return [];

    // Show only the most recent generation run, so old runs do not stack up.
    const latestRunAt = rows.reduce<number>((latest, row) => {
      const time = row.runCreatedAt?.getTime() ?? 0;
      return time > latest ? time : latest;
    }, 0);
    const latestRows = rows.filter(
      (row) => (row.runCreatedAt?.getTime() ?? 0) === latestRunAt,
    );

    const scores = await this.recentCategoryScores(userId);
    const ranked = rankByFeedback(
      latestRows.map((row) => row.recommendation),
      scores,
    );

    const seenCategories = new Set<string>();
    return ranked
      .filter((row) => {
        if (seenCategories.has(row.category)) return false;
        seenCategories.add(row.category);
        return true;
      })
      .slice(0, MAX_VISIBLE_RECOMMENDATIONS)
      .map(toRecommendation);
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
