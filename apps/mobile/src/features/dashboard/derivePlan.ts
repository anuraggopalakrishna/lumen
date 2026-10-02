import type { DashboardToday, MetricSummary } from '@lumen/shared';

export type DerivedPlan = {
  title: string;
  body: string;
  basis: string;
};

function metric(
  dashboard: DashboardToday,
  name: string,
): MetricSummary | undefined {
  return dashboard.metrics.find((entry) => entry.metric === name);
}

function basisFor(entry: MetricSummary | undefined, label: string): string {
  if (!entry || entry.avg3 === null) return label;
  const unit = entry.unit === 'of 5' ? '' : ` ${entry.unit}`;
  return `${label}: ${entry.avg3}${unit} over 3 days`;
}

/**
 * Deterministic, non-AI plan derived only from the user's own recent windows.
 * It names its evidence and never asserts a medical cause.
 */
export function derivePlan(dashboard: DashboardToday): DerivedPlan | null {
  const sleep = metric(dashboard, 'sleep');
  const exhaustion = metric(dashboard, 'exhaustion');
  const energy = metric(dashboard, 'energy');
  const movement = metric(dashboard, 'movement');

  const hasAnyData = dashboard.metrics.some(
    (entry) => entry.avg3 !== null || entry.avg7 !== null,
  );
  if (!hasAnyData) return null;

  if (sleep && sleep.avg3 !== null && sleep.avg3 < 6.5) {
    return {
      title: 'Protect your recovery today',
      body: 'Your recent sleep has been on the shorter side. A lower-intensity day, an earlier wind-down, and a consistent bedtime may help you feel steadier.',
      basis: basisFor(sleep, 'Sleep'),
    };
  }

  if (exhaustion && exhaustion.avg3 !== null && exhaustion.avg3 >= 4) {
    return {
      title: 'Choose gentle movement',
      body: 'You have been reporting higher exhaustion recently. A short walk, stretching, or a rest day may support you more than a hard session.',
      basis: basisFor(exhaustion, 'Exhaustion'),
    };
  }

  if (energy && energy.avg3 !== null && energy.avg3 <= 2.5) {
    return {
      title: 'Keep it low-impact today',
      body: 'Your reported energy has been lower than usual. A light walk and a protein-forward meal may support your afternoon energy.',
      basis: basisFor(energy, 'Energy'),
    };
  }

  if (movement && movement.avg7 !== null && movement.avg7 < 15) {
    return {
      title: 'A little movement goes a long way',
      body: 'Movement has been light over the past week. A 10 to 20 minute walk on days that feel manageable may help your energy and mood.',
      basis: basisFor(movement, 'Movement'),
    };
  }

  return {
    title: 'Keep your rhythm steady',
    body: 'Your recent signals look fairly steady. Continuing your usual sleep, movement, and meal routines may help you sustain this pattern.',
    basis: 'Based on your last 3 and 28 days of check-ins',
  };
}
