// @vitest-environment node

import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  Competition,
  Fixture,
  Market,
  Provider,
  ProviderReference,
  Team,
  TeamAlias,
  Template,
  TemplateVersion,
} from '../../../domain/core/types.js';
import { createId } from '../../../domain/shared/ids.js';
import { nowUtc } from '../../../domain/shared/time.js';
import { DrizzleBulletinRepository } from './bulletin-repository.js';
import { DrizzleCompetitionRepository } from './competition-repository.js';
import { DrizzleFixtureRepository } from './fixture-repository.js';
import { DrizzleMarketRepository } from './market-repository.js';
import { DrizzleTeamRepository } from './team-repository.js';
import {
  createMigratedTestDatabase,
  type TestDatabase,
} from '../test-utils.js';
import {
  providerReferences,
  providers,
  templates,
  templateVersions,
  teams,
} from '../schema.js';

let database: TestDatabase | null = null;

afterEach(() => {
  database?.cleanup();
  database = null;
});

function createDb(): TestDatabase {
  database = createMigratedTestDatabase();
  return database;
}

function timestamp() {
  return nowUtc();
}

describe('Drizzle repositories', () => {
  it('round-trips competitions, teams, aliases, fixtures, markets and bulletins', async () => {
    const { db } = createDb();
    const competitions = new DrizzleCompetitionRepository(db);
    const teamRepository = new DrizzleTeamRepository(db);
    const fixtures = new DrizzleFixtureRepository(db);
    const markets = new DrizzleMarketRepository(db);
    const bulletins = new DrizzleBulletinRepository(db);
    const now = timestamp();

    const competition: Competition = {
      id: createId<'CompetitionId'>(),
      name: 'Liga Portugal',
      shortName: 'Liga PT',
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
      name: 'Original Home',
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
      name: 'Away Team',
    };
    teamRepository.save(homeTeam);
    teamRepository.save(awayTeam);

    const alias: TeamAlias = {
      id: createId<'TeamAliasId'>(),
      teamId: homeTeam.id,
      value: 'Home FC',
      normalizedValue: 'home fc',
      createdAt: now,
    };
    teamRepository.addAlias(alias);

    const fixture: Fixture = {
      id: createId<'FixtureId'>(),
      competitionId: competition.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      kickoffAt: now,
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      liveMinute: null,
      sourceType: 'MANUAL',
      createdAt: now,
      updatedAt: now,
    };
    fixtures.save(fixture, {
      fixtureId: fixture.id,
      halfTimeHomeScore: 1,
      halfTimeAwayScore: 0,
      homeCorners: 6,
      awayCorners: 4,
      extraData: { note: 'structured boundary' },
      updatedAt: now,
    });

    const market: Market = {
      id: createId<'MarketId'>(),
      code: 'OVER_2_5',
      name: 'Over 2.5 Goals',
      category: 'Total Goals',
      active: true,
      autoEvaluable: true,
      evaluatorKey: 'TOTAL_GOALS',
      parameters: { direction: 'OVER', line: 2.5 },
      createdAt: now,
      updatedAt: now,
    };
    markets.save(market);

    const template: Template = {
      id: createId<'TemplateId'>(),
      code: 'BETSTUDIO_FEED',
      name: 'Bet Studio Feed',
      bulletinType: 'SINGLE',
      mode: 'PRE_MATCH',
      active: true,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(templates).values(template);
    const templateVersion: TemplateVersion = {
      id: createId<'TemplateVersionId'>(),
      templateId: template.id,
      version: 1,
      format: 'FEED',
      config: { canvas: { width: 1080, height: 1350 } },
      createdAt: now,
    };
    await db.insert(templateVersions).values(templateVersion);

    const publicCode = bulletins.allocatePublicCode();
    const bulletin: Bulletin = {
      id: createId<'BulletinId'>(),
      publicCode,
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      status: 'PENDING',
      stake: '10.00' as Bulletin['stake'],
      totalOdd: '2.10' as Bulletin['totalOdd'],
      templateId: template.id,
      templateVersion: 1,
      renderConfig: {
        showCompetition: true,
        showDate: true,
        showTime: true,
        showStake: true,
        showTotalOdd: true,
        showResult: true,
        showBulletinCode: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    const selection: BulletinSelection = {
      id: createId<'BulletinSelectionId'>(),
      bulletinId: bulletin.id,
      position: 1,
      fixtureId: fixture.id,
      marketId: market.id,
      odd: '2.10' as BulletinSelection['odd'],
      calculatedStatus: 'PENDING',
      manualStatus: null,
      createdAt: now,
      updatedAt: now,
    };
    const snapshot: BulletinSelectionSnapshot = {
      selectionId: selection.id,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeTeamLogoAssetId: null,
      awayTeamLogoAssetId: null,
      competitionName: competition.name,
      marketCode: market.code,
      marketName: market.name,
      kickoffAt: fixture.kickoffAt,
      createdAt: now,
    };

    bulletins.saveAggregate({
      bulletin,
      selections: [
        {
          selection,
          snapshot,
          overrides: [
            {
              id: createId<'SettlementOverrideId'>(),
              selectionId: selection.id,
              previousStatus: 'PENDING',
              newStatus: null,
              reason: 'Reset to automatic',
              createdAt: now,
            },
          ],
        },
      ],
    });

    await db
      .update(teams)
      .set({ name: 'Renamed Home', updatedAt: timestamp() })
      .where(eq(teams.id, homeTeam.id));

    expect(competitions.findById(competition.id)).toMatchObject({
      name: 'Liga Portugal',
    });
    expect(teamRepository.listAliases(homeTeam.id)).toEqual([alias]);
    expect(fixtures.findById(fixture.id)).toMatchObject({
      fixture: { homeScore: 2, awayScore: 1 },
      details: { homeCorners: 6, awayCorners: 4 },
    });
    expect(markets.findByCode('OVER_2_5')).toMatchObject({
      parameters: { direction: 'OVER', line: 2.5 },
    });
    expect(bulletins.allocatePublicCode()).toBe('BET #0002');

    const savedBulletin = bulletins.findById(bulletin.id);
    expect(savedBulletin?.bulletin.publicCode).toBe('BET #0001');
    expect(savedBulletin?.bulletin.totalOdd).toBe('2.10');
    expect(savedBulletin?.selections[0]?.selection.odd).toBe('2.10');
    expect(savedBulletin?.selections[0]?.snapshot.homeTeamName).toBe(
      'Original Home',
    );
    expect(savedBulletin?.selections[0]?.overrides).toHaveLength(1);
  });

  it('enforces important uniqueness constraints', async () => {
    const { db } = createDb();
    const now = timestamp();
    const provider: Provider = {
      id: createId<'ProviderId'>(),
      code: 'GOAL_API',
      displayName: 'GOAL API',
      enabled: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(providers).values(provider);

    const reference: ProviderReference = {
      id: createId<'ProviderReferenceId'>(),
      providerId: provider.id,
      entityType: 'TEAM',
      localEntityId: 'local-team-1',
      externalId: 'external-team-1',
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(providerReferences).values(reference);

    expect(() =>
      db
        .insert(providerReferences)
        .values({ ...reference, id: createId<'ProviderReferenceId'>() })
        .run(),
    ).toThrow();
  });
});
