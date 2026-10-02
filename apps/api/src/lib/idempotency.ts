import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../db/client.js';
import { idempotencyKeys } from '../db/schema.js';
import { AppError } from '../errors.js';

export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 200;

/**
 * Execute a mutating handler at most once per (user, Idempotency-Key).
 * Replays return the stored response; a key reused with a different body is a
 * conflict. Keys below the minimum length are ignored (treated as absent).
 */
export async function withIdempotency<T>(
  db: Database,
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  execute: () => Promise<T>,
): Promise<T> {
  const rawKey = request.headers['idempotency-key'];
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  if (
    typeof key !== 'string' ||
    key.length < MIN_KEY_LENGTH ||
    key.length > MAX_KEY_LENGTH
  ) {
    return execute();
  }

  const requestHash = hashRequestBody(request.body);
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
    .limit(1);

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw AppError.conflict(
        'Idempotency key was already used with a different request body',
      );
    }
    reply.code(existing.statusCode);
    return existing.responseJson as T;
  }

  const result = await execute();
  const statusCode = reply.statusCode || 200;
  await db
    .insert(idempotencyKeys)
    .values({
      userId,
      key,
      requestHash,
      statusCode,
      responseJson: result as unknown,
    })
    .onConflictDoNothing();
  return result;
}
