import {
  DISCLAIMER,
  FEATURE_VERSION,
  dashboardMetricOrder,
  type CycleContext,
  type DashboardToday,
  type DailyFeatureValues,
  type MetricName,
  type MetricSummary,
  type SymptomTrend,
} from '@lumen/shared';
import { and, asc, desc, eq, gte, gt, isNull, lte, or } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  dailyFeatures,
  recommendations,
  symptomEvents,
} from '../../db/schema.js';
import { addDays, lastNDates, localDayUtcRange, todayInTimeZone } from '../../lib/time.js';
import { averageOrNull } from '../features/calculator.js';
import { refreshDailyFeature } from '../features/service.js';
import { ProfileService } from '../profile/service.js';

type MetricDefinition = {
  name: MetricName;
  unit: string;
  /** Extract the comparable value from a day's snapshot, or null. */
  extract: (values: DailyFeatureValues) => number | null;
  /** Difference below which a trend is considered flat. */
  epsilon: number;
  format: (value: number) => string;
};

const METRICS: Record<MetricName, MetricDefinition> = {
  energy: {
    name: 'energy',
    unit: 'of 5',
    extract: (values) => values.energy,
    epsilon: 0.15,
    format: (value) => value.toFixed(1),
  },
  exhaustion: {
    name: 'exhaustion',
    unit: 'of 5',
    extract: (values) => values.exhaustion,
    epsilon: 0.15,
    format: (value) => value.toFixed(1),
  },
  sleep: {
    name: 'sleep',
    unit: 'hours',
    extract: (values) =>
      values.sleepMinutes === null ? null : Math.round((values.sleepMinutes / 60) * 10) / 10,
    epsilon: 0.3,
    format: (value) => value.toFixed(1),
  },
  movement: {
    name: 'movement',
    unit: 'minutes',
    extract: (values) => values.movementMinutes,
    epsilon: 5,
    format: (value) => value.toFixed(0),
  },
};

function buildMetric(
  definition: MetricDefinition,
  date: string,
  valuesByDate: Map<string, DailyFeatureValues>,
): MetricSummary {
  const valuesIn = (count: number): Array<number | null> =>
    lastNDates(date, count).map((day) => {
      const feature = valuesByDate.get(day);
      return feature ? definition.extract(feature) : null;
    });

  const todayValue = valuesByDate.get(date)
    ? definition.extract(valuesByDate.get(date) as DailyFeatureValues)
    : null;
  const avg3 = averageOrNull(valuesIn(3));
  const avg7 = averageOrNull(valuesIn(7));
  const avg28 = averageOrNull(valuesIn(28));

  let trend: MetricSummary['trend'] = 'unknown';
  let delta: number | null = null;
  if (avg3 !== null && avg28 !== null) {
    delta = Math.round((avg3 - avg28) * 100) / 100;
    if (Math.abs(delta) < definition.epsilon) trend = 'flat';
    else trend = delta > 0 ? 'up' : 'down';
  }

  return {
    metric: definition.name,
    unit: definition.unit,
    today: todayValue,
    avg3,
    avg7,
    avg28,
    trend,
    delta,
  };
}

export class DashboardService {
  constructor(private readonly db: Database) {}

  private async symptomTrends(
    userId: string,
    date: string,
    timezone: string,
  ): Promise<SymptomTrend[]> {
    const start = localDayUtcRange(addDays(date, -27), timezone).start;
    const end = localDayUtcRange(date, timezone).end;
    const rows = await this.db
      .select({
        symptomCode: symptomEvents.symptomCode,
        severity: symptomEvents.severity,
        occurredAt: symptomEvents.occurredAt,
      })
      .from(symptomEvents)
      .where(
        and(
          eq(symptomEvents.userId, userId),
          gte(symptomEvents.occurredAt, start),
          lte(symptomEvents.occurredAt, end),
        ),
      );

    const sevenDaysAgo = localDayUtcRange(addDays(date, -6), timezone).start;
    const byCode = new Map<
      string,
      { count7: number; count28: number; severities7: number[] }
    >();
    for (const row of rows) {
      const entry =
        byCode.get(row.symptomCode) ??
        { count7: 0, count28: 0, severities7: [] };
      entry.count28 += 1;
      if (row.occurredAt >= sevenDaysAgo) {
        entry.count7 += 1;
        entry.severities7.push(row.severity);
      }
      byCode.set(row.symptomCode, entry);
    }

    return [...byCode.entries()]
      .map(([symptomCode, entry]) => ({
        symptomCode,
        count7: entry.count7,
        count28: entry.count28,
        avgSeverity7: averageOrNull(entry.severities7),
      }))
      .sort((a, b) => b.count28 - a.count28);
  }

