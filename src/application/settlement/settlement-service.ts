import { z } from 'zod';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  Fixture,
  FixtureResultDetails,
  Market,
  SelectionResultSnapshot,
  SelectionStatus,
  SettlementOverride,
} from '../../domain/core/types.js';
import {
  aggregateBulletinStatus,
  evaluateMarket,
  resolveEffectiveStatus,
  type MarketEvaluationResult,
} from '../../domain/market/market-engine.js';
import { createId } from '../../domain/shared/ids.js';
import type {
  BulletinId,
  BulletinSelectionId,
  FixtureId,
  MarketId,
} from '../../domain/shared/ids.js';
import { nowUtc, type UtcDateString } from '../../domain/shared/time.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

export type SettlementBulletinAggregate = {
  bulletin: Bulletin;
  selections: Array<{
    selection: BulletinSelection;
    snapshot: BulletinSelectionSnapshot;
    resultSnapshot?: SelectionResultSnapshot;
    overrides?: SettlementOverride[];
  }>;
};

export type SettlementBulletinRepository = {
  findById(id: BulletinId): SettlementBulletinAggregate | null;
  findBySelectionId(
    id: BulletinSelectionId,
  ): SettlementBulletinAggregate | null;
  saveAggregate(aggregate: SettlementBulletinAggregate): void;
};

export type SettlementFixtureRepository = {
  findById(id: FixtureId): {
    fixture: Fixture;
    details: FixtureResultDetails | null;
  } | null;
};

export type SettlementMarketRepository = {
  findById(id: MarketId): Market | null;
};

export type EvaluatedSelection = {
  selectionId: BulletinSelectionId;
  calculatedStatus: SelectionStatus;
  manualStatus: SelectionStatus | null;
  effectiveStatus: SelectionStatus;
  result: MarketEvaluationResult;
  resultSnapshot: SelectionResultSnapshot;
};

export type BulletinEvaluationResult = {
  bulletinId: BulletinId;
  status: SelectionStatus;
  selections: EvaluatedSelection[];
};

const manualOverrideSchema = z.object({
  status: z.enum(['PENDING', 'GREEN', 'RED', 'VOID', 'MANUAL']),
  reason: z.string().trim().max(500).optional(),
});

export class SettlementService {
  constructor(
    private readonly bulletins: SettlementBulletinRepository,
    private readonly fixtures: SettlementFixtureRepository,
    private readonly markets: SettlementMarketRepository,
  ) {}

  reEvaluateSelection(selectionId: string): EvaluatedSelection {
    const aggregate = this.loadAggregateBySelection(selectionId);
    const item = this.findSelectionItem(aggregate, selectionId);
    const evaluated = this.evaluateSelection(item.selection);
    item.selection = {
      ...item.selection,
      calculatedStatus: evaluated.calculatedStatus,
      updatedAt: nowUtc(),
    };
    item.resultSnapshot = evaluated.resultSnapshot;
    aggregate.bulletin = this.withDerivedBulletinStatus(aggregate);
    this.bulletins.saveAggregate(aggregate);
    return evaluated;
  }

  reEvaluateBulletin(bulletinId: string): BulletinEvaluationResult {
    const aggregate = this.loadAggregateByBulletin(bulletinId);
    const selections = aggregate.selections.map((item) => {
      const evaluated = this.evaluateSelection(item.selection);
      item.selection = {
        ...item.selection,
        calculatedStatus: evaluated.calculatedStatus,
        updatedAt: nowUtc(),
      };
      item.resultSnapshot = evaluated.resultSnapshot;
      return evaluated;
    });
    aggregate.bulletin = this.withDerivedBulletinStatus(aggregate);
    this.bulletins.saveAggregate(aggregate);
    return {
      bulletinId: aggregate.bulletin.id,
      status: aggregate.bulletin.status,
      selections,
    };
  }

  setManualOverride(selectionId: string, input: unknown): EvaluatedSelection {
    const parsed = manualOverrideSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid settlement override');
    }

