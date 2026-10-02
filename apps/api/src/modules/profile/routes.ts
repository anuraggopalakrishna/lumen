import {
  updateHealthPreferencesSchema,
  updateProfileSchema,
} from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { ProfileService } from './service.js';

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const service = new ProfileService(app.db);
  const guard = { preHandler: app.authenticate };

  app.get('/v1/profile', guard, async (request) => ({
    profile: await service.getProfile(request.userId),
  }));

  app.put('/v1/profile', guard, async (request) => {
    const input = updateProfileSchema.parse(request.body);
    return { profile: await service.updateProfile(request.userId, input) };
  });

  app.get('/v1/health-preferences', guard, async (request) => ({
    preferences: await service.getPreferences(request.userId),
  }));

  app.put('/v1/health-preferences', guard, async (request) => {
    const input = updateHealthPreferencesSchema.parse(request.body);
    return {
      preferences: await service.updatePreferences(request.userId, input),
    };
  });
}