  private buildEvidence(
    date: string,
    metrics: MetricSummary[],
    cycle: CycleContext,
  ): string[] {
    const evidence: string[] = [];
    for (const metric of metrics) {
      if (metric.avg3 === null || metric.avg28 === null) continue;
      const definition = METRICS[metric.metric as MetricName];
      evidence.push(
        `Your reported ${metric.metric} averaged ${definition.format(metric.avg3)} ${definition.unit} over the last 3 days, versus ${definition.format(metric.avg28)} ${definition.unit} over 28 days.`,
      );
    }
    if (cycle.cycleDay !== null) {
      evidence.push(
        `Estimated cycle day ${cycle.cycleDay} (${cycle.phase} phase) with ${Math.round(cycle.confidence * 100)}% confidence.`,
      );
    }
    if (cycle.predictedPeriodInDays !== null) {
      evidence.push(
        cycle.predictedPeriodInDays >= 0
          ? `Next period predicted in about ${cycle.predictedPeriodInDays} day(s).`
          : `The predicted period window started ${Math.abs(cycle.predictedPeriodInDays)} day(s) ago.`,
      );
    }
    void date;
    return evidence;
  }

  async getToday(userId: string, requestedDate?: string): Promise<DashboardToday> {
    const timezone = await new ProfileService(this.db).getTimezone(userId);
    const date = requestedDate ?? todayInTimeZone(timezone);
    const from = addDays(date, -27);

    const rows = await this.db
      .select()
      .from(dailyFeatures)
      .where(
        and(
          eq(dailyFeatures.userId, userId),
          eq(dailyFeatures.featureVersion, FEATURE_VERSION),
          gte(dailyFeatures.localDate, from),
          lte(dailyFeatures.localDate, date),
        ),
      )
      .orderBy(asc(dailyFeatures.localDate));

    let valuesByDate = new Map(rows.map((row) => [row.localDate, row.valuesJson]));
    let todayFeature = valuesByDate.get(date);
    if (!todayFeature) {
      const refreshed = await refreshDailyFeature(this.db, userId, date, timezone);
      valuesByDate = new Map(valuesByDate).set(date, refreshed);
      todayFeature = refreshed;
    }

    const metrics = dashboardMetricOrder.map((name) =>
      buildMetric(METRICS[name], date, valuesByDate),
    );
    const symptoms = await this.symptomTrends(userId, date, timezone);

    const now = new Date();
    const recommendationRows = await this.db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.status, 'active'),
          or(
            isNull(recommendations.expiresAt),
            gt(recommendations.expiresAt, now),
          ),
        ),
      )
      .orderBy(desc(recommendations.createdAt));

    const seenCategories = new Set<string>();
    const suggestions = recommendationRows
      .filter((row) => {
        if (seenCategories.has(row.category)) return false;
        seenCategories.add(row.category);
        return true;
      })
      .slice(0, 4)
      .map((row) => row.suggestionJson);

    const cycle: CycleContext = todayFeature.cycle;

    return {
      date,
      featureVersion: FEATURE_VERSION,
      cycle,
      metrics,
      symptoms,
      suggestions,
      evidence: this.buildEvidence(date, metrics, cycle),
      disclaimer: DISCLAIMER,
    };
  }
}
