import type {
  Recommendation,
  RecommendationFeedbackInput,
  Suggestion,
} from '@lumen/shared';
import { apiFetch } from './client';

export type GenerationResult = {
  runId: string;
  modelVersionId: string;
  suggestions: Suggestion[];
  /** Suggestions the safety gate or schema policy refused. */
  rejected: number;
};

export type AiStatus = {
  enabled: boolean;
  model: string;
  baseUrl: string;
  approved: boolean;
  role: string | null;
  license: string | null;
  reachable: boolean;
  digest: string | null;
  promptVersion: string;
  schemaVersion: string;
  policyVersion: string;
};

export function listRecommendations(): Promise<{
  recommendations: Recommendation[];
}> {
  return apiFetch<{ recommendations: Recommendation[] }>('/v1/recommendations');
}

/**
 * Ask the backend to run one consent-gated generation pass against the local
 * model. This can take tens of seconds; the caller should show a busy state.
 */
export function generateRecommendations(): Promise<GenerationResult> {
  return apiFetch<GenerationResult>('/v1/recommendations/generate', {
    method: 'POST',
    body: {},
  });
}

export function sendRecommendationFeedback(
  id: string,
  input: RecommendationFeedbackInput,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/v1/recommendations/${id}/feedback`, {
    method: 'POST',
    body: input,
  });
}

/** Read-only inference boundary status. Carries no health data. */
export function getAiStatus(): Promise<AiStatus> {
  return apiFetch<AiStatus>('/v1/ai/status');
}
