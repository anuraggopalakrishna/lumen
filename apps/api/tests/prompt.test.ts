import { describe, expect, it } from 'vitest';
import type { MinimizedContext } from '../src/modules/ai/context.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  recommendationEnvelopeSchema,
  recommendationJsonSchema,
} from '../src/modules/ai/prompt.js';

const context: MinimizedContext = {
  date: '2026-03-10',
  windowDays: 28,
  cycle: {
    phase: 'luteal',
    cycleDay: 20,
    predictedPeriodInDays: 8,
    averageCycleLength: 28,
    confidence: 0.6,
  },
  metrics: [],
  symptoms: [],
  goals: [],
  dietaryConstraints: [],
  activityConstraints: [],
  recentFeedback: [],
  includedFields: [],
  excludedFields: [],
};

describe('recommendation contract', () => {
  it('produces a JSON Schema with a suggestions array', () => {
    const schema = recommendationJsonSchema as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    expect(schema.type).toBe('object');
    expect(schema.properties?.suggestions).toBeDefined();
  });

  it('accepts a compliant suggestion envelope', () => {
    const parsed = recommendationEnvelopeSchema.parse({
      suggestions: [
        {
          category: 'movement',
          recommendation: 'Take a gentle 20-minute walk.',
          rationale: 'Your reported energy has been steady this week.',
          basedOn: [
            {
              metric: 'energy',
              window: '7 days',
              observation: 'Energy averaged 3.4',
            },
          ],
          confidence: 'medium',
        },
      ],
    });
    expect(parsed.suggestions).toHaveLength(1);
  });

  it('rejects a category outside the wellbeing contract', () => {
    expect(() =>
      recommendationEnvelopeSchema.parse({
        suggestions: [
          {
            category: 'diagnosis',
            recommendation: 'x',
            rationale: 'y',
            basedOn: [],
            confidence: 'high',
          },
        ],
      }),
    ).toThrow();
  });
});

describe('prompts', () => {
  it('states the non-diagnostic boundary', () => {
    expect(buildSystemPrompt()).toMatch(/never diagnose/i);
  });

  it('lists the four categories and the date', () => {
    const prompt = buildUserPrompt(context);
    expect(prompt).toContain('2026-03-10');
    expect(prompt).toContain('movement, food, recovery, practice');
  });
});
