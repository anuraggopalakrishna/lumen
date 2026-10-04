import type { MetricSummary } from '@lumen/shared';
import { classifyWellbeingState, isLowDay } from '@lumen/shared';
import { describe, expect, it } from 'vitest';
import type { MinimizedContext } from '../src/modules/ai/context.js';
import { buildProlongedLowNotice } from '../src/modules/ai/prolonged-low.js';
import { rankByFeedback } from '../src/modules/recommendations/service.js';

type Day = {
  energy: number | null;
  exhaustion: number | null;
  sleepHours: number | null;
};

function day(energy: number | null, extra: Partial<Day> = {}): Day {
  return { energy, exhaustion: null, sleepHours: null, ...extra };
}

function metric(
  name: string,
  avg3: number | null,
  avg7: number | null,
): MetricSummary {
  return {
    metric: name,
    unit: name === 'sleep' ? 'hours' : 'of 5',
    today: avg3,
    avg3,
    avg7,
    avg28: avg7,
    trend: 'flat',
    delta: 0,
  };
}

describe('isLowDay', () => {
  it('flags a low energy, high exhaustion, or short-sleep day', () => {
    expect(isLowDay(day(2))).toBe(true);
    expect(isLowDay(day(3, { exhaustion: 5 }))).toBe(true);
    expect(isLowDay(day(3, { sleepHours: 5.5 }))).toBe(true);
    expect(isLowDay(day(4, { exhaustion: 2, sleepHours: 7.5 }))).toBe(false);
  });
});

describe('classifyWellbeingState', () => {
  it('reports no_data when nothing is logged', () => {
    expect(classifyWellbeingState([day(null)])).toBe('no_data');
  });

  it('reports steady when all days are in range', () => {
    expect(classifyWellbeingState([day(4), day(4), day(4)])).toBe('steady');
  });

  it('reports low for a single low day', () => {
    expect(classifyWellbeingState([day(4), day(4), day(2)])).toBe('low');
  });

  it('does not call one low day followed by a good day prolonged', () => {
    // The reported bug: one low day + one good day must not be "prolonged".
    expect(classifyWellbeingState([day(2), day(5)])).toBe('recovering');
  });

  it('reports recovering when a dip is followed by recovery', () => {
    expect(classifyWellbeingState([day(2), day(3), day(4)])).toBe('recovering');
  });

  it('reports prolonged_low only after four consecutive low days', () => {
    expect(classifyWellbeingState([day(2), day(2), day(2)])).toBe('low');
    expect(classifyWellbeingState([day(2), day(2), day(2), day(2)])).toBe(
      'prolonged_low',
    );
  });

  it('is more lenient during menstruation', () => {
    const fourLow = [day(2), day(2), day(2), day(2)];
    expect(classifyWellbeingState(fourLow, { menstruating: true })).toBe('low');
    expect(
      classifyWellbeingState([day(2), day(2), day(2), day(2), day(2), day(2)], {
        menstruating: true,
      }),
    ).toBe('prolonged_low');
  });

  it('treats a missing day as breaking the streak', () => {
    expect(
      classifyWellbeingState([day(2), day(null), day(2), day(2)]),
    ).toBe('low');
  });
});

describe('buildProlongedLowNotice', () => {
  it('returns a recovery suggestion citing the low window', () => {
    const context = {
      metrics: [metric('energy', 2, 2), metric('sleep', 7, 7)],
    } as MinimizedContext;
    const notice = buildProlongedLowNotice(context);
    expect(notice.category).toBe('recovery');
    expect(notice.confidence).toBe('high');
    expect(notice.basedOn.length).toBeGreaterThan(0);
    expect(notice.basedOn[0]?.metric).toContain('energy');
    expect(notice.recommendation).toMatch(/clinician/i);
    expect(notice.recommendation).not.toMatch(/diagnos/i);
  });
});

describe('rankByFeedback', () => {
  it('floats helpful categories above unhelpful ones', () => {
    const ranked = rankByFeedback(
      [{ category: 'movement' }, { category: 'food' }, { category: 'recovery' }],
      new Map([
        ['movement', -1],
        ['food', 2],
        ['recovery', 0],
      ]),
    );
    expect(ranked.map((entry) => entry.category)).toEqual([
      'food',
      'recovery',
      'movement',
    ]);
  });
});