    const aggregate = this.loadAggregateBySelection(selectionId);
    const item = this.findSelectionItem(aggregate, selectionId);
    const createdAt = nowUtc();
    const override: SettlementOverride = {
      id: createId<'SettlementOverrideId'>(),
      selectionId: item.selection.id,
      previousStatus: item.selection.manualStatus,
      newStatus: parsed.data.status,
      reason: parsed.data.reason ?? null,
      createdAt,
    };
    item.selection = {
      ...item.selection,
      manualStatus: parsed.data.status,
      updatedAt: createdAt,
    };
    item.overrides = [...(item.overrides ?? []), override];
    aggregate.bulletin = this.withDerivedBulletinStatus(aggregate);
    this.bulletins.saveAggregate(aggregate);
    return this.toEvaluatedSelection(item.selection, item.resultSnapshot);
  }

  resetManualOverride(
    selectionId: string,
    input?: { reason?: string },
  ): EvaluatedSelection {
    const aggregate = this.loadAggregateBySelection(selectionId);
    const item = this.findSelectionItem(aggregate, selectionId);
    const createdAt = nowUtc();
    const override: SettlementOverride = {
      id: createId<'SettlementOverrideId'>(),
      selectionId: item.selection.id,
      previousStatus: item.selection.manualStatus,
      newStatus: null,
      reason: input?.reason ?? 'Reset to automatic',
      createdAt,
    };
    item.selection = {
      ...item.selection,
      manualStatus: null,
      updatedAt: createdAt,
    };
    item.overrides = [...(item.overrides ?? []), override];
    aggregate.bulletin = this.withDerivedBulletinStatus(aggregate);
    this.bulletins.saveAggregate(aggregate);
    return this.toEvaluatedSelection(item.selection, item.resultSnapshot);
  }

  private evaluateSelection(selection: BulletinSelection): EvaluatedSelection {
    if (!selection.fixtureId) {
      throw new ValidationError('Selection has no fixture');
    }
    if (!selection.marketId) {
      throw new ValidationError('Selection has no market');
    }

    const fixtureRecord = this.fixtures.findById(selection.fixtureId);
    if (!fixtureRecord) {
      throw new NotFoundError('Fixture not found');
    }
    const market = this.markets.findById(selection.marketId);
    if (!market) {
      throw new NotFoundError('Market not found');
    }

    const result = evaluateMarket({
      market: {
        code: market.code,
        autoEvaluable: market.autoEvaluable,
        evaluatorKey: market.evaluatorKey,
        parameters: market.parameters,
      },
      fixture: {
        status: fixtureRecord.fixture.status,
        homeScore: fixtureRecord.fixture.homeScore,
        awayScore: fixtureRecord.fixture.awayScore,
        halfTimeHomeScore: fixtureRecord.details?.halfTimeHomeScore ?? null,
        halfTimeAwayScore: fixtureRecord.details?.halfTimeAwayScore ?? null,
        homeCorners: fixtureRecord.details?.homeCorners ?? null,
        awayCorners: fixtureRecord.details?.awayCorners ?? null,
      },
    });
    const evaluatedAt = nowUtc();
    const resultSnapshot: SelectionResultSnapshot = {
      selectionId: selection.id,
      homeScore: fixtureRecord.fixture.homeScore,
      awayScore: fixtureRecord.fixture.awayScore,
      fixtureStatus: fixtureRecord.fixture.status,
      evaluatedAt,
      evaluationVersion: formatEvaluationVersion(result),
      resultSource:
        fixtureRecord.fixture.sourceType === 'SYNCED' ? 'PROVIDER' : 'FIXTURE',
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
    };
    const calculatedStatus = result.status;
    return {
      selectionId: selection.id,
      calculatedStatus,
      manualStatus: selection.manualStatus,
      effectiveStatus: resolveEffectiveStatus(
        calculatedStatus,
        selection.manualStatus,
      ),
      result,
      resultSnapshot,
    };
  }

  private withDerivedBulletinStatus(
    aggregate: SettlementBulletinAggregate,
  ): Bulletin {
    const status = aggregateBulletinStatus(
      aggregate.selections.map((item) =>
        resolveEffectiveStatus(
          item.selection.calculatedStatus,
          item.selection.manualStatus,
        ),
      ),
    );
    return { ...aggregate.bulletin, status, updatedAt: nowUtc() };
  }

  private toEvaluatedSelection(
    selection: BulletinSelection,
    resultSnapshot?: SelectionResultSnapshot,
  ): EvaluatedSelection {
    return {
      selectionId: selection.id,
      calculatedStatus: selection.calculatedStatus,
      manualStatus: selection.manualStatus,
      effectiveStatus: resolveEffectiveStatus(
        selection.calculatedStatus,
        selection.manualStatus,
      ),
      result: {
        status: selection.calculatedStatus,
        evaluatorKey: null,
        evaluatorVersion: resultSnapshot?.evaluationVersion
          ? Number(resultSnapshot.evaluationVersion.split('@')[1])
          : null,
        reasonCode: 'MANUAL_SETTLEMENT_REQUIRED',
      },
      resultSnapshot:
        resultSnapshot ??
        emptyResultSnapshot(selection.id, selection.updatedAt),
    };
  }

  private loadAggregateBySelection(
    selectionId: string,
  ): SettlementBulletinAggregate {
    const aggregate = this.bulletins.findBySelectionId(
      selectionId as BulletinSelectionId,
    );
    if (!aggregate) {
      throw new NotFoundError('Selection not found');
    }
    return aggregate;
  }

  private loadAggregateByBulletin(
    bulletinId: string,
  ): SettlementBulletinAggregate {
    const aggregate = this.bulletins.findById(bulletinId as BulletinId);
    if (!aggregate) {
      throw new NotFoundError('Bulletin not found');
    }
    return aggregate;
  }

  private findSelectionItem(
    aggregate: SettlementBulletinAggregate,
    selectionId: string,
  ): SettlementBulletinAggregate['selections'][number] {
    const item = aggregate.selections.find(
      (candidate) => candidate.selection.id === selectionId,
    );
    if (!item) {
      throw new NotFoundError('Selection not found');
    }
    return item;
  }
}

function formatEvaluationVersion(
  result: MarketEvaluationResult,
): string | null {
  if (!result.evaluatorKey || result.evaluatorVersion === null) return null;
  return `${result.evaluatorKey}@${result.evaluatorVersion}`;
}

function emptyResultSnapshot(
  selectionId: BulletinSelectionId,
  timestamp: UtcDateString,
): SelectionResultSnapshot {
  return {
    selectionId,
    homeScore: null,
    awayScore: null,
    fixtureStatus: null,
    evaluatedAt: null,
    evaluationVersion: null,
    resultSource: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
