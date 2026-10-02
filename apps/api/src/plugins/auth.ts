import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';

/**
 * Verifies the short-lived access token and exposes userId/sessionId on the
 * request. Routes must never accept a user id from the request body.
 */
export const authPlugin = fp(
  async (app: FastifyInstance): Promise<void> => {
    app.decorateRequest('userId', '');
    app.decorateRequest('sessionId', '');

    app.decorate(
      'authenticate',
      async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
        const header = request.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
          throw AppError.unauthorized('Missing bearer token');
        }
        try {
          const claims = await app.tokens.verifyAccess(header.slice(7));
          request.userId = claims.sub;
          request.sessionId = claims.sid;
        } catch {
          throw AppError.unauthorized('Invalid or expired access token');
        }
      },
    );
  },
  { name: 'lumen-auth' },
);
