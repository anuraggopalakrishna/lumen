import { describe, expect, it } from 'vitest';
import {
  averageOrNull,
  computeDailyFeatureValues,
} from '../src/modules/features/calculator.js';

const cycle = {
  phase: 'luteal' as const,
  cycleDay: 20,
  predictedPeriodInDays: 8,
  averageCycleLength: 28,
  confidence: 0.6,
};

describe('computeDailyFeatureValues', () => {
  it('aggregates movement and symptom severity for the day', () => {
    const values = computeDailyFeatureValues({
      checkIn: { energy: 3, exhaustion: 2, mood: 4, stress: 2 },
      sleep: { durationMinutes: 450, quality: 4 },
      activities: [{ durationMinutes: 20 }, { durationMinutes: 35 }],
      symptoms: [{ severity: 2 }, { severity: 4 }],
      cycle,
    });
    expect(values.movementMinutes).toBe(55);
    expect(values.symptomCount).toBe(2);
    expect(values.symptomSeverityAvg).toBe(3);
    expect(values.sleepMinutes).toBe(450);
    expect(values.cycle).toEqual(cycle);
  });

  it('leaves movement null when nothing was logged', () => {
    const values = computeDailyFeatureValues({
      checkIn: null,
      sleep: null,
      activities: [],
      symptoms: [],
      cycle,
    });
    expect(values.movementMinutes).toBeNull();
    expect(values.energy).toBeNull();
    expect(values.symptomCount).toBe(0);
    expect(values.symptomSeverityAvg).toBeNull();
  });
});

describe('averageOrNull', () => {
  it('ignores nulls and returns null when empty', () => {
    expect(averageOrNull([null, null])).toBeNull();
    expect(averageOrNull([2, 4, null])).toBe(3);
    expect(averageOrNull([1, 2])).toBe(1.5);
  });
});
