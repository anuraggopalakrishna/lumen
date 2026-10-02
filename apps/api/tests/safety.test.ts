import type { Suggestion } from '@lumen/shared';
import { describe, expect, it } from 'vitest';
import {
  checkActivityConstraints,
  screenModelOutput,
  screenUserRequest,
  validateSuggestion,
} from '../src/modules/safety/policy.js';

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    category: 'movement',
    recommendation: 'Take a gentle 20-minute walk today.',
    rationale: 'Your energy has been steady this week.',
    basedOn: [
      { metric: 'energy', window: '7 days', observation: 'Energy averaged 3.4' },
    ],
    confidence: 'medium',
    ...overrides,
  };
}

describe('screenUserRequest', () => {
  it('blocks emergency and self-harm language with a safe fallback', () => {
    const decision = screenUserRequest('I think I want to kill myself');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('emergency_or_self_harm');
      expect(decision.fallback).toMatch(/emergency number|crisis/i);
    }
  });

  it('blocks diagnosis and medication requests', () => {
    expect(screenUserRequest('do I have endometriosis?').allowed).toBe(false);
    expect(screenUserRequest('what medication should I take?').allowed).toBe(
      false,
    );
  });

  it('allows ordinary wellbeing requests', () => {
    expect(screenUserRequest('suggest a way to wind down tonight').allowed).toBe(
      true,
    );
  });
});

describe('screenModelOutput', () => {
  it('rejects unsupported certainty or causal claims', () => {
    expect(
      screenModelOutput('You have a hormonal imbalance.').allowed,
    ).toBe(false);
    expect(
      screenModelOutput('This confirms your diagnosis.').allowed,
    ).toBe(false);
  });

  it('allows evidence-bounded language', () => {
    expect(
      screenModelOutput('Your energy averaged lower than usual recently.').allowed,
    ).toBe(true);
  });
});

describe('checkActivityConstraints', () => {
  it('withholds movement that conflicts with a stated constraint', () => {
    const decision = checkActivityConstraints(
      suggestion({ recommendation: 'Try a short run this afternoon.' }),
      ['run'],
    );
    expect(decision.allowed).toBe(false);
  });

  it('does not restrict food suggestions', () => {
    const decision = checkActivityConstraints(
      suggestion({ category: 'food', recommendation: 'Add a run of protein.' }),
      ['run'],
    );
    expect(decision.allowed).toBe(true);
  });
});

describe('validateSuggestion', () => {
  it('passes a bounded, non-conflicting suggestion', () => {
    expect(validateSuggestion(suggestion(), []).allowed).toBe(true);
  });

  it('blocks an otherwise valid suggestion that makes a health claim', () => {
    expect(
      validateSuggestion(
        suggestion({ rationale: 'You have a hormone imbalance.' }),
        [],
      ).allowed,
    ).toBe(false);
  });
});
