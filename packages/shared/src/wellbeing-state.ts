import {
  WELLBEING_STATES,
  type WellbeingState,
} from './constants.js';

/**
 * Deterministic wellbeing state, shared by the API and device so the AI prompt
 * and the offline plan agree. It classifies the *recent days* (not window
 * averages, which cannot tell one low day from several) and maps to the
 * behaviours the product wants:
 *
 *   low           → respond with a few gentle, targeted suggestions
 *   recovering    → reinforce the improvement (maintain, don't push)
 *   steady        → back off; nothing is broken, so suggest little or nothing
 *   prolonged_low → stronger support, and a clinician nudge (done in the API)
 */

export { WELLBEING_STATES };
export type { WellbeingState };

/** Thresholds mirror the deterministic plan so both views agree. */
const LOW_ENERGY = 2.5;
const HIGH_EXHAUSTION = 4;
const LOW_SLEEP_HOURS = 6.5;
/**
 * Consecutive low days before a dip is treated as sustained. A couple of bad
 * days is normal, so the bar is deliberately high; during menstruation it is
 * higher still, since low days around a period are expected.
 */
export const PROLONGED_LOW_DAYS = 4;
export const PROLONGED_LOW_MENSTRUAL_DAYS = 6;

/** One day's readings. Missing values are null; the day may have no data. */
export type WellbeingDay = {
  energy: number | null;
  exhaustion: number | null;
  sleepHours: number | null;
};

export type WellbeingContext = {
  /** Extra leniency: low days during a period are expected. */
  menstruating?: boolean;
};

function hasData(day: WellbeingDay): boolean {
  return (
    day.energy !== null || day.exhaustion !== null || day.sleepHours !== null
  );
}

/** A day is "low" when any tracked signal is outside its usual range. */
export function isLowDay(day: WellbeingDay): boolean {
  const signals: boolean[] = [];
  if (day.energy !== null) signals.push(day.energy <= LOW_ENERGY);
  if (day.exhaustion !== null) signals.push(day.exhaustion >= HIGH_EXHAUSTION);
  if (day.sleepHours !== null) signals.push(day.sleepHours < LOW_SLEEP_HOURS);
  return signals.some(Boolean);
}

/**
 * Classify from the most recent days (oldest → newest, up to ~7). Missing days
 * break a streak, so one low day never reads as several, and a short dip never
 * reads as something worth a clinician.
 */
export function classifyWellbeingState(
  recentDays: WellbeingDay[],
  context: WellbeingContext = {},
): WellbeingState {
  if (!recentDays.some(hasData)) return 'no_data';

  let trailingLow = 0;
  for (let index = recentDays.length - 1; index >= 0; index -= 1) {
    const day = recentDays[index] as WellbeingDay;
    if (isLowDay(day)) trailingLow += 1;
    else break;
  }

  const threshold = context.menstruating
    ? PROLONGED_LOW_MENSTRUAL_DAYS
    : PROLONGED_LOW_DAYS;

  if (trailingLow >= threshold) return 'prolonged_low';
  if (trailingLow >= 1) return 'low';

  const lowEarlierInWeek = recentDays.slice(-7).some(isLowDay);
  if (lowEarlierInWeek) return 'recovering';
  return 'steady';
}
