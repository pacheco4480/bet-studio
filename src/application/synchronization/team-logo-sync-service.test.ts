// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { CatalogService } from '../catalog/catalog-service.js';
import type { TeamArtworkProvider } from '../providers/team-artwork-provider.js';
import type { AssetId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { assets } from '../../infrastructure/database/schema.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { DrizzleSyncRepository } from '../../infrastructure/database/repositories/sync-repository.js';
import { createMigratedTestDatabase } from '../../infrastructure/database/test-utils.js';
import { TeamLogoSyncService } from './team-logo-sync-service.js';

describe('TeamLogoSyncService', () => {
  it('returns a controlled failed result when setup fails', async () => {
    const service = new TeamLogoSyncService(
      {
        ensureProvider: () => {
          throw new Error('database unavailable');
        },
        listActiveCompetitions: () => [],
      } as never,
      {
        code: 'API_FOOTBALL',
        displayName: 'API-Football',
        supportsCompetition: () => false,
        listCountryArtwork: () => Promise.resolve([]),
        listTeamArtwork: () => Promise.resolve([]),
        searchTeamArtwork: () => Promise.resolve([]),
      },
      {
        cacheTeamLogo: () => Promise.resolve(null),
        cacheCompetitionLogo: () => Promise.resolve(null),
      },
    );

    await expect(service.syncAll()).resolves.toMatchObject({
      status: 'FAILED',
      competitionsProcessed: 0,
      message: 'database unavailable',
    });
  });

  it('caches a safely matched logo and remains idempotent', async () => {
    const database = createMigratedTestDatabase();
    const catalog = new CatalogService(
      new DrizzleCatalogRepository(database.db),
    );
    const repository = new DrizzleSyncRepository(database.db);
    const artworkProvider: TeamArtworkProvider = {
      code: 'API_FOOTBALL',
      displayName: 'API-Football',
      supportsCompetition: () => true,
      listCountryArtwork: () => Promise.resolve([]),
      listTeamArtwork: () =>
        Promise.resolve([
          {
            externalId: '40',
            name: 'Liverpool',
            country: 'England',
            logoUrl: 'https://media.example.test/liverpool.png',
          },
        ]),
      searchTeamArtwork: () => Promise.resolve([]),
    };
    const assetId = 'asset-liverpool' as AssetId;
    const service = new TeamLogoSyncService(repository, artworkProvider, {
      cacheTeamLogo: ({ providerId, url }) => {
        const now = nowUtc();
        database.db
          .insert(assets)
          .values({
            id: assetId,
            type: 'TEAM_LOGO',
            source: 'PROVIDER',
            filePath: 'assets/provider/team-logos/liverpool.png',
            contentHash: 'liverpool-logo-hash',
            mimeType: 'image/png',
            originalUrl: url,
            providerId,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .run();
        return Promise.resolve(assetId);
      },
      cacheCompetitionLogo: () => Promise.resolve(null),
    });

    try {
      const competition = catalog.createCompetition({
        name: 'Premier League',
        regionName: 'England',
      });
      const team = catalog.createTeam({ name: 'Liverpool' });
      catalog.assignTeamToCompetition(team.id, competition.id);

      expect(await service.syncAll()).toMatchObject({
        status: 'SUCCESS',
        cached: 1,
        unresolved: 0,
      });
      expect(repository.findTeam(team.id)?.logoAssetId).toBe(assetId);
      expect(await service.syncAll()).toMatchObject({
        status: 'SUCCESS',
        cached: 0,
        alreadyPresent: 1,
      });
    } finally {
      database.cleanup();
    }
  });

  it('reports unmatched provider teams without creating local records', async () => {
    const database = createMigratedTestDatabase();
    const catalog = new CatalogService(
      new DrizzleCatalogRepository(database.db),
    );
    const repository = new DrizzleSyncRepository(database.db);
    const service = new TeamLogoSyncService(
      repository,
      {
        code: 'API_FOOTBALL',
        displayName: 'API-Football',
        supportsCompetition: () => true,
        listCountryArtwork: () => Promise.resolve([]),
        listTeamArtwork: () =>
          Promise.resolve([
            {
              externalId: '99',
              name: 'Unknown FC',
              country: null,
              logoUrl: 'https://media.example.test/unknown.png',
            },
          ]),
        searchTeamArtwork: () => Promise.resolve([]),
      },
      {
        cacheTeamLogo: () => Promise.resolve(null),
        cacheCompetitionLogo: () => Promise.resolve(null),
      },
    );

    try {
      const competition = catalog.createCompetition({
        name: 'Premier League',
        regionName: 'England',
      });
      const team = catalog.createTeam({ name: 'Liverpool' });
      catalog.assignTeamToCompetition(team.id, competition.id);
      expect(await service.syncAll()).toMatchObject({
        status: 'PARTIAL',
        cached: 0,
        unresolved: 1,
      });
      expect(catalog.listTeams({ active: 'all' }).items).toHaveLength(1);
      expect(repository.findTeam(team.id)?.logoAssetId).toBeNull();
    } finally {
      database.cleanup();
    }
  });

  it('matches explicit cross-provider team names safely', async () => {
    const database = createMigratedTestDatabase();
    const catalog = new CatalogService(
      new DrizzleCatalogRepository(database.db),
    );
    const repository = new DrizzleSyncRepository(database.db);
    const assetId = 'asset-arsenal' as AssetId;
    const service = new TeamLogoSyncService(
      repository,
      {
        code: 'API_FOOTBALL',
        displayName: 'API-Football',
        supportsCompetition: () => true,
        listCountryArtwork: () => Promise.resolve([]),
        listTeamArtwork: () =>
          Promise.resolve([
            {
              externalId: '42',
              name: 'Arsenal',
              country: 'England',
              logoUrl: 'https://media.example.test/arsenal.png',
            },
          ]),
        searchTeamArtwork: () => Promise.resolve([]),
      },
      {
        cacheTeamLogo: ({ providerId, url }) => {
          const now = nowUtc();
          database.db
            .insert(assets)
            .values({
              id: assetId,
              type: 'TEAM_LOGO',
              source: 'PROVIDER',
              filePath: 'assets/provider/team-logos/arsenal.png',
              contentHash: 'arsenal-logo-hash',
              mimeType: 'image/png',
              originalUrl: url,
              providerId,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          return Promise.resolve(assetId);
        },
        cacheCompetitionLogo: () => Promise.resolve(null),
      },
      0,
    );

    try {
      const competition = catalog.createCompetition({
        name: 'Premier League',
        regionName: 'England',
      });
      const team = catalog.createTeam({ name: 'Arsenal FC' });
      catalog.assignTeamToCompetition(team.id, competition.id);

      expect(await service.syncAll()).toMatchObject({ cached: 1 });
      expect(repository.findTeam(team.id)?.logoAssetId).toBe(assetId);
    } finally {
      database.cleanup();
    }
  });

  it('caches competition country flags without replacing manual logos', async () => {
    const database = createMigratedTestDatabase();
    const catalog = new CatalogService(
      new DrizzleCatalogRepository(database.db),
    );
    const repository = new DrizzleSyncRepository(database.db);
    const flagAssetId = 'asset-england-flag' as AssetId;
    const service = new TeamLogoSyncService(
      repository,
      {
        code: 'API_FOOTBALL',
        displayName: 'API-Football',
        supportsCompetition: () => false,
        listCountryArtwork: () =>
          Promise.resolve([
            {
              code: 'GB-ENG',
              name: 'England',
              flagUrl: 'https://media.api-sports.io/flags/gb-eng.svg',
            },
          ]),
        listTeamArtwork: () => Promise.resolve([]),
        searchTeamArtwork: () => Promise.resolve([]),
      },
      {
        cacheTeamLogo: () => Promise.resolve(null),
        cacheCompetitionLogo: ({ providerId, url }) => {
          const now = nowUtc();
          database.db
            .insert(assets)
            .values({
              id: flagAssetId,
              type: 'COMPETITION_LOGO',
              source: 'PROVIDER',
              filePath: 'assets/provider/competition-logos/england.svg',
              contentHash: 'england-flag-hash',
              mimeType: 'image/svg+xml',
              originalUrl: url,
              providerId,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          return Promise.resolve(flagAssetId);
        },
      },
    );

    try {
      const competition = catalog.createCompetition({
        name: 'Premier League',
        regionName: 'England',
      });

      expect(await service.syncAll()).toMatchObject({
        competitionFlagsCached: 1,
      });
      expect(repository.findCompetition(competition.id)?.logoAssetId).toBe(
        flagAssetId,
      );
    } finally {
      database.cleanup();
    }
  });
});
