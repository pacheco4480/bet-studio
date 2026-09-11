import { describe, expect, it } from 'vitest';
import type { FootballDataProvider } from '../providers/football-provider.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { DrizzleSyncRepository } from '../../infrastructure/database/repositories/sync-repository.js';
import { createMigratedTestDatabase } from '../../infrastructure/database/test-utils.js';
import { SynchronizationService } from './synchronization-service.js';

function provider(
  overrides: Partial<FootballDataProvider> = {},
): FootballDataProvider {
  return {
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
    listTeams: () =>
      Promise.resolve([
        {
          providerCode: 'GOAL_API',
          externalId: 'home',
          competitionExternalId: '152',
          name: 'Arsenal',
          shortName: null,
          countryCode: 'GB',
          logoUrl: null,
        },
        {
          providerCode: 'GOAL_API',
          externalId: 'away',
          competitionExternalId: '152',
          name: 'Chelsea',
          shortName: null,
          countryCode: 'GB',
          logoUrl: null,
        },
      ]),
    listFixtures: () =>
      Promise.resolve([
        {
          providerCode: 'GOAL_API',
          externalId: 'fixture_1',
          competitionExternalId: '152',
          homeTeamExternalId: 'home',
          awayTeamExternalId: 'away',
          homeTeamName: 'Arsenal',
          awayTeamName: 'Chelsea',
          kickoffAt: '2026-09-11T19:45:00.000Z',
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 1,
          halfTimeHomeScore: 1,
          halfTimeAwayScore: 0,
          homeCorners: null,
          awayCorners: null,
        },
      ]),
    getFixture: () =>
      Promise.resolve({
        providerCode: 'GOAL_API',
        externalId: 'fixture_1',
        competitionExternalId: '152',
        homeTeamExternalId: 'home',
        awayTeamExternalId: 'away',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Chelsea',
        kickoffAt: '2026-09-11T19:45:00.000Z',
        status: 'FINISHED',
        homeScore: 3,
        awayScore: 1,
        halfTimeHomeScore: 1,
        halfTimeAwayScore: 0,
        homeCorners: null,
        awayCorners: null,
      }),
    ...overrides,
  };
}

function createHarness(testProvider: FootballDataProvider = provider()) {
  const database = createMigratedTestDatabase();
  const syncRepository = new DrizzleSyncRepository(database.db);
  return {
    catalog: new CatalogService(new DrizzleCatalogRepository(database.db)),
    service: new SynchronizationService(syncRepository, testProvider),
    syncRepository,
    cleanup: database.cleanup,
  };
}

describe('SynchronizationService', () => {
  it('syncs competitions idempotently through provider references', async () => {
    const { catalog, service, cleanup } = createHarness();
    try {
      expect(await service.syncCompetitions()).toMatchObject({
        status: 'SUCCESS',
        created: 1,
        updated: 0,
      });
      expect(await service.syncCompetitions()).toMatchObject({
        status: 'SUCCESS',
        created: 0,
        updated: 1,
      });
      expect(catalog.listCompetitions({ active: 'all' }).items).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('imports only the selected competition names by default', async () => {
    const { catalog, service, cleanup } = createHarness(
      provider({
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
            {
              providerCode: 'GOAL_API',
              externalId: '999',
              name: 'Random Youth Cup',
              shortName: null,
              countryCode: null,
              regionName: null,
              logoUrl: null,
            },
          ]),
      }),
    );
    try {
      expect(await service.syncCompetitions()).toMatchObject({
        processed: 1,
        created: 1,
      });
      expect(
        catalog
          .listCompetitions({ active: 'all' })
          .items.map((competition) => competition.name),
      ).toEqual(['Premier League']);
    } finally {
      cleanup();
    }
  });

  it('syncs teams and fixtures without duplicating mapped identities', async () => {
    const { catalog, service, syncRepository, cleanup } = createHarness();
    try {
      const competition =
        (await service.syncCompetitions(),
        catalog.listCompetitions({ active: 'all' }).items[0]);
      expect(await service.syncTeams(competition.id)).toMatchObject({
        created: 2,
        unresolved: 0,
      });
      expect(await service.syncFixtures({ date: '2026-09-11' })).toMatchObject({
        created: 1,
        unresolved: 0,
      });

      const providerRecord = syncRepository.findProviderByCode('GOAL_API');
      expect(providerRecord).not.toBeNull();
      const fixtureReference = syncRepository.findProviderReference(
        providerRecord!.id,
        'FIXTURE',
        'fixture_1',
      );
      expect(fixtureReference).not.toBeNull();

      expect(
        await service.syncFixtureResult(fixtureReference!.localEntityId),
      ).toMatchObject({ updated: 1 });
      expect(
        syncRepository.findFixture(fixtureReference!.localEntityId as never)
          ?.fixture.homeScore,
      ).toBe(3);
    } finally {
      cleanup();
    }
  });

  it('preserves local data when the provider fails', async () => {
    const { catalog, service, cleanup } = createHarness(
      provider({
        listCompetitions: () =>
          Promise.reject(new Error('network unavailable')),
      }),
    );
    try {
      catalog.createCompetition({ name: 'Local League' });

      expect(await service.syncCompetitions()).toMatchObject({
        status: 'FAILED',
        failed: 1,
      });
      expect(catalog.listCompetitions({ active: 'all' }).items).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
});
