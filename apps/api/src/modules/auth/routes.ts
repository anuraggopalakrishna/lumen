import { loginSchema, refreshSchema, registerSchema } from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { AuthService } from './service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const service = new AuthService(app.db, app.tokens, app.config);

  app.post('/v1/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await service.register(input);
    reply.code(201);
    return result;
  });

  app.post('/v1/auth/login', async (request) => {
    const input = loginSchema.parse(request.body);
    return service.login(input);
  });

  app.post('/v1/auth/refresh', async (request) => {
    const input = refreshSchema.parse(request.body);
    const tokens = await service.refresh(input.refreshToken);
    return { tokens };
  });

  app.post('/v1/auth/logout', async (request) => {
    const input = refreshSchema.parse(request.body);
    await service.logout(input.refreshToken);
    return { ok: true };
  });

  app.get(
    '/v1/auth/me',
    { preHandler: app.authenticate },
    async (request) => ({ user: await service.getMe(request.userId) }),
  );
}
