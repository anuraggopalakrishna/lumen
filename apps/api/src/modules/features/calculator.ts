import type { CycleContext, DailyFeatureValues } from '@lumen/shared';
export { averageOrNull } from '@lumen/shared';

export type CheckInLike = {
  energy: number;
  exhaustion: number;
  mood: number;
  stress: number;
} | null;

export type SleepLike = {
  durationMinutes: number;
  quality: number;
} | null;

export type ActivityLike = {
  durationMinutes: number;
};

export type SymptomLike = {
  severity: number;
};

export type DailyFeatureInput = {
  checkIn: CheckInLike;
  sleep: SleepLike;
  activities: ActivityLike[];
  symptoms: SymptomLike[];
  cycle: CycleContext;
};

/**
 * Pure derivation of one day's feature snapshot from canonical records. The
 * result is rebuildable, so a bug here can always be repaired by recomputation.
 */
export function computeDailyFeatureValues(
  input: DailyFeatureInput,
): DailyFeatureValues {
  const movementMinutes = input.activities.reduce(
    (sum, activity) => sum + activity.durationMinutes,
    0,
  );
  const symptomCount = input.symptoms.length;
  const symptomSeverityAvg =
    symptomCount > 0
      ? Math.round(
          (input.symptoms.reduce((sum, s) => sum + s.severity, 0) /
            symptomCount) *
            100,
        ) / 100
      : null;
  const hasActivities = input.activities.length > 0;

  return {
    energy: input.checkIn?.energy ?? null,
    exhaustion: input.checkIn?.exhaustion ?? null,
    mood: input.checkIn?.mood ?? null,
    stress: input.checkIn?.stress ?? null,
    sleepMinutes: input.sleep?.durationMinutes ?? null,
    sleepQuality: input.sleep?.quality ?? null,
    movementMinutes: hasActivities ? movementMinutes : null,
    symptomCount,
    symptomSeverityAvg,
    cycle: input.cycle,
  };
}
