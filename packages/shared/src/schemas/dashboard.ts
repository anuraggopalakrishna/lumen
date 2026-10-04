import { z } from 'zod';
import {
  SUGGESTION_CATEGORIES,
  WELLBEING_STATES,
  type SuggestionCategory,
} from '../constants.js';
import { localDateSchema } from '../primitives.js';
import { suggestionSchema } from './recommendations.js';

export const cycleContextSchema = z.object({
  phase: z.enum([
    'menstrual',
    'follicular',
    'ovulation',
    'luteal',
    'unknown',
  ]),
  cycleDay: z.number().int().nullable(),
  predictedPeriodInDays: z.number().int().nullable(),
  averageCycleLength: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});
export type CycleContext = z.infer<typeof cycleContextSchema>;

export const metricSummarySchema = z.object({
  metric: z.string(),
  unit: z.string(),
  today: z.number().nullable(),
  avg3: z.number().nullable(),
  avg7: z.number().nullable(),
  avg28: z.number().nullable(),
  /** Direction of the 3-day average relative to the 28-day average. */
  trend: z.enum(['up', 'down', 'flat', 'unknown']),
  delta: z.number().nullable(),
});
export type MetricSummary = z.infer<typeof metricSummarySchema>;

export const symptomTrendSchema = z.object({
  symptomCode: z.string(),
  count7: z.number().int(),
  count28: z.number().int(),
  avgSeverity7: z.number().nullable(),
});
export type SymptomTrend = z.infer<typeof symptomTrendSchema>;

export const dashboardTodaySchema = z.object({
  date: localDateSchema,
  featureVersion: z.string(),
  wellbeing: z.enum(WELLBEING_STATES),
  cycle: cycleContextSchema,
  metrics: z.array(metricSummarySchema),
  symptoms: z.array(symptomTrendSchema),
  suggestions: z.array(suggestionSchema),
  evidence: z.array(z.string()),
  disclaimer: z.string(),
});
export type DashboardToday = z.infer<typeof dashboardTodaySchema>;

export const metricList = [
  'energy',
  'exhaustion',
  'sleep',
  'movement',
] as const;
export type MetricName = (typeof metricList)[number];

export const dashboardMetricOrder: MetricName[] = [
  'energy',
  'exhaustion',
  'sleep',
  'movement',
];

export const categoryOrder: SuggestionCategory[] = [...SUGGESTION_CATEGORIES];
