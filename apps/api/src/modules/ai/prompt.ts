import { SUGGESTION_CATEGORIES, suggestionSchema } from '@lumen/shared';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { renderContext, type MinimizedContext } from './context.js';

/**
 * Prompt and schema versions are pinned per release and recorded on every
 * `recommendation_run` so output can be traced and reproduced.
 */
export const PROMPT_VERSION = 'v1';
export const RECOMMENDATION_SCHEMA_VERSION = 'v1';
export const SAFETY_POLICY_VERSION = 'safety-v1';
export const MODELFILE_VERSION = 'lumen-default-v1';

export const recommendationEnvelopeSchema = z.object({
  suggestions: z.array(suggestionSchema).max(4),
});
export type RecommendationEnvelope = z.infer<typeof recommendationEnvelopeSchema>;

/** JSON Schema handed to Ollama's `format` field to constrain decoding. */
export const recommendationJsonSchema = zodToJsonSchema(
  recommendationEnvelopeSchema,
  { target: 'jsonSchema7', $refStrategy: 'none' },
) as Record<string, unknown>;

export function buildSystemPrompt(): string {
  return [
    'You are Lumen, a wellbeing assistant. You are NOT a medical device and you never diagnose, treat, prescribe, or predict fertility.',
    'You suggest small, optional, low-risk actions in these categories only: movement, food, recovery, practice.',
    '',
    'Hard rules:',
    '- Base every suggestion ONLY on the metrics provided. Do not invent data, causes, hormone levels, or conditions.',
    '- Do not mention supplements, medication, dosages, diagnoses, pregnancy, or fertility.',
    '- Each suggestion must cite at least one entry in "basedOn" using the exact metric name and window from the provided data.',
    '- Prefer gentle, widely safe actions. If a constraint could conflict, either avoid that action or add a "caution" string.',
    '- Set confidence to "low" when the data is sparse, "medium" for a few days, "high" only for consistent multi-week patterns.',
    '- Return at most one suggestion per category, and fewer when the data does not support more.',
    '- Respond with JSON matching the provided schema and nothing else.',
  ].join('\n');
}

export function buildUserPrompt(context: MinimizedContext): string {
  const allowed = SUGGESTION_CATEGORIES.join(', ');
  return [
    'Here is the user\'s minimized, consented feature snapshot.',
    '',
    renderContext(context),
    '',
    `Produce up to four wellbeing suggestions (one per category, categories: ${allowed}) that fit this snapshot and the stated constraints.`,
    'If there is too little data, return fewer suggestions rather than guessing.',
    'Return JSON matching the schema exactly.',
  ].join('\n');
}
