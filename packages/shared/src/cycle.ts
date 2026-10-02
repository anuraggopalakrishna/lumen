import type { CycleContext } from './schemas/dashboard.js';

/**
 * Deterministic cycle estimation, shared by the API feature calculator and the
 * device so offline and online views agree. It reports an estimate with a
 * confidence, never a fact.
 */

export type CycleEventLike = {
  eventDate: string;
  eventType: string;
};

const DEFAULT_CYCLE_LENGTH = 28;
const MIN_CYCLE_LENGTH = 15;
const MAX_CYCLE_LENGTH = 60;
/** Starts within this many days are treated as the same period. */
const SAME_PERIOD_WINDOW_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Collapse noisy period-start events into distinct cycle starts. */
export function normalizePeriodStarts(events: CycleEventLike[]): string[] {
  const starts = events
    .filter((event) => event.eventType === 'period_start')
    .map((event) => event.eventDate)
    .sort();

  const kept: string[] = [];
  for (const date of starts) {
    const previous = kept[kept.length - 1];
    if (previous && daysBetween(previous, date) < SAME_PERIOD_WINDOW_DAYS) {
      continue;
    }
    kept.push(date);
  }
  return kept;
}

function phaseForCycleDay(
  cycleDay: number,
  averageCycleLength: number,
): CycleContext['phase'] {
  if (cycleDay <= 5) return 'menstrual';
  const ovulationStart = Math.max(6, Math.round(averageCycleLength / 2) - 1);
  const ovulationEnd = Math.round(averageCycleLength / 2) + 2;
  if (cycleDay < ovulationStart) return 'follicular';
  if (cycleDay <= ovulationEnd) return 'ovulation';
  return 'luteal';
}

export function estimateCycleContext(
  events: CycleEventLike[],
  asOfLocalDate: string,
  defaultCycleLength: number = DEFAULT_CYCLE_LENGTH,
): CycleContext {
  const starts = normalizePeriodStarts(events).filter(
    (date) => date <= asOfLocalDate,
  );
  if (starts.length === 0) {
    return {
      phase: 'unknown',
      cycleDay: null,
      predictedPeriodInDays: null,
      averageCycleLength: null,
      confidence: 0,
    };
  }

  const lastStart = starts[starts.length - 1] as string;
  const lengths: number[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const length = daysBetween(
      starts[index - 1] as string,
      starts[index] as string,
    );
    if (length >= MIN_CYCLE_LENGTH && length <= MAX_CYCLE_LENGTH) {
      lengths.push(length);
    }
  }

  const averageCycleLength =
    lengths.length > 0
      ? Math.round(
          lengths.reduce((sum, length) => sum + length, 0) / lengths.length,
        )
      : defaultCycleLength;

  const cycleDay = daysBetween(lastStart, asOfLocalDate) + 1;
  const predictedNextStart = addDays(lastStart, averageCycleLength);
  const predictedPeriodInDays = daysBetween(asOfLocalDate, predictedNextStart);

  const mean =
    lengths.length > 0
      ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length
      : 0;
  const variance =
    lengths.length > 1
      ? lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) /
        lengths.length
      : 0;
  const stdDev = Math.sqrt(variance);

  let confidence = 0.15;
  if (lengths.length >= 1) confidence = 0.35;
  if (lengths.length >= 2) confidence = 0.5;
  if (lengths.length >= 3) confidence = 0.65;
  confidence += Math.min(lengths.length, 6) * 0.03;
  confidence -= Math.min(0.3, stdDev / 30);
  confidence = Math.max(0.1, Math.min(0.9, confidence));

  return {
    phase: phaseForCycleDay(cycleDay, averageCycleLength),
    cycleDay,
    predictedPeriodInDays,
    averageCycleLength,
    confidence: round2(confidence),
  };
}

/** Average of present values, or null when there is no data in the window. */
export function averageOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  return Math.round(mean * 100) / 100;
}
