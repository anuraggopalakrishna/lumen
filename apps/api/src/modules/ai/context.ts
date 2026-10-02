import type {
  CycleContext,
  DashboardToday,
  MetricSummary,
  SymptomTrend,
} from '@lumen/shared';

/**
 * Context minimization (§9). The model receives a compact, consented snapshot
 * of *derived* features — never raw lifetime logs, notes, identifiers, or audit
 * data. `excludedFields` is explicit so a reviewer can see what cannot escape.
 */

export const DEFAULT_CONTEXT_DAYS = 28;

export type FeedbackSignal = {
  category: string;
  helpfulness: string;
  actionTaken: string;
  createdAt: string;
};

export type MinimizedContext = {
  date: string;
  windowDays: number;
  cycle: CycleContext;
  metrics: MetricSummary[];
  symptoms: SymptomTrend[];
  goals: string[];
  dietaryConstraints: string[];
  activityConstraints: string[];
  recentFeedback: FeedbackSignal[];
  /** What is present in this context, for audit. */
  includedFields: string[];
  /** What is deliberately never sent, for audit. */
  excludedFields: string[];
};

const EXCLUDED_FIELDS = [
  'raw check-in notes',
  'lifetime raw event logs',
  'account identifiers (user id, email)',
  'audit events',
  'session and device data',
];

export function minimizeContext(input: {
  date: string;
  dashboard: DashboardToday;
  preferences: {
    goals: string[];
    dietaryConstraints: string[];
    activityConstraints: string[];
  };
  recentFeedback?: FeedbackSignal[];
  windowDays?: number;
}): MinimizedContext {
  const windowDays = input.windowDays ?? DEFAULT_CONTEXT_DAYS;

  return {
    date: input.date,
    windowDays,
    // Cycle stays as an estimate with confidence, never a diagnosis.
    cycle: input.dashboard.cycle,
    metrics: input.dashboard.metrics,
    // Cap symptom detail; the model only needs the shape of recent patterns.
    symptoms: input.dashboard.symptoms.slice(0, 5),
    goals: input.preferences.goals.slice(0, 10),
    dietaryConstraints: input.preferences.dietaryConstraints.slice(0, 10),
    activityConstraints: input.preferences.activityConstraints.slice(0, 10),
    recentFeedback: (input.recentFeedback ?? []).slice(0, 8),
    includedFields: [
      'cycle estimate and confidence',
      `${windowDays}-day feature windows (energy, exhaustion, sleep, movement)`,
      'symptom counts and average severity',
      'user-stated goals and constraints',
      'recent recommendation feedback signals',
    ],
    excludedFields: EXCLUDED_FIELDS,
  };
}

function formatMetric(metric: MetricSummary): string {
  const part = (label: string, value: number | null) =>
    value === null ? null : `${label}=${value}`;
  const values = [
    part('today', metric.today),
    part('3d', metric.avg3),
    part('7d', metric.avg7),
    part('28d', metric.avg28),
  ].filter((value): value is string => value !== null);
  return `${metric.metric} (${metric.unit}): ${values.join(', ') || 'no data'}${metric.trend !== 'unknown' ? `, trend ${metric.trend}` : ''}`;
}

/** Deterministic, token-bounded text rendering of the minimized context. */
export function renderContext(context: MinimizedContext): string {
  const lines: string[] = [];
  lines.push(`Date: ${context.date}`);
  lines.push(
    context.cycle.cycleDay === null
      ? 'Cycle: not enough history for an estimate'
      : `Cycle: day ${context.cycle.cycleDay}, estimated ${context.cycle.phase} phase, confidence ${context.cycle.confidence}`,
  );
  lines.push('Recent feature windows:');
  for (const metric of context.metrics) lines.push(`- ${formatMetric(metric)}`);
  if (context.symptoms.length > 0) {
    lines.push('Symptom counts:');
    for (const symptom of context.symptoms) {
      lines.push(
        `- ${symptom.symptomCode}: ${symptom.count7} in last 7 days, ${symptom.count28} in last 28 days`,
      );
    }
  } else {
    lines.push('Symptom counts: none logged recently');
  }
  lines.push(
    `Goals: ${context.goals.join(', ') || 'none stated'}`,
  );
  lines.push(
    `Dietary constraints: ${context.dietaryConstraints.join(', ') || 'none stated'}`,
  );
  lines.push(
    `Activity constraints: ${context.activityConstraints.join(', ') || 'none stated'}`,
  );
  if (context.recentFeedback.length > 0) {
    lines.push('Recent feedback on past suggestions:');
    for (const signal of context.recentFeedback) {
      lines.push(
        `- ${signal.category}: ${signal.helpfulness}, action ${signal.actionTaken}`,
      );
    }
  }
  return lines.join('\n');
}
