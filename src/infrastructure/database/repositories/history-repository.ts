import { and, desc, eq, like, or } from 'drizzle-orm';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  Fixture,
  FixtureResultDetails,
  Market,
  RenderRecord,
  SelectionResultSnapshot,
  SelectionStatus,
  SettlementOverride,
} from '../../../domain/core/types.js';
import {
  type BulletinHistoryDetail,
  type BulletinHistoryItem,
  type HistoryFilters,
  type HistoryRepository,
  mapRenderRecord,
  type ResultTimelineEvent,
} from '../../../application/history/history-service.js';
import { resolveEffectiveStatus } from '../../../domain/market/market-engine.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  bulletinSelectionSnapshots,
  bulletinSelections,
  bulletins,
  fixtureResultDetails,
  fixtures,
  markets,
  renderRecords,
  selectionResultSnapshotEvents,
  selectionResultSnapshots,
  settlementOverrides,
} from '../schema.js';

type SelectionResultEventRow = SelectionResultSnapshot & {
  id: string;
  calculatedStatus: SelectionStatus | null;
};

export class DrizzleHistoryRepository implements HistoryRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  listBulletins(filters: Required<HistoryFilters>): BulletinHistoryItem[] {
    const search = filters.search.trim();
    const searchPattern = search ? `%${search.replace(/^BET\s*#?/i, '')}%` : '';
    const rows = this.db
      .select()
      .from(bulletins)
      .where(
        and(
          filters.status !== 'all'
            ? eq(bulletins.status, filters.status)
            : undefined,
          filters.type !== 'all' ? eq(bulletins.type, filters.type) : undefined,
          filters.mode !== 'all' ? eq(bulletins.mode, filters.mode) : undefined,
          search
            ? or(
                like(bulletins.publicCode, `%${search}%`),
                like(bulletins.publicCode, searchPattern),
              )
            : undefined,
        ),
      )
      .orderBy(desc(bulletins.updatedAt), desc(bulletins.createdAt))
      .limit(filters.limit)
      .all() as Bulletin[];

    return rows.map((bulletin) => {
      const selectionCount = this.db
        .select()
        .from(bulletinSelections)
        .where(eq(bulletinSelections.bulletinId, bulletin.id))
        .all().length;
      const latestRender = this.listRenderRecords(bulletin.id)[0] ?? null;
      return {
        id: bulletin.id,
        publicCode: bulletin.publicCode,
        type: bulletin.type,
        mode: bulletin.mode,
        status: bulletin.status,
        totalOdd: bulletin.totalOdd,
        selectionCount,
        createdAt: bulletin.createdAt,
        updatedAt: bulletin.updatedAt,
        latestRender,
      };
    });
  }

  getBulletinDetail(id: string): BulletinHistoryDetail | null {
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
      selections: selections.map((selection) =>
        this.getSelectionDetail(selection),
      ),
      renders: this.listRenderRecords(bulletin.id),
    };
  }

  updateFixtureResult(fixture: Fixture, details: FixtureResultDetails): void {
    this.db.transaction((tx) => {
      tx.insert(fixtures)
        .values(fixture)
        .onConflictDoUpdate({ target: fixtures.id, set: fixture })
        .run();
      tx.insert(fixtureResultDetails)
        .values(details)
        .onConflictDoUpdate({
          target: fixtureResultDetails.fixtureId,
          set: details,
        })
        .run();
    });
  }

  getFixtureResult(fixtureId: string): {
    fixture: Fixture;
    details: FixtureResultDetails | null;
  } | null {
    const fixture = this.db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, fixtureId))
      .get() as Fixture | undefined;
    if (!fixture) return null;
    const details = this.db
      .select()
      .from(fixtureResultDetails)
      .where(eq(fixtureResultDetails.fixtureId, fixtureId))
      .get() as FixtureResultDetails | undefined;
    return { fixture, details: details ?? null };
  }

  private getSelectionDetail(selection: BulletinSelection) {
    const snapshot = this.db
      .select()
      .from(bulletinSelectionSnapshots)
      .where(eq(bulletinSelectionSnapshots.selectionId, selection.id))
      .get() as BulletinSelectionSnapshot | undefined;
    if (!snapshot) throw new Error('Bulletin selection snapshot is missing');
    const market = selection.marketId
      ? (this.db
          .select()
          .from(markets)
          .where(eq(markets.id, selection.marketId))
          .get() as Market | undefined)
      : null;
    const fixture = selection.fixtureId
      ? this.getFixtureResult(selection.fixtureId)
      : null;
    const currentResult = this.db
      .select()
      .from(selectionResultSnapshots)
      .where(eq(selectionResultSnapshots.selectionId, selection.id))
      .get() as SelectionResultSnapshot | undefined;

    return {
      selection,
      snapshot,
      market: market ?? null,
      fixture,
      calculatedStatus: selection.calculatedStatus,
      manualStatus: selection.manualStatus,
      effectiveStatus: resolveEffectiveStatus(
        selection.calculatedStatus,
        selection.manualStatus,
      ),
      currentResult: currentResult ?? null,
      timeline: this.listTimeline(selection.id),
    };
  }

  private listTimeline(selectionId: string): ResultTimelineEvent[] {
    const resultEvents = this.db
      .select()
      .from(selectionResultSnapshotEvents)
      .where(eq(selectionResultSnapshotEvents.selectionId, selectionId))
      .orderBy(selectionResultSnapshotEvents.createdAt)
      .all() as SelectionResultEventRow[];
    const overrideEvents = this.db
      .select()
      .from(settlementOverrides)
      .where(eq(settlementOverrides.selectionId, selectionId))
      .orderBy(settlementOverrides.createdAt)
      .all() as SettlementOverride[];

    return [
      ...resultEvents.map((event): ResultTimelineEvent => ({
        type: 'CALCULATED',
        selectionId: event.selectionId,
        status: event.calculatedStatus,
        fixtureStatus: event.fixtureStatus,
        score:
          event.homeScore !== null && event.awayScore !== null
            ? `${event.homeScore}-${event.awayScore}`
            : null,
        evaluationVersion: event.evaluationVersion,
        resultSource: event.resultSource,
        createdAt: event.createdAt,
      })),
      ...overrideEvents.map((event): ResultTimelineEvent => ({
        type: 'OVERRIDE',
        selectionId: event.selectionId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        reason: event.reason,
        createdAt: event.createdAt,
      })),
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private listRenderRecords(bulletinId: string) {
    return (
      this.db
        .select()
        .from(renderRecords)
        .where(eq(renderRecords.bulletinId, bulletinId))
        .orderBy(desc(renderRecords.createdAt))
        .all() as RenderRecord[]
    ).map(mapRenderRecord);
  }
}
