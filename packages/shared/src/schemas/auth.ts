import { z } from 'zod';

export const deviceSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  pushToken: z.string().max(512).optional(),
});

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(64).default('UTC'),
  device: deviceSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  device: deviceSchema.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export const sessionTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshTokenExpiresAt: z.string(),
});

export type DeviceInput = z.infer<typeof deviceSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SessionTokens = z.infer<typeof sessionTokensSchema>;
