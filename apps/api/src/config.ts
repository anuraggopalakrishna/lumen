import { z } from 'zod';

const booleanString = (defaultValue: boolean) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((value) => value.toLowerCase() === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('*'),
  WORKER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),

  // --- Local inference boundary (§9) ---------------------------------------
  // Closed by default: generation must be explicitly enabled once a private
  // Ollama host and an allow-listed model are in place.
  AI_GENERATION_ENABLED: booleanString(false),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen3:4b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  OLLAMA_KEEP_ALIVE: z.string().min(1).default('30m'),
  OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(4096),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  corsOrigins: string[] | '*';
  workerIntervalSeconds: number;
  aiGenerationEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaTimeoutMs: number;
  ollamaKeepAlive: string;
  ollamaNumCtx: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${issues}`);
  }
  const value = parsed.data;
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    jwtSecret: value.JWT_SECRET,
    accessTokenTtlSeconds: value.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
    corsOrigins:
      value.CORS_ORIGINS.trim() === '*'
        ? '*'
        : value.CORS_ORIGINS.split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
    workerIntervalSeconds: value.WORKER_INTERVAL_SECONDS,
    aiGenerationEnabled: value.AI_GENERATION_ENABLED,
    ollamaBaseUrl: value.OLLAMA_BASE_URL,
    ollamaModel: value.OLLAMA_MODEL,
    ollamaTimeoutMs: value.OLLAMA_TIMEOUT_MS,
    ollamaKeepAlive: value.OLLAMA_KEEP_ALIVE,
    ollamaNumCtx: value.OLLAMA_NUM_CTX,
  };
}
