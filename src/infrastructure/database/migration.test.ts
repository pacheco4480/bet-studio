// @vitest-environment node

import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase, type TestDatabase } from './test-utils.js';

let database: TestDatabase | null = null;

afterEach(() => {
  database?.cleanup();
  database = null;
});

describe('database migrations', () => {
  it('applies migrations, enables foreign keys, and creates core tables', () => {
    database = createMigratedTestDatabase();

    const foreignKeys = database.sqlite.pragma('foreign_keys', {
      simple: true,
    });
    const tables = database.db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );

    expect(foreignKeys).toBe(1);
    expect(tables.map((table: { name: string }) => table.name)).toEqual(
      expect.arrayContaining([
        'competitions',
        'teams',
        'fixtures',
        'markets',
        'bulletins',
        'bulletin_selection_snapshots',
        'settlement_overrides',
        'templates',
        'template_versions',
        'sync_records',
      ]),
    );
  });
});
