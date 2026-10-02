import { z } from 'zod';
import {
  ACTION_TAKEN_VALUES,
  HELPFULNESS_VALUES,
  SUGGESTION_CATEGORIES,
  SUGGESTION_CONFIDENCES,
} from '../constants.js';
import { uuidSchema } from '../primitives.js';

/**
 * The recommendation contract from the design spec (§9). The API converts the
 * model response into this shape before it ever reaches the client.
 */
export const suggestionSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  recommendation: z.string().min(1).max(1000),
  rationale: z.string().min(1).max(1000),
  basedOn: z
    .array(
      z.object({
        metric: z.string().min(1).max(120),
        window: z.string().min(1).max(120),
        observation: z.string().min(1).max(500),
      }),
    )
    .max(10),
  caution: z.string().max(500).optional(),
  confidence: z.enum(SUGGESTION_CONFIDENCES),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export const recommendationStatuses = ['active', 'expired', 'dismissed'] as const;
export type RecommendationStatus = (typeof recommendationStatuses)[number];

export const recommendationSchema = z.object({
  id: uuidSchema,
  category: z.enum(SUGGESTION_CATEGORIES),
  suggestion: suggestionSchema,
  status: z.enum(recommendationStatuses),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const recommendationFeedbackInputSchema = z.object({
  helpfulness: z.enum(HELPFULNESS_VALUES),
  actionTaken: z.enum(ACTION_TAKEN_VALUES).default('none'),
  comment: z.string().max(1000).optional(),
});
export type RecommendationFeedbackInput = z.infer<
  typeof recommendationFeedbackInputSchema
>;
