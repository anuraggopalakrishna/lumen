import { localDateSchema } from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { DashboardService } from './service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const service = new DashboardService(app.db);

  app.get(
    '/v1/dashboard/today',
    { preHandler: app.authenticate },
    async (request) => {
      const { date } = request.query as { date?: string };
      const requestedDate = date ? localDateSchema.parse(date) : undefined;
      return service.getToday(request.userId, requestedDate);
    },
  );
}
