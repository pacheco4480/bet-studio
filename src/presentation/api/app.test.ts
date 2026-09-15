// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { BulletinService } from '../../application/bulletins/bulletin-service.js';
import { CatalogService } from '../../application/catalog/catalog-service.js';
import type { HistoryService } from '../../application/history/history-service.js';
import type { SettlementService } from '../../application/settlement/settlement-service.js';
import { SynchronizationService } from '../../application/synchronization/synchronization-service.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { DrizzleSyncRepository } from '../../infrastructure/database/repositories/sync-repository.js';
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

describe('Bet Studio bulletin API', () => {
  it('lists, creates, reads, updates and duplicates bulletins', async () => {
    const calls: string[] = [];
    const bulletinResponse = {
      bulletin: {
        id: 'bulletin-1',
        publicCode: 'BET #0001',
        type: 'SINGLE',
        mode: 'PRE_MATCH',
        status: 'PENDING',
        stake: null,
        totalOdd: '1.50',
        renderConfig: {},
      },
      selections: [],
    };
    const app = buildApiApp({
      bulletinService: {
        listBulletins: () => ({
          items: [
            {
              id: 'bulletin-1',
              publicCode: 'BET #0001',
              type: 'SINGLE',
              mode: 'PRE_MATCH',
              status: 'PENDING',
              totalOdd: '1.50',
              selectionCount: 1,
              updatedAt: '2026-09-11T00:00:00.000Z',
            },
          ],
        }),
        createBulletin: (input: unknown) => {
          calls.push(`create:${JSON.stringify(input)}`);
          return bulletinResponse;
        },
        getBulletin: (id: string) => {
          calls.push(`get:${id}`);
          return bulletinResponse;
        },
        updateBulletin: (id: string, input: unknown) => {
          calls.push(`update:${id}:${JSON.stringify(input)}`);
          return bulletinResponse;
        },
        duplicateBulletin: (id: string) => {
          calls.push(`duplicate:${id}`);
          return {
            ...bulletinResponse,
            bulletin: {
              ...bulletinResponse.bulletin,
              id: 'bulletin-2',
              publicCode: 'BET #0002',
            },
          };
        },
        createFixture: (input: unknown) => {
          calls.push(`fixture:${JSON.stringify(input)}`);
          return { fixture: { id: 'fixture-1' } };
        },
        listFixtures: () => ({ items: [] }),
        listMarkets: () => ({ items: [] }),
      } as unknown as BulletinService,
    });

    try {
      expect(
        (await app.inject({ method: 'GET', url: '/api/bulletins' })).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/bulletins',
            payload: { type: 'SINGLE', mode: 'PRE_MATCH', selections: [] },
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/bulletins/bulletin-1',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/bulletins/bulletin-1',
            payload: { type: 'MULTI', mode: 'LIVE', selections: [] },
          })
        ).statusCode,
      ).toBe(200);
      const duplicate = await app.inject({
        method: 'POST',
        url: '/api/bulletins/bulletin-1/duplicate',
      });
      expect(duplicate.statusCode).toBe(201);
      expect(
        duplicate.json<{ bulletin: { publicCode: string } }>().bulletin
          .publicCode,
      ).toBe('BET #0002');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/builder/fixtures',
            payload: { homeTeamId: 'team-1', awayTeamId: 'team-2' },
          })
        ).statusCode,
      ).toBe(201);
      expect(calls).toEqual([
        'create:{"type":"SINGLE","mode":"PRE_MATCH","selections":[]}',
        'get:bulletin-1',
        'update:bulletin-1:{"type":"MULTI","mode":"LIVE","selections":[]}',
        'duplicate:bulletin-1',
        'fixture:{"homeTeamId":"team-1","awayTeamId":"team-2"}',
      ]);
    } finally {
      await app.close();
    }
  });
});

