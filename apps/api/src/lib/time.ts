/**
 * Timezone-aware day math. Cycle calculations must never rely on server time,
 * so all day boundaries are resolved against the user's IANA timezone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function partsInTimeZone(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

/** Offset in milliseconds to add to a UTC instant to get wall-clock in `timeZone`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

/** Format an instant as the user's local YYYY-MM-DD. */
export function toLocalDate(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The user's local date right now. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return toLocalDate(now, timeZone);
}

/** UTC instant corresponding to local midnight at the start of `localDate`. */
export function startOfLocalDayUtc(localDate: string, timeZone: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** Half-open [start, end) UTC range covering one local calendar day. */
export function localDayUtcRange(
  localDate: string,
  timeZone: string,
): { start: Date; end: Date } {
  const start = startOfLocalDayUtc(localDate, timeZone);
  const end = startOfLocalDayUtc(addDays(localDate, 1), timeZone);
  return { start, end };
}

export function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/** List of local dates ending at `end` (inclusive), most recent first. */
export function lastNDates(end: string, n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i += 1) dates.push(addDays(end, -i));
  return dates;
}

export function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
