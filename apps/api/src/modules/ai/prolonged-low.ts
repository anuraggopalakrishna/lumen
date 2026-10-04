import type { Suggestion } from '@lumen/shared';
import type { MinimizedContext } from './context.js';

/**
 * Deterministic, safety-approved notice for a sustained multi-day dip. This is
 * fixed text (not model output) so it never diagnoses or makes unsupported
 * claims; it only names the observed window and suggests a clinician check-in.
 */
export function buildProlongedLowNotice(
  context: MinimizedContext,
): Suggestion {
  const lowMetrics = context.metrics.filter((metric) => {
    if (metric.metric === 'energy') return (metric.avg3 ?? Infinity) <= 2.5;
    if (metric.metric === 'exhaustion') return (metric.avg3 ?? -Infinity) >= 4;
    if (metric.metric === 'sleep') return (metric.avg3 ?? Infinity) < 6.5;
    return false;
  });
  const names = lowMetrics.map((metric) => metric.metric).join(', ') || 'energy';
  return {
    category: 'recovery',
    recommendation:
      'You have logged low energy or high exhaustion for several days in a row. Consider mentioning this to a clinician — Lumen can offer wellbeing ideas, but it cannot tell you what this means.',
    rationale:
      'A sustained multi-day dip is worth a professional check-in, even though Lumen never diagnoses.',
    basedOn: [
      {
        metric: names,
        window: '7 days',
        observation: `${names} has stayed outside your usual range over the last week.`,
      },
    ],
    caution: 'This is a wellbeing suggestion, not medical advice.',
    confidence: 'high',
  };
}
