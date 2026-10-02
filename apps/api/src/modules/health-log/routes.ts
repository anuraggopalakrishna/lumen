import {
  activityInputSchema,
  activityQuerySchema,
  checkInInputSchema,
  checkInQuerySchema,
  cycleEventInputSchema,
  cycleQuerySchema,
  sleepInputSchema,
  sleepQuerySchema,
  symptomInputSchema,
  symptomQuerySchema,
} from '@lumen/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withIdempotency } from '../../lib/idempotency.js';
import { ActivityService } from './activities.js';
import { CheckInService } from './checkins.js';
import { CycleService } from './cycle.js';
import { SleepService } from './sleep.js';
import { SymptomService } from './symptoms.js';

export async function healthLogRoutes(app: FastifyInstance): Promise<void> {
  const checkIns = new CheckInService(app.db);
  const cycle = new CycleService(app.db);
  const activities = new ActivityService(app.db);
  const symptoms = new SymptomService(app.db);
  const sleep = new SleepService(app.db);
  const guard = { preHandler: app.authenticate };

  const activityListQuerySchema = activityQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(365).default(60),
  });
  const symptomListQuerySchema = symptomQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(365).default(100),
  });

  // --- Daily check-ins -----------------------------------------------------
  app.post('/v1/check-ins', guard, async (request, reply) => {
    const input = checkInInputSchema.parse(request.body);
    return withIdempotency(app.db, request, reply, request.userId, () =>
      checkIns.upsert(request.userId, input),
    );
  });

  app.get('/v1/check-ins', guard, async (request) => {
    const query = checkInQuerySchema.parse(request.query ?? {});
    return { checkIns: await checkIns.list(request.userId, query) };
  });

  app.get('/v1/check-ins/:date', guard, async (request) => {
    const { date } = request.params as { date: string };
    return { checkIn: await checkIns.getByDate(request.userId, date) };
  });

  // --- Cycle events --------------------------------------------------------
  app.post('/v1/cycle-events', guard, async (request, reply) => {
    const input = cycleEventInputSchema.parse(request.body);
    return withIdempotency(app.db, request, reply, request.userId, () =>
      cycle.create(request.userId, input),
    );
  });

  app.get('/v1/cycle-events', guard, async (request) => {
    const query = cycleQuerySchema.parse(request.query ?? {});
    return { cycleEvents: await cycle.list(request.userId, query) };
  });

  // --- Activities ----------------------------------------------------------
  app.post('/v1/activities', guard, async (request, reply) => {
    const input = activityInputSchema.parse(request.body);
    return withIdempotency(app.db, request, reply, request.userId, () =>
      activities.create(request.userId, input),
    );
  });

  app.get('/v1/activities', guard, async (request) => {
    const query = activityListQuerySchema.parse(request.query ?? {});
    return {
      activities: await activities.list(request.userId, query, query.limit),
    };
  });

  // --- Symptoms ------------------------------------------------------------
  app.post('/v1/symptoms', guard, async (request, reply) => {
    const input = symptomInputSchema.parse(request.body);
    return withIdempotency(app.db, request, reply, request.userId, () =>
      symptoms.create(request.userId, input),
    );
  });

  app.get('/v1/symptoms', guard, async (request) => {
    const query = symptomListQuerySchema.parse(request.query ?? {});
    return {
      symptoms: await symptoms.list(request.userId, query, query.limit),
    };
  });

  // --- Sleep ---------------------------------------------------------------
  app.post('/v1/sleep', guard, async (request, reply) => {
    const input = sleepInputSchema.parse(request.body);
    return withIdempotency(app.db, request, reply, request.userId, () =>
      sleep.upsert(request.userId, input),
    );
  });

  app.get('/v1/sleep', guard, async (request) => {
    const query = sleepQuerySchema.parse(request.query ?? {});
    return { sleep: await sleep.list(request.userId, query) };
  });
}