describe('Bet Studio synchronization API', () => {
  it('exposes provider status and manual competition sync', async () => {
    const database = createMigratedTestDatabase();
    const app = buildApiApp({
      synchronizationService: new SynchronizationService(
        new DrizzleSyncRepository(database.db),
        {
          code: 'GOAL_API',
          displayName: 'GOAL API',
          capabilities: {
            competitions: true,
            teams: true,
            fixtures: true,
            liveScores: true,
            finalScores: true,
            fixtureStatistics: true,
            corners: false,
            teamLogos: false,
            competitionLogos: false,
          },
          listCompetitions: () =>
            Promise.resolve([
              {
                providerCode: 'GOAL_API',
                externalId: '152',
                name: 'Premier League',
                shortName: 'EPL',
                countryCode: 'GB',
                regionName: 'England',
                logoUrl: null,
              },
            ]),
          listTeams: () => Promise.resolve([]),
          listFixtures: () => Promise.resolve([]),
          getFixture: () => Promise.resolve(null),
        },
      ),
    });

    try {
      const status = await app.inject({
        method: 'GET',
        url: '/api/providers/goal/status',
      });
      expect(status.statusCode).toBe(200);
      expect(status.json<{ configured: boolean }>().configured).toBe(true);

      const sync = await app.inject({
        method: 'POST',
        url: '/api/sync/competitions',
      });
      expect(sync.statusCode).toBe(200);
      expect(sync.json<{ created: number; status: string }>()).toMatchObject({
        status: 'SUCCESS',
        created: 1,
      });
    } finally {
      await app.close();
      database.cleanup();
    }
  });
});

describe('Bet Studio settlement API', () => {
  it('exposes selection and bulletin settlement actions', async () => {
    const calls: string[] = [];
    const app = buildApiApp({
      settlementService: {
        reEvaluateSelection: (id: string) => {
          calls.push(`selection:${id}`);
          return {
            selectionId: id,
            calculatedStatus: 'GREEN',
            manualStatus: null,
            effectiveStatus: 'GREEN',
            result: {
              status: 'GREEN',
              evaluatorKey: 'TOTAL_GOALS',
              evaluatorVersion: 1,
              reasonCode: 'TOTAL_GOALS_MATCHED',
            },
            resultSnapshot: {},
          };
        },
        reEvaluateBulletin: (id: string) => {
          calls.push(`bulletin:${id}`);
          return { bulletinId: id, status: 'GREEN', selections: [] };
        },
        setManualOverride: (id: string, input: unknown) => {
          calls.push(`override:${id}:${JSON.stringify(input)}`);
          return {
            selectionId: id,
            calculatedStatus: 'GREEN',
            manualStatus: 'VOID',
            effectiveStatus: 'VOID',
            result: {
              status: 'GREEN',
              evaluatorKey: null,
              evaluatorVersion: null,
              reasonCode: 'MANUAL_SETTLEMENT_REQUIRED',
            },
            resultSnapshot: {},
          };
        },
        resetManualOverride: (id: string) => {
          calls.push(`reset:${id}`);
          return {
            selectionId: id,
            calculatedStatus: 'GREEN',
            manualStatus: null,
            effectiveStatus: 'GREEN',
            result: {
              status: 'GREEN',
              evaluatorKey: null,
              evaluatorVersion: null,
              reasonCode: 'MANUAL_SETTLEMENT_REQUIRED',
            },
            resultSnapshot: {},
          };
        },
      } as unknown as SettlementService,
    });

    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/selections/selection-1/evaluate',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/bulletins/bulletin-1/evaluate',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/selections/selection-1/settlement-override',
            payload: { status: 'VOID', reason: 'Manual review' },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: '/api/selections/selection-1/settlement-override',
          })
        ).statusCode,
      ).toBe(200);
      expect(calls).toEqual([
        'selection:selection-1',
        'bulletin:bulletin-1',
        'override:selection-1:{"status":"VOID","reason":"Manual review"}',
        'reset:selection-1',
      ]);
    } finally {
      await app.close();
    }
  });
});

describe('Bet Studio history API', () => {
  it('lists history, loads detail and updates fixture results', async () => {
    const calls: string[] = [];
    const app = buildApiApp({
      historyService: {
        listBulletins: (query: unknown) => {
          calls.push(`list:${JSON.stringify(query)}`);
          return { items: [] };
        },
        getBulletin: (id: string) => {
          calls.push(`detail:${id}`);
          return {
            bulletin: { id, publicCode: 'BET #0001' },
            selections: [],
            renders: [],
          };
        },
        updateFixtureResult: (id: string, input: unknown) => {
          calls.push(`fixture:${id}:${JSON.stringify(input)}`);
          return { status: 'FINISHED', homeScore: 2, awayScore: 1 };
        },
      } as unknown as HistoryService,
    });

    try {
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/history/bulletins?search=0001&status=GREEN',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/history/bulletins/bulletin-1',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/fixtures/fixture-1/result',
            payload: { status: 'FINISHED', homeScore: 2, awayScore: 1 },
          })
        ).statusCode,
      ).toBe(200);
      expect(calls).toEqual([
        'list:{"search":"0001","status":"GREEN"}',
        'detail:bulletin-1',
        'fixture:fixture-1:{"status":"FINISHED","homeScore":2,"awayScore":1}',
      ]);
    } finally {
      await app.close();
    }
  });
});
