import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { buildServer } from './server.js';

type ProcessWithEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

if (existsSync('.env')) {
  (process as ProcessWithEnvFile).loadEnvFile?.('.env');
}

const config = loadConfig();
const { pool, db } = createDatabase(config.databaseUrl);
const app = await buildServer({ config, db });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.host, port: config.port });
