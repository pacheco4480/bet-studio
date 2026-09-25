// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import type {
  Competition,
  Fixture,
  Market,
  Team,
} from '../../domain/core/types.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import {
  createMigratedTestDatabase,
  type TestDatabase,
} from '../../infrastructure/database/test-utils.js';
import { DrizzleBulletinBuilderRepository } from '../../infrastructure/database/repositories/bulletin-builder-repository.js';
import { DrizzleCompetitionRepository } from '../../infrastructure/database/repositories/competition-repository.js';
import { DrizzleFixtureRepository } from '../../infrastructure/database/repositories/fixture-repository.js';
import { DrizzleMarketRepository } from '../../infrastructure/database/repositories/market-repository.js';
import { DrizzleTeamRepository } from '../../infrastructure/database/repositories/team-repository.js';
import { BulletinService } from './bulletin-service.js';

let database: TestDatabase | null = null;

afterEach(() => {
  database?.cleanup();
  database = null;
});

function harness() {
  database = createMigratedTestDatabase();
  const repository = new DrizzleBulletinBuilderRepository(database.db);
  const service = new BulletinService(repository);
  const seed = seedCatalog(database);
  return { repository, service, seed };
}

describe('BulletinService', () => {
  it('creates a SINGLE bulletin with trusted snapshots and total odd', () => {
    const { service, seed } = harness();

    const created = service.createBulletin({
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      stake: '10,50',
      selections: [
        {
          fixtureId: seed.fixtures[0].id,
          marketId: seed.markets[0].id,
          odd: '1,85',
        },
      ],
    });

    expect(created.bulletin).toMatchObject({
      publicCode: 'BET #0001',
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      stake: '10.50',
      totalOdd: '1.85',
      status: 'PENDING',
    });
    expect(created.selections[0]?.snapshot).toMatchObject({
      homeTeamName: 'Very Long Home Team Name United',
      awayTeamName: 'Away City',
      competitionName: 'Liga Portugal',
      marketCode: 'TEST_OVER_2_5',
    });
  });

  it.each([
    ['SINGLE', 2],
    ['MULTI', 1],
    ['MULTI', 11],
  ])('rejects invalid %s selection counts', (type, count) => {
    const { service, seed } = harness();
    expect(() =>
      service.createBulletin({
        type,
        mode: 'PRE_MATCH',
        selections: Array.from({ length: count }, (_, index) => ({
          fixtureId: seed.fixtures[index % seed.fixtures.length].id,
          marketId: seed.markets[0].id,
          odd: '1.50',
        })),
      }),
    ).toThrow();
  });

  it('creates a MULTI with 10 selections and decimal-safe total odd', () => {
    const { service, seed } = harness();
    const created = service.createBulletin({
      type: 'MULTI',
      mode: 'LIVE',
      selections: Array.from({ length: 10 }, (_, index) => ({
        fixtureId: seed.fixtures[index % seed.fixtures.length].id,
        marketId: seed.markets[index % seed.markets.length].id,
        odd: index < 3 ? '1.10' : '1.50',
      })),
    });

    expect(created.selections).toHaveLength(10);
    expect(created.bulletin.totalOdd).toBe('22.74');
  });

  it('rejects repeated fixtures in the same bulletin', () => {
    const { service, seed } = harness();

    expect(() =>
      service.createBulletin({
        type: 'MULTI',
        mode: 'PRE_MATCH',
        selections: [
          {
            fixtureId: seed.fixtures[0].id,
            marketId: seed.markets[0].id,
            odd: '1.50',
          },
          {
            fixtureId: seed.fixtures[0].id,
            marketId: seed.markets[1].id,
            odd: '2.00',
          },
        ],
      }),
    ).toThrow('Each fixture can only be used once in the same bulletin');
  });

  it('updates selections while preserving order and unchanged selection identity', () => {
    const { service, seed } = harness();
    const created = service.createBulletin({
      type: 'MULTI',
      mode: 'PRE_MATCH',
      selections: [
        {
          fixtureId: seed.fixtures[0].id,
          marketId: seed.markets[0].id,
          odd: '1.50',
        },
        {
          fixtureId: seed.fixtures[1].id,
          marketId: seed.markets[1].id,
          odd: '2.00',
        },
      ],
    });

    const updated = service.updateBulletin(created.bulletin.id, {
      type: 'MULTI',
      mode: 'PRE_MATCH',
      selections: [
        {
          id: created.selections[1]?.selection.id,
          fixtureId: seed.fixtures[1].id,
          marketId: seed.markets[1].id,
          odd: '2.00',
        },
        {
          id: created.selections[0]?.selection.id,
          fixtureId: seed.fixtures[0].id,
          marketId: seed.markets[0].id,
          odd: '1.55',
        },
      ],
    });

    expect(updated.selections.map((item) => item.selection.id)).toEqual([
      created.selections[1]?.selection.id,
      created.selections[0]?.selection.id,
    ]);
    expect(updated.selections.map((item) => item.selection.position)).toEqual([
      1, 2,
    ]);
    expect(updated.bulletin.totalOdd).toBe('3.10');
  });

  it('duplicates with fresh IDs, fresh public code and independent snapshots', () => {
    const { service, seed } = harness();
    const original = service.createBulletin({
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      selections: [
        {
          fixtureId: seed.fixtures[0].id,
          marketId: seed.markets[0].id,
          odd: '1.50',
        },
      ],
    });

    seed.teams.save({
      ...seed.homeTeam,
      name: 'Renamed Home',
      updatedAt: nowUtc(),
    });
    const duplicate = service.duplicateBulletin(original.bulletin.id);

    expect(duplicate.bulletin.id).not.toBe(original.bulletin.id);
    expect(duplicate.bulletin.publicCode).toBe('BET #0002');
    expect(duplicate.selections[0]?.selection.id).not.toBe(
      original.selections[0]?.selection.id,
    );
    expect(original.selections[0]?.snapshot.homeTeamName).toBe(
      'Very Long Home Team Name United',
    );
    expect(duplicate.selections[0]?.snapshot.homeTeamName).toBe('Renamed Home');
  });

  it('keeps inactive markets readable for existing bulletins', () => {
    const { service, seed } = harness();
    const created = service.createBulletin({
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      selections: [
        {
          fixtureId: seed.fixtures[0].id,
          marketId: seed.markets[0].id,
          odd: '1.50',
        },
      ],
    });

    seed.markets.save({
      ...seed.markets[0],
      active: false,
      updatedAt: nowUtc(),
    });

    expect(
      service.getBulletin(created.bulletin.id).selections[0]?.market?.active,
    ).toBe(false);
    expect(service.listMarkets({ activeOnly: true }).items).not.toContainEqual(
      expect.objectContaining({ id: seed.markets[0].id }),
    );
  });

  it('creates a local manual fixture for builder fallback', () => {
    const { service, seed } = harness();

    const fixture = service.createFixture({
      competitionId: seed.competition.id,
      homeTeamId: seed.homeTeam.id,
      awayTeamId: seed.awayTeam.id,
      kickoffAt: '2026-09-11T20:00:00.000Z',
      status: 'SCHEDULED',
    });

    expect(fixture.fixture).toMatchObject({
      competitionId: seed.competition.id,
      homeTeamId: seed.homeTeam.id,
      awayTeamId: seed.awayTeam.id,
      sourceType: 'MANUAL',
    });
    expect(fixture.homeTeam.name).toBe(seed.homeTeam.name);
  });

  it('hides finished old fixtures from the builder list by default', () => {
    const { repository, service, seed } = harness();
    repository.saveFixture({
      ...seed.fixtures[0],
      id: createId<'FixtureId'>(),
      kickoffAt: '2026-01-01T12:00:00.000Z' as never,
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      updatedAt: nowUtc(),
    });

    expect(
      service
        .listFixtures({ limit: 20 })
        .items.every((item) => item.fixture.status !== 'FINISHED'),
    ).toBe(true);
    expect(
      service
        .listFixtures({ limit: 20, upcomingOnly: false })
        .items.some((item) => item.fixture.status === 'FINISHED'),
    ).toBe(true);
  });

  it('archives fixtures without deleting them from explicit management lists', () => {
    const { service, seed } = harness();

    const archived = service.setFixtureArchived(seed.fixtures[0].id, true);

    expect(archived.fixture.archivedAt).not.toBeNull();
    expect(
      service
        .listFixtures({ limit: 20, upcomingOnly: false })
        .items.some((item) => item.fixture.id === seed.fixtures[0].id),
    ).toBe(false);
    expect(
      service
        .listFixtures({
          limit: 20,
          upcomingOnly: false,
          includeArchived: true,
        })
        .items.some((item) => item.fixture.id === seed.fixtures[0].id),
    ).toBe(true);

    expect(
      service.setFixtureArchived(seed.fixtures[0].id, false).fixture,
    ).toMatchObject({ archivedAt: null });
  });
});

