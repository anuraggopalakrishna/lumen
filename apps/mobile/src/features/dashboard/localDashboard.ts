import {
  DISCLAIMER,
  FEATURE_VERSION,
  averageOrNull,
  classifyWellbeingState,
  estimateCycleContext,
} from '@lumen/shared';
import type { DashboardToday, MetricName, MetricSummary } from '@lumen/shared';
import type { SymptomTrend } from '@lumen/shared';
import { addLocalDays } from '../../lib/date';
import type { LocalCheckIn, LocalCycleEvent } from '../../types';

type MetricDefinition = {
  unit: string;
  extract: (checkIn: LocalCheckIn) => number | null;
  epsilon: number;
  format: (value: number) => string;
};

const METRICS: Record<MetricName, MetricDefinition> = {
  energy: {
    unit: 'of 5',
    extract: (c) => c.energy,
    epsilon: 0.15,
    format: (v) => v.toFixed(1),
  },
  exhaustion: {
    unit: 'of 5',
    extract: (c) => c.exhaustion,
    epsilon: 0.15,
    format: (v) => v.toFixed(1),
  },
  sleep: {
    unit: 'hours',
    extract: (c) => (c.sleepHours > 0 ? c.sleepHours : null),
    epsilon: 0.3,
    format: (v) => v.toFixed(1),
  },
  movement: {
    unit: 'minutes',
    extract: (c) => {
      if (c.activities.length > 0) {
        const total = c.activities.reduce(
          (sum, entry) => sum + entry.durationMinutes,
          0,
        );
        return total > 0 ? total : null;
      }
      return c.movement !== 'rest' && c.durationMinutes > 0
        ? c.durationMinutes
        : null;
    },
    epsilon: 5,
    format: (v) => v.toFixed(0),
  },
};

function lastNDates(end: string, n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i += 1) dates.push(addLocalDays(end, -i));
  return dates;
}

function buildMetric(
  name: MetricName,
  date: string,
  byDate: Map<string, LocalCheckIn>,
): MetricSummary {
  const definition = METRICS[name];
  const valuesIn = (count: number): Array<number | null> =>
    lastNDates(date, count).map((day) => {
      const checkIn = byDate.get(day);
      return checkIn ? definition.extract(checkIn) : null;
    });

  const todayCheckIn = byDate.get(date);
  const today = todayCheckIn ? definition.extract(todayCheckIn) : null;
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
  return { metric: name, unit: definition.unit, today, avg3, avg7, avg28, trend, delta };
}

function buildSymptoms(
  date: string,
  checkIns: LocalCheckIn[],
): SymptomTrend[] {
  const window = new Set(lastNDates(date, 28));
  const recent = new Set(lastNDates(date, 7));
  const counts = new Map<string, { count7: number; count28: number }>();
  for (const checkIn of checkIns) {
    if (!window.has(checkIn.localDate)) continue;
    for (const code of checkIn.symptoms) {
      const entry = counts.get(code) ?? { count7: 0, count28: 0 };
      entry.count28 += 1;
      if (recent.has(checkIn.localDate)) entry.count7 += 1;
      counts.set(code, entry);
    }
  }
  return [...counts.entries()]
    .map(([symptomCode, entry]) => ({
      symptomCode,
      count7: entry.count7,
      count28: entry.count28,
      avgSeverity7: null,
    }))
    .sort((a, b) => b.count28 - a.count28);
}

/**
 * Offline dashboard read model. It derives the same metric windows as the API
 * from local check-ins and named cycle events, with no model involved.
 */
export function buildLocalDashboard(
  date: string,
  checkIns: LocalCheckIn[],
  cycleEvents: LocalCycleEvent[],
): DashboardToday {
  const byDate = new Map(checkIns.map((checkIn) => [checkIn.localDate, checkIn]));
  const metrics = (Object.keys(METRICS) as MetricName[]).map((name) =>
    buildMetric(name, date, byDate),
  );
  const cycle = estimateCycleContext(
    cycleEvents.map((event) => ({
      eventDate: event.eventDate,
      eventType: event.eventType,
    })),
    date,
  );

  const recentDays = lastNDates(date, 7)
    .slice()
    .reverse()
    .map((day) => {
      const checkIn = byDate.get(day);
      return {
        energy: checkIn?.energy ?? null,
        exhaustion: checkIn?.exhaustion ?? null,
        sleepHours:
          checkIn && checkIn.sleepHours > 0 ? checkIn.sleepHours : null,
      };
    });

  const evidence: string[] = [];
  for (const metric of metrics) {
    if (metric.avg3 === null || metric.avg28 === null) continue;
    const definition = METRICS[metric.metric as MetricName];
    evidence.push(
      `Your ${metric.metric} averaged ${definition.format(metric.avg3)} ${definition.unit} over the last 3 days, versus ${definition.format(metric.avg28)} ${definition.unit} over 28 days.`,
    );
  }
  if (cycle.cycleDay !== null) {
    evidence.push(
      `Estimated cycle day ${cycle.cycleDay} (${cycle.phase} phase), ${Math.round(cycle.confidence * 100)}% confidence.`,
    );
  }

  return {
    date,
    featureVersion: FEATURE_VERSION,
    wellbeing: classifyWellbeingState(recentDays, {
      menstruating: cycle.phase === 'menstrual',
    }),
    cycle,
    metrics,
    symptoms: buildSymptoms(date, checkIns),
    suggestions: [],
    evidence,
    disclaimer: DISCLAIMER,
  };
}
