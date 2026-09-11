import { and, desc, eq, like, or } from 'drizzle-orm';
import type {
  BulletinAggregateDto,
  BulletinListItem,
  BulletinRepository,
  FixtureOption,
} from '../../../application/bulletins/bulletin-service.js';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  Competition,
  Fixture,
  Market,
  Team,
  Template,
  TemplateVersion,
} from '../../../domain/core/types.js';
import { assertSelectionCount } from '../../../domain/core/invariants.js';
import { createId } from '../../../domain/shared/ids.js';
import type {
  BulletinId,
  FixtureId,
  MarketId,
  TemplateId,
} from '../../../domain/shared/ids.js';
import { nowUtc } from '../../../domain/shared/time.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  bulletinCodeSequence,
  bulletinSelectionSnapshots,
  bulletinSelections,
  bulletins,
  competitions,
  fixtures,
  markets,
  teams,
  templates,
  templateVersions,
} from '../schema.js';

export class DrizzleBulletinBuilderRepository implements BulletinRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  allocatePublicCode(): string {
    return this.db.transaction((tx) => {
      const current = tx
        .select()
        .from(bulletinCodeSequence)
        .where(eq(bulletinCodeSequence.id, 1))
        .get();
      const nextValue = current?.nextValue ?? 1;

      if (current) {
        tx.update(bulletinCodeSequence)
          .set({ nextValue: nextValue + 1 })
          .where(eq(bulletinCodeSequence.id, 1))
          .run();
      } else {
        tx.insert(bulletinCodeSequence)
          .values({ id: 1, nextValue: nextValue + 1 })
          .run();
      }

      return `BET #${String(nextValue).padStart(4, '0')}`;
    });
  }

  ensureDefaultTemplate(input: {
    type: Bulletin['type'];
    mode: Bulletin['mode'];
  }): { templateId: TemplateId; version: number } {
    const code = `BETSTUDIO_${input.type}_${input.mode}`;
    const existing = this.db
      .select()
      .from(templates)
      .where(eq(templates.code, code))
      .get() as Template | undefined;

    if (existing) {
      return { templateId: existing.id, version: existing.currentVersion };
    }

    const now = nowUtc();
    const template: Template = {
      id: createId<'TemplateId'>(),
      code,
      name: `Bet Studio ${input.type} ${input.mode}`,
      bulletinType: input.type,
      mode: input.mode,
      active: true,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const version: TemplateVersion = {
      id: createId<'TemplateVersionId'>(),
      templateId: template.id,
      version: 1,
      format: 'FEED',
      config: { preview: true },
      createdAt: now,
    };

    this.db.transaction((tx) => {
      tx.insert(templates).values(template).run();
      tx.insert(templateVersions).values(version).run();
    });

    return { templateId: template.id, version: 1 };
  }

  list(): BulletinListItem[] {
    const rows = this.db
      .select()
      .from(bulletins)
      .orderBy(desc(bulletins.updatedAt))
      .all() as Bulletin[];

    return rows.map((bulletin) => ({
      id: bulletin.id,
      publicCode: bulletin.publicCode,
      type: bulletin.type,
      mode: bulletin.mode,
      status: bulletin.status,
      totalOdd: bulletin.totalOdd,
      selectionCount: this.db
        .select()
        .from(bulletinSelections)
        .where(eq(bulletinSelections.bulletinId, bulletin.id))
        .all().length,
      createdAt: bulletin.createdAt,
      updatedAt: bulletin.updatedAt,
    }));
  }

  findById(id: BulletinId): BulletinAggregateDto | null {
    const bulletin = this.db
      .select()
      .from(bulletins)
      .where(eq(bulletins.id, id))
      .get() as Bulletin | undefined;

    if (!bulletin) return null;

    const selections = this.db
      .select()
      .from(bulletinSelections)
      .where(eq(bulletinSelections.bulletinId, id))
      .orderBy(bulletinSelections.position)
      .all() as BulletinSelection[];

    return {
      bulletin,
      selections: selections.map((selection) => {
        const snapshot = this.db
          .select()
          .from(bulletinSelectionSnapshots)
          .where(eq(bulletinSelectionSnapshots.selectionId, selection.id))
          .get() as BulletinSelectionSnapshot | undefined;
        if (!snapshot)
          throw new Error('Bulletin selection snapshot is missing');
        return {
          selection,
          snapshot,
          fixture: selection.fixtureId
            ? this.getFixtureContext(selection.fixtureId)
            : null,
          market: selection.marketId
            ? this.getMarket(selection.marketId)
            : null,
          effectiveStatus: selection.manualStatus ?? selection.calculatedStatus,
        };
      }),
    };
  }

  saveReplacingAggregate(aggregate: BulletinAggregateDto): void {
    assertSelectionCount(aggregate.bulletin.type, aggregate.selections.length);
    this.db.transaction((tx) => {
      tx.insert(bulletins)
        .values(aggregate.bulletin)
        .onConflictDoUpdate({
          target: bulletins.id,
          set: aggregate.bulletin,
        })
        .run();

      const keepSelectionIds = new Set(
        aggregate.selections.map((item) => item.selection.id),
      );
      const existingSelections = tx
        .select()
        .from(bulletinSelections)
        .where(eq(bulletinSelections.bulletinId, aggregate.bulletin.id))
        .all() as BulletinSelection[];
      for (const existing of existingSelections) {
        if (!keepSelectionIds.has(existing.id)) {
          tx.delete(bulletinSelections)
            .where(eq(bulletinSelections.id, existing.id))
            .run();
        }
      }

      for (const item of aggregate.selections) {
        tx.insert(bulletinSelections)
          .values(item.selection)
          .onConflictDoUpdate({
            target: bulletinSelections.id,
            set: item.selection,
          })
          .run();
        tx.insert(bulletinSelectionSnapshots)
          .values(item.snapshot)
          .onConflictDoUpdate({
            target: bulletinSelectionSnapshots.selectionId,
            set: item.snapshot,
          })
          .run();
      }
    });
  }

  getFixtureContext(id: FixtureId): FixtureOption | null {
    const row = this.db
      .select({
        fixture: fixtures,
        homeTeam: teams,
        competition: competitions,
      })
      .from(fixtures)
      .innerJoin(teams, eq(teams.id, fixtures.homeTeamId))
      .leftJoin(competitions, eq(competitions.id, fixtures.competitionId))
      .where(eq(fixtures.id, id))
      .get();

    if (!row) return null;
    const fixture = row.fixture as Fixture;
    const awayTeam = this.db
      .select()
      .from(teams)
      .where(eq(teams.id, fixture.awayTeamId))
      .get() as Team | undefined;
    if (!awayTeam) return null;
    return {
      fixture,
      homeTeam: row.homeTeam as Team,
      awayTeam,
      competition: (row.competition as Competition | null) ?? null,
    };
  }

  getMarket(id: MarketId): Market | null {
    return (
      (this.db.select().from(markets).where(eq(markets.id, id)).get() as
        Market | undefined) ?? null
    );
  }

  saveFixture(fixture: Fixture): void {
    this.db
      .insert(fixtures)
      .values(fixture)
      .onConflictDoUpdate({ target: fixtures.id, set: fixture })
      .run();
  }

  listFixtures(input: { search?: string; limit: number }): FixtureOption[] {
    const pattern = input.search?.trim() ? `%${input.search.trim()}%` : null;
    const rows = this.db
      .select({ fixture: fixtures })
      .from(fixtures)
      .leftJoin(competitions, eq(competitions.id, fixtures.competitionId))
      .leftJoin(teams, eq(teams.id, fixtures.homeTeamId))
      .where(
        pattern
          ? or(
              like(competitions.name, pattern),
              like(teams.name, pattern),
              like(fixtures.status, pattern),
            )
          : undefined,
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(input.limit)
      .all();

    return rows
      .map((row) => this.getFixtureContext((row.fixture as Fixture).id))
      .filter((fixture): fixture is FixtureOption => fixture !== null);
  }

  listMarkets(input: {
    search?: string;
    activeOnly: boolean;
    limit: number;
  }): Market[] {
    const pattern = input.search?.trim() ? `%${input.search.trim()}%` : null;
    return this.db
      .select()
      .from(markets)
      .where(
        and(
          input.activeOnly ? eq(markets.active, true) : undefined,
          pattern
            ? or(
                like(markets.name, pattern),
                like(markets.code, pattern),
                like(markets.category, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(markets.category, markets.name)
      .limit(input.limit)
      .all() as Market[];
  }
}
