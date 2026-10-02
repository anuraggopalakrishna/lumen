import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config.js';
import type { Database } from './db/client.js';
import { authRoutes } from './modules/auth/routes.js';
import { createTokenService } from './modules/auth/tokens.js';
import { aiRoutes } from './modules/ai/routes.js';
import { consentRoutes } from './modules/consent/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { healthLogRoutes } from './modules/health-log/routes.js';
import { privacyRoutes } from './modules/privacy/routes.js';
import { profileRoutes } from './modules/profile/routes.js';
import { recommendationRoutes } from './modules/recommendations/routes.js';
import { authPlugin } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';

export type BuildServerOptions = {
  config: AppConfig;
  db: Database;
  logger?: FastifyServerOptions['logger'];
};

export async function buildServer({
  config,
  db,
  logger = { level: config.nodeEnv === 'test' ? 'silent' : 'info' },
}: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate(
    'tokens',
    createTokenService(config.jwtSecret, config.accessTokenTtlSeconds),
  );

  await app.register(cors, {
    origin: config.corsOrigins === '*' ? true : config.corsOrigins,
  });

  registerErrorHandler(app);
  await app.register(authPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(consentRoutes);
  await app.register(profileRoutes);
  await app.register(healthLogRoutes);
  await app.register(dashboardRoutes);
  await app.register(recommendationRoutes);
  await app.register(privacyRoutes);
  await app.register(aiRoutes);

  return app;
}
