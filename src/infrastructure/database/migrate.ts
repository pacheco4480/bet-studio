import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadServerEnv } from '../../shared/config/server-env.js';
import { openDatabase } from './connection.js';

const env = loadServerEnv();
const database = openDatabase(env.BET_STUDIO_DB_PATH);

try {
  migrate(database.db, { migrationsFolder: './drizzle' });
} finally {
  database.close();
}
