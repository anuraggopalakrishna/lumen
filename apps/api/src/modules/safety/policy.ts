import type { Suggestion } from '@lumen/shared';

/**
 * Deterministic safety layer (§10). It runs before and after generation. This
 * module never diagnoses; it only decides whether Lumen may proceed and what
 * safe language to fall back to. It is intentionally conservative and easy to
 * test.
 */

export type SafetyDecision =
  | { allowed: true }
  | { allowed: false; reason: string; fallback: string };

const EMERGENCY_FALLBACK =
  'Lumen cannot assess or diagnose an emergency. If you may be in danger or your symptoms feel urgent, contact your local emergency number or a crisis line now.';

const MEDICAL_FALLBACK =
  'Lumen cannot diagnose, prescribe, or advise on medication, dosage, fertility, or treatment. Please speak with a qualified clinician about this.';

const UNSUPPORTED_CLAIM_FALLBACK =
  'That guidance could not be shown because it made a health claim Lumen cannot support. Lumen offers wellbeing suggestions only.';

const CONSTRAINT_FALLBACK =
  'That suggestion was withheld because it may conflict with a constraint you recorded. Lumen will not recommend movement that goes against your stated limits.';

const EMERGENCY_PHRASES = [
  'kill myself',
  'suicide',
  'suicidal',
  'self harm',
  'self-harm',
  'hurt myself',
  'end my life',
  "can't breathe",
  'cannot breathe',
  'chest pain',
  'severe bleeding',
  'unbearable pain',
  'overdose',
];

const MEDICAL_REQUEST_PHRASES = [
  'diagnose',
  'diagnosis',
  'do i have',
  'what do i have',
  'what medication',
  'which medication',
  'dosage',
  'how many mg',
  'how much should i take',
  'prescribe',
  'treatment for',
  'cure',
  'am i pregnant',
  'fertility',
  'contraceptive',
  'antibiotic',
];

const UNSUPPORTED_OUTPUT_PHRASES = [
  'you have ',
  'you definitely',
  'this confirms',
  'your diagnosis',
  'you are pregnant',
  'your hormone level',
  'caused by your',
  'will cure',
  'guaranteed to',
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle;
  }
  return null;
}

/** Screen an incoming user request before any model is considered. */
export function screenUserRequest(text: string): SafetyDecision {
  const normalized = normalize(text);
  if (containsAny(normalized, EMERGENCY_PHRASES)) {
    return {
      allowed: false,
      reason: 'emergency_or_self_harm',
      fallback: EMERGENCY_FALLBACK,
    };
  }
  if (containsAny(normalized, MEDICAL_REQUEST_PHRASES)) {
    return {
      allowed: false,
      reason: 'medical_request',
      fallback: MEDICAL_FALLBACK,
    };
  }
  return { allowed: true };
}

/** Screen model output for unsupported certainty or causal health claims. */
export function screenModelOutput(text: string): SafetyDecision {
  const normalized = normalize(text);
  const match = containsAny(normalized, UNSUPPORTED_OUTPUT_PHRASES);
  if (match) {
    return {
      allowed: false,
      reason: 'unsupported_medical_claim',
      fallback: UNSUPPORTED_CLAIM_FALLBACK,
    };
  }
  return { allowed: true };
}

const MOVEMENT_KEYWORDS = [
  'run',
  'running',
  'jump',
  'jumping',
  'squat',
  'lunge',
  'hike',
  'hiking',
  'strength',
  'lift',
  'cycling',
];

/**
 * Reject a movement suggestion that appears to conflict with a declared
 * activity constraint. Keyword matching is deliberately simple; expand with a
 * reviewed taxonomy before widening use.
 */
export function checkActivityConstraints(
  suggestion: Suggestion,
  activityConstraints: string[],
): SafetyDecision {
  if (suggestion.category !== 'movement') return { allowed: true };
  const recommendation = normalize(suggestion.recommendation);
  const constraints = activityConstraints.map(normalize).filter(Boolean);
  for (const constraint of constraints) {
    const tokens = constraint.split(' ').filter(Boolean);
    for (const token of tokens) {
      if (MOVEMENT_KEYWORDS.includes(token) && recommendation.includes(token)) {
        return {
          allowed: false,
          reason: `activity_constraint:${constraint}`,
          fallback: CONSTRAINT_FALLBACK,
        };
      }
    }
  }
  return { allowed: true };
}

/** Full post-generation gate for one suggestion. */
export function validateSuggestion(
  suggestion: Suggestion,
  activityConstraints: string[] = [],
): SafetyDecision {
  const output = screenModelOutput(
    `${suggestion.recommendation} ${suggestion.rationale} ${suggestion.basedOn
      .map((basis) => basis.observation)
      .join(' ')}`,
  );
  if (!output.allowed) return output;
  return checkActivityConstraints(suggestion, activityConstraints);
}
