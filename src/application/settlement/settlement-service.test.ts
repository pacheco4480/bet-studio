// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  Competition,
  Fixture,
  FixtureResultDetails,
  Market,
  Team,
  Template,
  TemplateVersion,
} from '../../domain/core/types.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { DrizzleBulletinRepository } from '../../infrastructure/database/repositories/bulletin-repository.js';
import { DrizzleCompetitionRepository } from '../../infrastructure/database/repositories/competition-repository.js';
import { DrizzleFixtureRepository } from '../../infrastructure/database/repositories/fixture-repository.js';
import { DrizzleMarketRepository } from '../../infrastructure/database/repositories/market-repository.js';
import { DrizzleTeamRepository } from '../../infrastructure/database/repositories/team-repository.js';
import {
  createMigratedTestDatabase,
  type TestDatabase,
} from '../../infrastructure/database/test-utils.js';
import {
  selectionResultSnapshotEvents,
  templates,
  templateVersions,
} from '../../infrastructure/database/schema.js';
import { SettlementService } from './settlement-service.js';

let database: TestDatabase | null = null;

afterEach(() => {
  database?.cleanup();
  database = null;
});

function createHarness() {
  database = createMigratedTestDatabase();
  const bulletins = new DrizzleBulletinRepository(database.db);
  const fixtures = new DrizzleFixtureRepository(database.db);
  const markets = new DrizzleMarketRepository(database.db);
  return {
    db: database.db,
    bulletins,
    fixtures,
    markets,
    service: new SettlementService(bulletins, fixtures, markets),
  };
}

describe('SettlementService', () => {
  it('persists calculated selection result and result snapshot', () => {
    const harness = createHarness();
    const scenario = seedScenario(harness, {
      marketParameters: { direction: 'OVER', line: 2.5 },
      fixtureScore: [2, 1],
    });

    const result = harness.service.reEvaluateSelection(scenario.selection.id);
    const saved = harness.bulletins.findById(scenario.bulletin.id);

    expect(result).toMatchObject({
      calculatedStatus: 'GREEN',
      effectiveStatus: 'GREEN',
      result: {
        evaluatorKey: 'TOTAL_GOALS',
        evaluatorVersion: 1,
        reasonCode: 'TOTAL_GOALS_MATCHED',
      },
    });
    expect(saved?.selections[0]?.selection.calculatedStatus).toBe('GREEN');
    expect(saved?.selections[0]?.resultSnapshot).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      fixtureStatus: 'FINISHED',
      evaluationVersion: 'TOTAL_GOALS@1',
      resultSource: 'FIXTURE',
    });
  });

  it('preserves manual overrides during re-evaluation and supports reset', () => {
    const harness = createHarness();
    const scenario = seedScenario(harness, {
      marketParameters: { direction: 'OVER', line: 2.5 },
      fixtureScore: [2, 1],
    });

    harness.service.setManualOverride(scenario.selection.id, {
      status: 'RED',
      reason: 'Manual bookmaker result',
    });
    const evaluated = harness.service.reEvaluateSelection(
      scenario.selection.id,
    );

    expect(evaluated.calculatedStatus).toBe('GREEN');
    expect(evaluated.manualStatus).toBe('RED');
    expect(evaluated.effectiveStatus).toBe('RED');
    expect(
      harness.bulletins.findById(scenario.bulletin.id)?.bulletin.status,
    ).toBe('RED');

    const reset = harness.service.resetManualOverride(scenario.selection.id);
    expect(reset.effectiveStatus).toBe('GREEN');
    expect(
      harness.bulletins.findById(scenario.bulletin.id)?.bulletin.status,
    ).toBe('GREEN');
    expect(
      harness.db.select().from(selectionResultSnapshotEvents).all(),
    ).toHaveLength(1);
  });

  it('re-evaluates all selections in a bulletin after a fixture score correction', () => {
    const harness = createHarness();
    const scenario = seedScenario(harness, {
      bulletinType: 'MULTI',
      marketParameters: { direction: 'OVER', line: 2.5 },
      fixtureScore: [1, 1],
      secondMarketParameters: { selection: 'YES' },
      secondEvaluatorKey: 'BTTS',
    });

    let result = harness.service.reEvaluateBulletin(scenario.bulletin.id);
    expect(result.status).toBe('RED');

    harness.fixtures.save({
      ...scenario.fixture,
      homeScore: 2,
      awayScore: 1,
      updatedAt: nowUtc(),
    });

    result = harness.service.reEvaluateBulletin(scenario.bulletin.id);
    expect(result.status).toBe('GREEN');
    expect(
      result.selections.map((selection) => selection.calculatedStatus),
    ).toEqual(['GREEN', 'GREEN']);
  });

  it('handles missing corners and evaluates manual and synced fixtures identically', () => {
    const harness = createHarness();
    const missingCorners = seedScenario(harness, {
      evaluatorKey: 'TOTAL_CORNERS',
      marketParameters: { direction: 'OVER', line: 9.5 },
      fixtureScore: [0, 0],
    });

    expect(
      harness.service.reEvaluateSelection(missingCorners.selection.id).result,
    ).toMatchObject({
      status: 'MANUAL',
      reasonCode: 'MISSING_CORNERS',
    });

    const manual = seedScenario(harness, {
      marketCode: 'MANUAL_FIXTURE_OVER',
      marketParameters: { direction: 'OVER', line: 2.5 },
      fixtureScore: [2, 1],
      sourceType: 'MANUAL',
    });
    const synced = seedScenario(harness, {
      marketCode: 'SYNCED_FIXTURE_OVER',
      marketParameters: { direction: 'OVER', line: 2.5 },
      fixtureScore: [2, 1],
      sourceType: 'SYNCED',
    });

    expect(
      harness.service.reEvaluateSelection(manual.selection.id).result,
    ).toMatchObject({
      status: 'GREEN',
      reasonCode: 'TOTAL_GOALS_MATCHED',
    });
    expect(
      harness.service.reEvaluateSelection(synced.selection.id).result,
    ).toMatchObject({
      status: 'GREEN',
      reasonCode: 'TOTAL_GOALS_MATCHED',
    });
  });
});

