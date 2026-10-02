import { recommendationFeedbackInputSchema, uuidSchema } from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { RecommendationGenerationService } from '../ai/generate.js';
import { RecommendationService } from './service.js';

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  const service = new RecommendationService(app.db);
  const generator = new RecommendationGenerationService(app.db, app.config);
  const guard = { preHandler: app.authenticate };

  app.get('/v1/recommendations', guard, async (request) => ({
    recommendations: await service.listActive(request.userId),
  }));

  app.post('/v1/recommendations/generate', guard, async (request) =>
    generator.generate(request.userId),
  );

  app.post('/v1/recommendations/:id/feedback', guard, async (request) => {
    const id = uuidSchema.parse((request.params as { id: string }).id);
    const input = recommendationFeedbackInputSchema.parse(request.body);
    return service.addFeedback(request.userId, id, input);
  });
}
