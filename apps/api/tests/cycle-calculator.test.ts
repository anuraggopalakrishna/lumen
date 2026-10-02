import { describe, expect, it } from 'vitest';
import {
  estimateCycleContext,
  normalizePeriodStarts,
} from '../src/modules/features/cycle-calculator.js';

describe('normalizePeriodStarts', () => {
  it('collapses multiple start days within one period', () => {
    const starts = normalizePeriodStarts([
      { eventDate: '2026-01-01', eventType: 'period_start' },
      { eventDate: '2026-01-02', eventType: 'period_start' },
      { eventDate: '2026-01-04', eventType: 'period_start' },
      { eventDate: '2026-02-01', eventType: 'period_start' },
      { eventDate: '2026-01-15', eventType: 'period_end' },
    ]);
    expect(starts).toEqual(['2026-01-01', '2026-02-01']);
  });
});

describe('estimateCycleContext', () => {
  it('returns unknown when there is no history', () => {
    const result = estimateCycleContext([], '2026-02-10');
    expect(result.phase).toBe('unknown');
    expect(result.cycleDay).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('computes cycle day from the most recent start', () => {
    const result = estimateCycleContext(
      [{ eventDate: '2026-02-01', eventType: 'period_start' }],
      '2026-02-05',
    );
    expect(result.cycleDay).toBe(5);
    expect(result.phase).toBe('menstrual');
    expect(result.averageCycleLength).toBe(28);
  });

  it('uses observed cycle lengths and predicts the next period', () => {
    const events = [
      { eventDate: '2026-01-01', eventType: 'period_start' },
      { eventDate: '2026-01-30', eventType: 'period_start' },
      { eventDate: '2026-02-28', eventType: 'period_start' },
    ];
    const result = estimateCycleContext(events, '2026-03-10');
    expect(result.averageCycleLength).toBe(29);
    expect(result.cycleDay).toBe(11);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.predictedPeriodInDays).toBe(19);
    expect(['follicular', 'ovulation', 'luteal']).toContain(result.phase);
  });

  it('ignores starts after the as-of date', () => {
    const result = estimateCycleContext(
      [
        { eventDate: '2026-01-01', eventType: 'period_start' },
        { eventDate: '2026-03-01', eventType: 'period_start' },
      ],
      '2026-01-10',
    );
    expect(result.cycleDay).toBe(10);
  });
});
