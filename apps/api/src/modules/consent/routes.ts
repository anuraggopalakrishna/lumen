import {
  consentDecisionSchema,
  consentPurposeSchema,
} from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { ConsentService } from './service.js';

export async function consentRoutes(app: FastifyInstance): Promise<void> {
  const service = new ConsentService(app.db);

  app.get(
    '/v1/consents',
    { preHandler: app.authenticate },
    async (request) => ({ consents: await service.list(request.userId) }),
  );

  app.put(
    '/v1/consents/:purpose',
    { preHandler: app.authenticate },
    async (request) => {
      const purpose = consentPurposeSchema.parse(
        (request.params as { purpose: string }).purpose,
      );
      const input = consentDecisionSchema.parse(request.body);
      await service.decide(
        request.userId,
        purpose,
        input.granted,
        input.policyVersion,
      );
      return { consents: await service.list(request.userId) };
    },
  );
}
