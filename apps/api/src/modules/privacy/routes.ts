import type { FastifyInstance } from 'fastify';
import { PrivacyService } from './service.js';

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  const service = new PrivacyService(app.db);
  const guard = { preHandler: app.authenticate };

  app.get('/v1/privacy/export', guard, async (request) =>
    service.exportAll(request.userId),
  );

  app.delete('/v1/account', guard, async (request, reply) => {
    const deletion = await service.requestDeletion(request.userId);
    reply.code(202);
    return { deletionRequest: deletion };
  });
}
