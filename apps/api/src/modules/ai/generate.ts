import type { Suggestion } from '@lumen/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { AppConfig } from '../../config.js';
import type { Database } from '../../db/client.js';
import {
  modelVersions,
  recommendationFeedback,
  recommendationRuns,
  recommendations,
} from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { ConsentService } from '../consent/service.js';
import { DashboardService } from '../dashboard/service.js';
import { ProfileService } from '../profile/service.js';
import { validateSuggestion } from '../safety/policy.js';
import {
  minimizeContext,
  type FeedbackSignal,
} from './context.js';
import { assertModelAllowed, type ApprovedModel } from './model-registry.js';
import {
  createOllamaClient,
  type OllamaClient,
  type OllamaClientOptions,
} from './ollama-client.js';
import {
  MODELFILE_VERSION,
  PROMPT_VERSION,
  RECOMMENDATION_SCHEMA_VERSION,
  SAFETY_POLICY_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
  recommendationEnvelopeSchema,
  recommendationJsonSchema,
  type RecommendationEnvelope,
} from './prompt.js';

const RECOMMENDATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const DIGEST_TIMEOUT_MS = 5_000;

export type ClientFactory = (options: OllamaClientOptions) => OllamaClient;

export type GenerationResult = {
  runId: string;
  modelVersionId: string;
  suggestions: Suggestion[];
  /** Suggestions the safety gate or schema policy refused. */
  rejected: number;
};

/**
 * Consent-gated, safety-gated orchestration of a single generation run (§9):
 * verify consent → load minimized context → allow-list check → local inference
 * → schema validation → post-generation safety → persist run + suggestions.
 */
export class RecommendationGenerationService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    private readonly clientFactory: ClientFactory = createOllamaClient,
  ) {}

  private clientOptions(overrides?: Partial<OllamaClientOptions>): OllamaClientOptions {
    return {
      baseUrl: this.config.ollamaBaseUrl,
      model: this.config.ollamaModel,
      timeoutMs: this.config.ollamaTimeoutMs,
      keepAlive: this.config.ollamaKeepAlive,
      numCtx: this.config.ollamaNumCtx,
      think: this.config.ollamaThink,
      ...overrides,
    };
  }

  private async recentFeedback(userId: string): Promise<FeedbackSignal[]> {
    const rows = await this.db
      .select({
        category: recommendations.category,
        helpfulness: recommendationFeedback.helpfulness,
        actionTaken: recommendationFeedback.actionTaken,
        createdAt: recommendationFeedback.createdAt,
      })
      .from(recommendationFeedback)
      .innerJoin(
        recommendations,
        eq(recommendations.id, recommendationFeedback.recommendationId),
      )
      .where(eq(recommendationFeedback.userId, userId))
      .orderBy(desc(recommendationFeedback.createdAt))
      .limit(8);
    return rows.map((row) => ({
      category: row.category,
      helpfulness: row.helpfulness,
      actionTaken: row.actionTaken,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async ensureModelVersion(
    approved: ApprovedModel,
    digest: string | null,
  ): Promise<string> {
    const modelDigest = digest ?? 'unresolved';
    const [existing] = await this.db
      .select({ id: modelVersions.id })
      .from(modelVersions)
      .where(
        and(
          eq(modelVersions.ollamaModelRef, approved.ollamaModelRef),
          eq(modelVersions.modelDigest, modelDigest),
        ),
      )
      .limit(1);
    if (existing) return existing.id;

    const [row] = await this.db
      .insert(modelVersions)
      .values({
        ollamaModelRef: approved.ollamaModelRef,
        modelDigest,
        modelfileVersion: MODELFILE_VERSION,
        optionsJson: {
          temperature: 0,
          num_ctx: this.config.ollamaNumCtx,
          keep_alive: this.config.ollamaKeepAlive,
          role: approved.role,
          license: approved.license,
        },
        status: 'active',
      })
      .returning({ id: modelVersions.id });
    if (!row) throw new AppError(500, 'write_failed', 'Could not record model version');
    return row.id;
  }

  async generate(userId: string): Promise<GenerationResult> {
    if (!this.config.aiGenerationEnabled) {
      throw AppError.notImplemented(
        'AI suggestion generation is disabled. Set AI_GENERATION_ENABLED=true and configure a private Ollama host.',
      );
    }

    // Allow-list check happens before any health data is read.
    const approved = assertModelAllowed(this.config.ollamaModel);

    const consent = new ConsentService(this.db);
    if (!(await consent.isGranted(userId, 'ai_processing'))) {
      throw AppError.forbidden('AI processing consent is not granted.');
    }

    const profile = new ProfileService(this.db);
    const preferences = await profile.getPreferences(userId);
    if (!preferences.aiSharingEnabled) {
      throw AppError.forbidden('AI sharing is disabled in health preferences.');
    }

    const dashboard = await new DashboardService(this.db).getToday(userId);
    const feedback = await this.recentFeedback(userId);
    const context = minimizeContext({
      date: dashboard.date,
      dashboard,
      preferences: {
        goals: preferences.goals,
        dietaryConstraints: preferences.dietaryConstraints,
        activityConstraints: preferences.activityConstraints,
      },
      recentFeedback: feedback,
    });

    const digestClient = this.clientFactory(
      this.clientOptions({ timeoutMs: DIGEST_TIMEOUT_MS }),
    );
    const digest = await digestClient.resolveModelDigest();
    const modelVersionId = await this.ensureModelVersion(approved, digest);

    const client = this.clientFactory(this.clientOptions());
    const response = await client.chat({
      system: buildSystemPrompt(),
      user: buildUserPrompt(context),
      format: recommendationJsonSchema,
    });

    let parsed: RecommendationEnvelope;
    try {
      parsed = recommendationEnvelopeSchema.parse(JSON.parse(response.text));
    } catch {
      throw AppError.badGateway(
        'Local model returned output that did not match the recommendation schema.',
      );
    }

    const seenCategories = new Set<string>();
    const valid: Suggestion[] = [];
    let rejected = 0;
    for (const suggestion of parsed.suggestions) {
      if (seenCategories.has(suggestion.category) || suggestion.basedOn.length === 0) {
        rejected += 1;
        continue;
      }
      const decision = validateSuggestion(
        suggestion,
        preferences.activityConstraints,
      );
      if (!decision.allowed) {
        rejected += 1;
        continue;
      }
      seenCategories.add(suggestion.category);
      valid.push(suggestion);
    }

    const expiresAt = new Date(Date.now() + RECOMMENDATION_TTL_MS);
    const runId = await this.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(recommendationRuns)
        .values({
          userId,
          featureVersion: dashboard.featureVersion,
          policyVersion: SAFETY_POLICY_VERSION,
          modelVersionId,
          promptVersion: PROMPT_VERSION,
          schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
        })
        .returning({ id: recommendationRuns.id });
      if (!run) throw new Error('Failed to record recommendation run');

      for (const suggestion of valid) {
        await tx.insert(recommendations).values({
          userId,
          runId: run.id,
          category: suggestion.category,
          suggestionJson: suggestion,
          status: 'active',
          expiresAt,
        });
      }
      return run.id;
    });

    return { runId, modelVersionId, suggestions: valid, rejected };
  }
}
