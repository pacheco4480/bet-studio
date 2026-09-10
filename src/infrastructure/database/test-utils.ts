import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type DatabaseHandle } from './connection.js';

export type TestDatabase = DatabaseHandle & {
  path: string;
  cleanup: () => void;
};

export function createMigratedTestDatabase(): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), 'bet-studio-db-'));
  const path = join(dir, 'test.db');
  const handle = openDatabase(path);

  migrate(handle.db, { migrationsFolder: './drizzle' });

  return {
    ...handle,
    path,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
