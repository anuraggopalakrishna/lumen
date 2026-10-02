import type { FastifyInstance } from 'fastify';
import { findApprovedModel } from './model-registry.js';
import { createOllamaClient } from './ollama-client.js';
import {
  PROMPT_VERSION,
  RECOMMENDATION_SCHEMA_VERSION,
  SAFETY_POLICY_VERSION,
} from './prompt.js';

const STATUS_PROBE_TIMEOUT_MS = 2_000;

/**
 * Read-only visibility into the local inference boundary. Reports whether
 * generation is enabled and whether the configured model is allow-listed and
 * reachable. Exposes no health data.
 */
export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/ai/status',
    { preHandler: app.authenticate },
    async () => {
      const approved = findApprovedModel(app.config.ollamaModel);
      const client = createOllamaClient({
        baseUrl: app.config.ollamaBaseUrl,
        model: app.config.ollamaModel,
        timeoutMs: STATUS_PROBE_TIMEOUT_MS,
        keepAlive: app.config.ollamaKeepAlive,
        numCtx: app.config.ollamaNumCtx,
      });
      const digest = await client.resolveModelDigest();

      return {
        enabled: app.config.aiGenerationEnabled,
        model: app.config.ollamaModel,
        baseUrl: app.config.ollamaBaseUrl,
        approved: Boolean(approved),
        role: approved?.role ?? null,
        license: approved?.license ?? null,
        reachable: digest !== null,
        digest,
        promptVersion: PROMPT_VERSION,
        schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
        policyVersion: SAFETY_POLICY_VERSION,
      };
    },
  );
}
