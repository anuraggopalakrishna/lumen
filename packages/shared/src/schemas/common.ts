import { z } from 'zod';

export const idSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(365).default(60),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;
