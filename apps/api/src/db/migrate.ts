import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config.js';
import { createDatabase } from './client.js';

type ProcessWithEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

if (existsSync('.env')) {
  (process as ProcessWithEnvFile).loadEnvFile?.('.env');
}

const config = loadConfig();
const { pool, db } = createDatabase(config.databaseUrl);
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  // eslint-disable-next-line no-console
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
