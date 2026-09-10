// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { CatalogService } from '../../application/catalog/catalog-service.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { createMigratedTestDatabase } from '../../infrastructure/database/test-utils.js';
import { buildApiApp } from './app.js';

describe('Bet Studio API health endpoint', () => {
  it('returns a minimal healthy response', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});

describe('Bet Studio catalog API', () => {
  it('creates, lists, updates and reads competitions', async () => {
    const database = createMigratedTestDatabase();
    const app = buildApiApp({
      catalogService: new CatalogService(
        new DrizzleCatalogRepository(database.db),
      ),
    });

    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/competitions',
        payload: { name: 'Liga Portugal', shortName: 'LP', countryCode: 'PT' },
      });

      expect(created.statusCode).toBe(201);
      const competition = created.json<{ id: string; active: boolean }>();
      expect(competition.active).toBe(true);

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/competitions/${competition.id}`,
        payload: { active: false },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json<{ archivedAt: string | null }>().archivedAt).toEqual(
        expect.any(String),
      );

      const listed = await app.inject({
        method: 'GET',
        url: '/api/competitions?active=inactive&search=Liga',
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json<{ total: number }>().total).toBe(1);
    } finally {
      await app.close();
      database.cleanup();
    }
  });

  it('manages team aliases and competition associations', async () => {
    const database = createMigratedTestDatabase();
    const app = buildApiApp({
      catalogService: new CatalogService(
        new DrizzleCatalogRepository(database.db),
      ),
    });

    try {
      const competition = (
        await app.inject({
          method: 'POST',
          url: '/api/competitions',
          payload: { name: 'Premier League' },
        })
      ).json<{ id: string }>();
      const team = (
        await app.inject({
          method: 'POST',
          url: '/api/teams',
          payload: { name: 'Arsenal' },
        })
      ).json<{
        id: string;
      }>();

      const alias = await app.inject({
        method: 'POST',
        url: `/api/teams/${team.id}/aliases`,
        payload: { value: 'The Gunners' },
      });
      expect(alias.statusCode).toBe(201);

      const assigned = await app.inject({
        method: 'POST',
        url: `/api/teams/${team.id}/competitions/${competition.id}`,
      });
      expect(assigned.statusCode).toBe(204);

      const fetched = await app.inject({
        method: 'GET',
        url: `/api/teams/${team.id}`,
      });
      expect(
        fetched.json<{ aliases: unknown[]; competitions: unknown[] }>(),
      ).toMatchObject({
        aliases: [expect.objectContaining({ value: 'The Gunners' })],
        competitions: [expect.objectContaining({ name: 'Premier League' })],
      });
    } finally {
      await app.close();
      database.cleanup();
    }
  });

  it('rejects invalid market configuration at the API boundary', async () => {
    const database = createMigratedTestDatabase();
    const app = buildApiApp({
      catalogService: new CatalogService(
        new DrizzleCatalogRepository(database.db),
      ),
    });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/markets',
        payload: {
          code: 'TOTAL_GOALS_225',
          name: 'Over 2.25 Goals',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_GOALS',
          parameters: { direction: 'OVER', line: 2.25 },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: string }>().error).toBe('VALIDATION_ERROR');
    } finally {
      await app.close();
      database.cleanup();
    }
  });
});
