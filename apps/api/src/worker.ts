import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { runScheduledJobs } from './jobs/index.js';

type ProcessWithEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

if (existsSync('.env')) {
  (process as ProcessWithEnvFile).loadEnvFile?.('.env');
}

const config = loadConfig();
const { pool, db } = createDatabase(config.databaseUrl);

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runScheduledJobs(db);
    // eslint-disable-next-line no-console
    console.log('[worker] scheduled jobs complete');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[worker] job run failed', error);
  } finally {
    running = false;
  }
}

await tick();
const timer = setInterval(() => void tick(), config.workerIntervalSeconds * 1000);

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[worker] shutting down (${signal})`);
  clearInterval(timer);
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
