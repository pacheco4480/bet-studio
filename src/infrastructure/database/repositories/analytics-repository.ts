import { eq } from 'drizzle-orm';
import type { SelectionStatus } from '../../../domain/core/types.js';
import type {
  AnalyticsBulletinRow,
  AnalyticsRepository,
  AnalyticsSelectionRow,
} from '../../../application/analytics/analytics-service.js';
import { resolveEffectiveStatus } from '../../../domain/market/market-engine.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  bulletinSelectionSnapshots,
  bulletinSelections,
  bulletins,
  markets,
} from '../schema.js';

export class DrizzleAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  listBulletins(): AnalyticsBulletinRow[] {
    return this.db
      .select({
        id: bulletins.id,
        type: bulletins.type,
        mode: bulletins.mode,
        status: bulletins.status,
        stake: bulletins.stake,
        totalOdd: bulletins.totalOdd,
        createdAt: bulletins.createdAt,
      })
      .from(bulletins)
      .all() as AnalyticsBulletinRow[];
  }

  listSelections(): AnalyticsSelectionRow[] {
    const rows = this.db
      .select({
        bulletinId: bulletinSelections.bulletinId,
        calculatedStatus: bulletinSelections.calculatedStatus,
        manualStatus: bulletinSelections.manualStatus,
        odd: bulletinSelections.odd,
        marketName: bulletinSelectionSnapshots.marketName,
        marketCategory: markets.category,
        competitionName: bulletinSelectionSnapshots.competitionName,
      })
      .from(bulletinSelections)
      .innerJoin(
        bulletinSelectionSnapshots,
        eq(bulletinSelectionSnapshots.selectionId, bulletinSelections.id),
      )
      .leftJoin(markets, eq(markets.id, bulletinSelections.marketId))
      .all();

    return rows.map((row): AnalyticsSelectionRow => ({
      bulletinId: row.bulletinId,
      effectiveStatus: resolveEffectiveStatus(
        row.calculatedStatus as SelectionStatus,
        row.manualStatus as SelectionStatus | null,
      ),
      odd: row.odd,
      marketName: row.marketName,
      marketCategory: row.marketCategory,
      competitionName: row.competitionName,
    }));
  }
}
