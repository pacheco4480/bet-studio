import Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.js';

export type BetStudioDatabase = BetterSQLite3Database<typeof schema>;

export type DatabaseHandle = {
  sqlite: Database.Database;
  db: BetStudioDatabase;
  close: () => void;
};

export function openDatabase(filePath: string): DatabaseHandle {
  if (filePath !== ':memory:') {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const sqlite = new Database(filePath);
  sqlite.pragma('foreign_keys = ON');

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    close: () => sqlite.close(),
  };
}