function seedScenario(
  harness: ReturnType<typeof createHarness>,
  options: {
    bulletinType?: 'SINGLE' | 'MULTI';
    evaluatorKey?: string;
    marketCode?: string;
    marketParameters: Market['parameters'];
    fixtureScore: [number, number];
    sourceType?: Fixture['sourceType'];
    secondEvaluatorKey?: string;
    secondMarketParameters?: Market['parameters'];
  },
) {
  const now = nowUtc();
  const competition: Competition = {
    id: createId<'CompetitionId'>(),
    name: `Competition ${createId<'CompetitionId'>()}`,
    shortName: null,
    countryCode: 'PT',
    regionName: null,
    logoAssetId: null,
    active: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  new DrizzleCompetitionRepository(harness.db).save(competition);

  const teams = new DrizzleTeamRepository(harness.db);
  const homeTeam: Team = {
    id: createId<'TeamId'>(),
    name: `Home ${createId<'TeamId'>()}`,
    shortName: null,
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
    name: `Away ${createId<'TeamId'>()}`,
  };
  teams.save(homeTeam);
  teams.save(awayTeam);

  const fixture: Fixture = {
    id: createId<'FixtureId'>(),
    competitionId: competition.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    kickoffAt: now,
    status: 'FINISHED',
    homeScore: options.fixtureScore[0],
    awayScore: options.fixtureScore[1],
    liveMinute: null,
    sourceType: options.sourceType ?? 'MANUAL',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const fixtureDetails: FixtureResultDetails = {
    fixtureId: fixture.id,
    halfTimeHomeScore: null,
    halfTimeAwayScore: null,
    homeCorners: null,
    awayCorners: null,
    extraData: {},
    updatedAt: now,
  };
  harness.fixtures.save(fixture, fixtureDetails);

  const market: Market = {
    id: createId<'MarketId'>(),
    code:
      options.marketCode ??
      `MARKET_${createId<'MarketId'>().replaceAll('-', '_')}`,
    name: 'Market',
    category: null,
    active: true,
    autoEvaluable: true,
    evaluatorKey: options.evaluatorKey ?? 'TOTAL_GOALS',
    parameters: options.marketParameters,
    createdAt: now,
    updatedAt: now,
  };
  harness.markets.save(market);

  const secondMarket = options.secondMarketParameters
    ? {
        ...market,
        id: createId<'MarketId'>(),
        code: `MARKET_${createId<'MarketId'>().replaceAll('-', '_')}`,
        evaluatorKey: options.secondEvaluatorKey ?? 'TOTAL_GOALS',
        parameters: options.secondMarketParameters,
      }
    : null;
  if (secondMarket) harness.markets.save(secondMarket);

  const template: Template = {
    id: createId<'TemplateId'>(),
    code: `TEMPLATE_${createId<'TemplateId'>().replaceAll('-', '_')}`,
    name: 'Template',
    bulletinType: options.bulletinType ?? 'SINGLE',
    mode: 'PRE_MATCH',
    active: true,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  harness.db.insert(templates).values(template).run();
  const templateVersion: TemplateVersion = {
    id: createId<'TemplateVersionId'>(),
    templateId: template.id,
    version: 1,
    format: 'FEED',
    config: { canvas: { width: 1080, height: 1350 } },
    createdAt: now,
  };
  harness.db.insert(templateVersions).values(templateVersion).run();

  const bulletin: Bulletin = {
    id: createId<'BulletinId'>(),
    publicCode: harness.bulletins.allocatePublicCode(),
    type: options.bulletinType ?? 'SINGLE',
    mode: 'PRE_MATCH',
    status: 'PENDING',
    stake: null,
    totalOdd: null,
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
  const selection: BulletinSelection = createSelection(
    bulletin.id,
    fixture.id,
    market.id,
    1,
    now,
  );
  const aggregateSelections = [
    {
      selection,
      snapshot: createSelectionSnapshot(
        selection,
        homeTeam,
        awayTeam,
        competition,
        market,
        fixture.kickoffAt,
        now,
      ),
    },
  ];

  if (secondMarket) {
    const secondSelection = createSelection(
      bulletin.id,
      fixture.id,
      secondMarket.id,
      2,
      now,
    );
    aggregateSelections.push({
      selection: secondSelection,
      snapshot: createSelectionSnapshot(
        secondSelection,
        homeTeam,
        awayTeam,
        competition,
        secondMarket,
        fixture.kickoffAt,
        now,
      ),
    });
  }

  harness.bulletins.saveAggregate({
    bulletin,
    selections: aggregateSelections,
  });

  return { bulletin, selection, fixture, market };
}

function createSelection(
  bulletinId: Bulletin['id'],
  fixtureId: Fixture['id'],
  marketId: Market['id'],
  position: number,
  now: string,
): BulletinSelection {
  return {
    id: createId<'BulletinSelectionId'>(),
    bulletinId,
    position,
    fixtureId,
    marketId,
    odd: '2.00' as BulletinSelection['odd'],
    calculatedStatus: 'PENDING',
    manualStatus: null,
    createdAt: now as BulletinSelection['createdAt'],
    updatedAt: now as BulletinSelection['updatedAt'],
  };
}

function createSelectionSnapshot(
  selection: BulletinSelection,
  homeTeam: Team,
  awayTeam: Team,
  competition: Competition,
  market: Market,
  kickoffAt: Fixture['kickoffAt'],
  now: string,
): BulletinSelectionSnapshot {
  return {
    selectionId: selection.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeTeamLogoAssetId: null,
    awayTeamLogoAssetId: null,
    competitionName: competition.name,
    marketCode: market.code,
    marketName: market.name,
    kickoffAt,
    createdAt: now as BulletinSelectionSnapshot['createdAt'],
  };
}
