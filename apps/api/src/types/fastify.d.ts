import type { Database } from '../db/client.js';
import type { AppConfig } from '../config.js';
import type { TokenService } from '../modules/auth/tokens.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: Database;
    tokens: TokenService;
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    /** Set only by the authenticate preHandler, from verified token claims. */
    userId: string;
    sessionId: string;
  }
}