function seedCatalog(database: TestDatabase) {
  const now = nowUtc();
  const competitions = new DrizzleCompetitionRepository(database.db);
  const teams = new DrizzleTeamRepository(database.db);
  const fixtures = new DrizzleFixtureRepository(database.db);
  const markets = new DrizzleMarketRepository(database.db);
  const competition: Competition = {
    id: createId<'CompetitionId'>(),
    name: 'Liga Portugal',
    shortName: 'LP',
    countryCode: 'PT',
    regionName: null,
    logoAssetId: null,
    active: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  competitions.save(competition);
  const homeTeam: Team = {
    id: createId<'TeamId'>(),
    name: 'Very Long Home Team Name United',
    shortName: 'Home',
    countryCode: 'PT',
    logoAssetId: null,
    active: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const awayTeam: Team = {
    ...homeTeam,
    id: createId<'TeamId'>(),
    name: 'Away City',
  };
  const thirdTeam: Team = {
    ...homeTeam,
    id: createId<'TeamId'>(),
    name: 'Third FC',
  };
  teams.save(homeTeam);
  teams.save(awayTeam);
  teams.save(thirdTeam);

  const seededFixtures = Array.from({ length: 10 }, (_, index): Fixture => {
    const pair =
      index % 3 === 0
        ? [homeTeam.id, awayTeam.id]
        : index % 3 === 1
          ? [awayTeam.id, thirdTeam.id]
          : [thirdTeam.id, homeTeam.id];
    return {
      id: createId<'FixtureId'>(),
      competitionId: competition.id,
      homeTeamId: pair[0],
      awayTeamId: pair[1],
      kickoffAt: now,
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      liveMinute: null,
      sourceType: 'MANUAL',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });
  seededFixtures.forEach((fixture) => fixtures.save(fixture));

  const marketA: Market = {
    id: createId<'MarketId'>(),
    code: 'TEST_OVER_2_5',
    name: 'Over 2.5 Goals',
    category: 'Total Goals',
    active: true,
    autoEvaluable: true,
    evaluatorKey: 'TOTAL_GOALS',
    parameters: { direction: 'OVER', line: 2.5 },
    createdAt: now,
    updatedAt: now,
  };
  const marketB: Market = {
    ...marketA,
    id: createId<'MarketId'>(),
    code: 'TEST_BTTS_YES',
    name: 'Both Teams Score',
    category: 'BTTS',
    evaluatorKey: 'BTTS',
    parameters: { selection: 'YES' },
  };
  markets.save(marketA);
  markets.save(marketB);

  return {
    competition,
    homeTeam,
    awayTeam,
    teams,
    fixtures: seededFixtures,
    markets: Object.assign([marketA, marketB], {
      save: markets.save.bind(markets),
    }),
  };
}
