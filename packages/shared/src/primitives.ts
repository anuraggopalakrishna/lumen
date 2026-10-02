import { z } from 'zod';

/** Canonical UUID used for client-generated record ids (idempotent writes). */
export const uuidSchema = z.string().uuid();

/** A user's local calendar day, independent of server timezone. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a local date in YYYY-MM-DD format');

/** A lenient ISO 8601 instant. Stored as TIMESTAMPTZ server-side. */
export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected an ISO 8601 date-time');

export const integerScale = (min: number, max: number) =>
  z.number().int().min(min).max(max);
