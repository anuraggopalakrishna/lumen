import type { DashboardToday } from '@lumen/shared';
import { describe, expect, it } from 'vitest';
import {
  minimizeContext,
  renderContext,
} from '../src/modules/ai/context.js';

function dashboard(overrides: Partial<DashboardToday> = {}): DashboardToday {
  return {
    date: '2026-03-10',
    featureVersion: 'v1',
    cycle: {
      phase: 'luteal',
      cycleDay: 20,
      predictedPeriodInDays: 8,
      averageCycleLength: 28,
      confidence: 0.6,
    },
    metrics: [
      {
        metric: 'energy',
        unit: 'of 5',
        today: 3,
        avg3: 3.1,
        avg7: 3.4,
        avg28: 3.8,
        trend: 'down',
        delta: -0.7,
      },
      {
        metric: 'sleep',
        unit: 'hours',
        today: 6.5,
        avg3: 6.4,
        avg7: 6.9,
        avg28: 7.2,
        trend: 'down',
        delta: -0.8,
      },
    ],
    symptoms: [
      { symptomCode: 'cramping', count7: 2, count28: 5, avgSeverity7: 3 },
    ],
    suggestions: [],
    evidence: ['Energy averaged lower recently.'],
    disclaimer: 'not medical advice',
    ...overrides,
  };
}

describe('minimizeContext', () => {
  it('includes only derived features and names what is excluded', () => {
    const context = minimizeContext({
      date: '2026-03-10',
      dashboard: dashboard(),
      preferences: {
        goals: ['steady energy'],
        dietaryConstraints: ['vegetarian'],
        activityConstraints: ['knee injury'],
      },
      recentFeedback: [
        {
          category: 'movement',
          helpfulness: 'not_helpful',
          actionTaken: 'skipped',
          createdAt: '2026-03-09T10:00:00.000Z',
        },
      ],
    });

    expect(context.includedFields.length).toBe(5);
    expect(context.excludedFields).toContain('raw check-in notes');
    expect(context.excludedFields).toContain(
      'account identifiers (user id, email)',
    );
    expect(context.metrics).toHaveLength(2);
    expect(context.recentFeedback).toHaveLength(1);
  });

  it('caps symptom detail and feedback to a bounded size', () => {
    const context = minimizeContext({
      date: '2026-03-10',
      dashboard: dashboard({
        symptoms: Array.from({ length: 8 }, (_, index) => ({
          symptomCode: `symptom_${index}`,
          count7: 1,
          count28: 2,
          avgSeverity7: null,
        })),
      }),
      preferences: {
        goals: [],
        dietaryConstraints: [],
        activityConstraints: [],
      },
      recentFeedback: Array.from({ length: 20 }, (_, index) => ({
        category: 'food',
        helpfulness: 'helpful',
        actionTaken: 'acted',
        createdAt: `2026-03-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    });
    expect(context.symptoms).toHaveLength(5);
    expect(context.recentFeedback).toHaveLength(8);
  });
});

describe('renderContext', () => {
  it('renders an evidence-shaped, note-free prompt block', () => {
    const context = minimizeContext({
      date: '2026-03-10',
      dashboard: dashboard(),
      preferences: {
        goals: ['steady energy'],
        dietaryConstraints: [],
        activityConstraints: ['knee injury'],
      },
    });
    const text = renderContext(context);
    expect(text).toContain('Date: 2026-03-10');
    expect(text).toContain('Cycle: day 20');
    expect(text).toContain('energy (of 5)');
    expect(text).toContain('Goals: steady energy');
    expect(text).toContain('Activity constraints: knee injury');
    expect(text.toLowerCase()).not.toContain('note:');
  });
});
