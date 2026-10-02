import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  lastNDates,
  localDayUtcRange,
  startOfLocalDayUtc,
  todayInTimeZone,
  toLocalDate,
} from '../src/lib/time.js';

describe('addDays / daysBetween', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('measures whole-day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
  });
});

describe('timezone day math', () => {
  it('resolves the local date for an instant', () => {
    const instant = new Date('2026-06-01T02:30:00Z');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-06-01');
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-05-31');
    expect(todayInTimeZone('Asia/Tokyo', instant)).toBe('2026-06-01');
  });

  it('computes a DST day as 23 or 25 hours', () => {
    const spring = localDayUtcRange('2026-03-08', 'America/New_York');
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 60 * 60 * 1000);

    const fall = localDayUtcRange('2026-11-01', 'America/New_York');
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('places local midnight at the right UTC instant', () => {
    expect(startOfLocalDayUtc('2026-06-01', 'UTC').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    );
    expect(startOfLocalDayUtc('2026-06-01', 'America/New_York').toISOString()).toBe(
      '2026-06-01T04:00:00.000Z',
    );
  });
});

describe('lastNDates', () => {
  it('returns the most recent dates first', () => {
    expect(lastNDates('2026-02-02', 3)).toEqual([
      '2026-02-02',
      '2026-02-01',
      '2026-01-31',
    ]);
  });
});
