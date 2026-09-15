// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import type {
  Competition,
  Fixture,
  Market,
  RenderRecord,
  Team,
} from '../../domain/core/types.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { DrizzleBulletinBuilderRepository } from '../../infrastructure/database/repositories/bulletin-builder-repository.js';
import { DrizzleCompetitionRepository } from '../../infrastructure/database/repositories/competition-repository.js';
import { DrizzleFixtureRepository } from '../../infrastructure/database/repositories/fixture-repository.js';
import { DrizzleMarketRepository } from '../../infrastructure/database/repositories/market-repository.js';
import { DrizzleTeamRepository } from '../../infrastructure/database/repositories/team-repository.js';
import { selectionResultSnapshots } from '../../infrastructure/database/schema.js';
import {
  createMigratedTestDatabase,
  type TestDatabase,
} from '../../infrastructure/database/test-utils.js';
import { BulletinService } from '../bulletins/bulletin-service.js';
import { betStudioFeedTemplateV1 } from './feed-template.js';
import { stableHash } from './fingerprint.js';
import { createRenderPlan } from './layout.js';
import {
  FEED_HEIGHT,
  FEED_WIDTH,
  type BulletinRenderModel,
  type RenderExport,
} from './render-model.js';
import { RenderingService } from './rendering-service.js';

let database: TestDatabase | null = null;

afterEach(() => {
  database?.cleanup();
  database = null;
});

describe('rendering', () => {
  it.each([1, 2, 3, 4, 6, 8, 10])(
    'creates valid FEED geometry for %i selections',
    (count) => {
      const plan = createRenderPlan(
        {
          publicCode: 'BET #0001',
          type: count === 1 ? 'SINGLE' : 'MULTI',
          mode: 'PRE_MATCH',
          overallStatus: 'PENDING',
          stake: '10.00',
          totalOdd: '2.00',
          createdAt: '2026-09-11T12:00:00.000Z',
          display: {
            showCompetition: true,
            showDate: true,
            showTime: true,
            showStake: true,
            showTotalOdd: true,
            showResult: true,
            showBulletinCode: true,
          },
          selections: Array.from({ length: count }, (_, index) => ({
            position: index + 1,
            homeTeam: {
              name: 'Very Long Home Team Name United',
              shortName: null,
              logo: null,
            },
            awayTeam: { name: 'Away City', shortName: null, logo: null },
            competitionName: 'Liga Portugal',
            marketCode: 'OVER_2_5',
            marketName: 'Over 2.5 Goals',
            odd: '1.50',
            kickoffDate: '11 SET',
            kickoffTime: '20:00',
            status: 'PENDING',
            resultText: null,
            liveMinute: null,
          })),
        },
        betStudioFeedTemplateV1,
      );

      expect(plan.width).toBe(FEED_WIDTH);
      expect(plan.height).toBe(FEED_HEIGHT);
      expect(plan.cards).toHaveLength(count);
      expect(
        plan.cards.at(-1)!.y + plan.cards.at(-1)!.height,
      ).toBeLessThanOrEqual(
        betStudioFeedTemplateV1.regions.selections.y +
          betStudioFeedTemplateV1.regions.selections.height,
      );
    },
  );

  it('creates stable canonical fingerprints independent of object key order', () => {
    expect(stableHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(stableHash({ odd: '1.50' })).not.toBe(stableHash({ odd: '1.51' }));
  });

  it('exports a persisted bulletin and stores render metadata', async () => {
    database = createMigratedTestDatabase();
    const bulletinRepository = new DrizzleBulletinBuilderRepository(
      database.db,
    );
    const recordRepository = new MemoryRenderRecordRepository();
    const renderer = new FakeRenderer();
    const service = new RenderingService(
      bulletinRepository,
      recordRepository,
      renderer,
      dirname(database.path),
    );
    const bulletinService = new BulletinService(bulletinRepository);
    const seed = seedCatalog(database);

    const bulletin = bulletinService.createBulletin({
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      stake: '10.00',
      selections: [
        {
          fixtureId: seed.fixture.id,
          marketId: seed.market.id,
          odd: '2.00',
        },
      ],
    });
    const result = await service.renderBulletin(bulletin.bulletin.id);

    expect(result).toMatchObject({
      bulletinId: bulletin.bulletin.id,
      format: 'FEED',
      width: FEED_WIDTH,
      height: FEED_HEIGHT,
    });
    const record = recordRepository.getRenderRecord(result.renderId);
    expect(record).toMatchObject({
      bulletinId: bulletin.bulletin.id,
      templateVersion: 1,
      rendererVersion: '1',
      fingerprint: result.fingerprint,
      width: FEED_WIDTH,
      height: FEED_HEIGHT,
    });
  });

  it('renders saved result snapshots for historical bulletins', async () => {
    database = createMigratedTestDatabase();
    const bulletinRepository = new DrizzleBulletinBuilderRepository(
      database.db,
    );
    const renderer = new FakeRenderer();
    const service = new RenderingService(
      bulletinRepository,
      new MemoryRenderRecordRepository(),
      renderer,
      dirname(database.path),
    );
    const bulletinService = new BulletinService(bulletinRepository);
    const seed = seedCatalog(database);
    const bulletin = bulletinService.createBulletin({
      type: 'SINGLE',
      mode: 'PRE_MATCH',
      selections: [
        {
          fixtureId: seed.fixture.id,
          marketId: seed.market.id,
          odd: '2.00',
        },
      ],
    });
    const [selectionItem] = bulletin.selections;
    const selection = selectionItem.selection;
    database.db
      .insert(selectionResultSnapshots)
      .values({
        selectionId: selection.id,
        homeScore: 2,
        awayScore: 1,
        fixtureStatus: 'FINISHED',
        evaluatedAt: '2026-09-11T22:00:00.000Z',
        evaluationVersion: 'TOTAL_GOALS@1',
        resultSource: 'PROVIDER',
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      })
      .run();

    await service.renderBulletin(bulletin.bulletin.id);

    expect(renderer.lastModel?.selections[0]?.resultText).toBe('2-1');
  });
});

class FakeRenderer {
  lastModel: BulletinRenderModel | null = null;

  render(input: {
    model: BulletinRenderModel;
    fingerprint: string;
    renderInputHash: string;
  }): Promise<RenderExport> {
    this.lastModel = input.model;
    return Promise.resolve({
      png: createPngHeader(FEED_WIDTH, FEED_HEIGHT),
      width: FEED_WIDTH,
      height: FEED_HEIGHT,
      fingerprint: input.fingerprint,
      renderInputHash: input.renderInputHash,
    });
  }
}

class MemoryRenderRecordRepository {
  private readonly records = new Map<string, RenderRecord>();

  saveRenderRecord(record: RenderRecord): void {
    this.records.set(record.id, record);
  }

  getRenderRecord(id: string): RenderRecord | null {
    return this.records.get(id) ?? null;
  }
}

function createPngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

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
    name: 'Home FC',
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
    name: 'Away FC',
  };
  teams.save(homeTeam);
  teams.save(awayTeam);
  const fixture: Fixture = {
    id: createId<'FixtureId'>(),
    competitionId: competition.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    kickoffAt: '2026-09-11T20:00:00.000Z' as never,
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    liveMinute: null,
    sourceType: 'MANUAL',
    createdAt: now,
    updatedAt: now,
  };
  fixtures.save(fixture);
  const market: Market = {
    id: createId<'MarketId'>(),
    code: 'TEST_RENDER_OVER_2_5',
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
  return { fixture, market };
}
