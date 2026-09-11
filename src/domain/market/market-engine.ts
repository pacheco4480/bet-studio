import type { FixtureStatus, SelectionStatus } from '../core/types.js';
import {
  autoMarketConfigSchema,
  type AutoMarketConfig,
} from './market-config.js';

export type MarketEvaluationReasonCode =
  | 'FIXTURE_NOT_STARTED'
  | 'FIXTURE_LIVE'
  | 'FIXTURE_POSTPONED'
  | 'FIXTURE_CANCELLED'
  | 'FIXTURE_ABANDONED'
  | 'FIXTURE_UNKNOWN'
  | 'MARKET_MANUAL_ONLY'
  | 'MISSING_EVALUATOR'
  | 'UNSUPPORTED_EVALUATOR'
  | 'INVALID_MARKET_PARAMETERS'
  | 'MANUAL_SETTLEMENT_REQUIRED'
  | 'MISSING_SCORE'
  | 'MISSING_CORNERS'
  | 'MATCH_RESULT_MATCHED'
  | 'MATCH_RESULT_NOT_MATCHED'
  | 'DOUBLE_CHANCE_MATCHED'
  | 'DOUBLE_CHANCE_NOT_MATCHED'
  | 'TOTAL_GOALS_MATCHED'
  | 'TOTAL_GOALS_NOT_MATCHED'
  | 'BTTS_MATCHED'
  | 'BTTS_NOT_MATCHED'
  | 'TOTAL_CORNERS_MATCHED'
  | 'TOTAL_CORNERS_NOT_MATCHED'
  | 'COMPOSITE_MATCHED'
  | 'COMPOSITE_FAILED'
  | 'COMPOSITE_PENDING'
  | 'COMPOSITE_MANUAL'
  | 'COMPOSITE_INVALID';

export type MarketEvaluationInput = {
  market: {
    code: string;
    autoEvaluable: boolean;
    evaluatorKey: string | null;
    parameters: unknown;
  };
  fixture: {
    status: FixtureStatus;
    homeScore: number | null;
    awayScore: number | null;
    halfTimeHomeScore?: number | null;
    halfTimeAwayScore?: number | null;
    homeCorners?: number | null;
    awayCorners?: number | null;
  };
};

export type MarketEvaluationResult = {
  status: SelectionStatus;
  evaluatorKey: string | null;
  evaluatorVersion: number | null;
  reasonCode: MarketEvaluationReasonCode;
  details?: Record<string, unknown>;
};

const evaluatorVersions = {
  MATCH_RESULT: 1,
  DOUBLE_CHANCE: 1,
  TOTAL_GOALS: 1,
  BTTS: 1,
  TOTAL_CORNERS: 1,
  COMPOSITE: 1,
} as const;

export const evaluatorRegistry = {
  MATCH_RESULT: {
    key: 'MATCH_RESULT',
    version: evaluatorVersions.MATCH_RESULT,
  },
  DOUBLE_CHANCE: {
    key: 'DOUBLE_CHANCE',
    version: evaluatorVersions.DOUBLE_CHANCE,
  },
  TOTAL_GOALS: { key: 'TOTAL_GOALS', version: evaluatorVersions.TOTAL_GOALS },
  BTTS: { key: 'BTTS', version: evaluatorVersions.BTTS },
  TOTAL_CORNERS: {
    key: 'TOTAL_CORNERS',
    version: evaluatorVersions.TOTAL_CORNERS,
  },
  COMPOSITE: { key: 'COMPOSITE', version: evaluatorVersions.COMPOSITE },
} as const;

export function evaluateMarket(
  input: MarketEvaluationInput,
): MarketEvaluationResult {
  const stateResult = fixtureStateResult(
    input.fixture.status,
    input.market.evaluatorKey,
  );
  if (stateResult) return stateResult;
  if (!input.market.autoEvaluable)
    return result(
      'MANUAL',
      input.market.evaluatorKey,
      null,
      'MARKET_MANUAL_ONLY',
    );
  if (!input.market.evaluatorKey)
    return result('MANUAL', null, null, 'MISSING_EVALUATOR');

  const parsed = autoMarketConfigSchema.safeParse({
    evaluatorKey: input.market.evaluatorKey,
    parameters: input.market.parameters,
  });
  if (!parsed.success)
    return result(
      'MANUAL',
      input.market.evaluatorKey,
      null,
      'INVALID_MARKET_PARAMETERS',
    );

  if (parsed.data.evaluatorKey === 'COMPOSITE')
    return evaluateComposite(parsed.data, input.fixture);
  return evaluatePrimitive(parsed.data, input.fixture);
}

function fixtureStateResult(
  status: FixtureStatus,
  evaluatorKey: string | null,
): MarketEvaluationResult | null {
  const states: Partial<
    Record<FixtureStatus, [SelectionStatus, MarketEvaluationReasonCode]>
  > = {
    SCHEDULED: ['PENDING', 'FIXTURE_NOT_STARTED'],
    LIVE: ['PENDING', 'FIXTURE_LIVE'],
    POSTPONED: ['PENDING', 'FIXTURE_POSTPONED'],
    CANCELLED: ['VOID', 'FIXTURE_CANCELLED'],
    ABANDONED: ['MANUAL', 'FIXTURE_ABANDONED'],
    UNKNOWN: ['MANUAL', 'FIXTURE_UNKNOWN'],
  };
  const mapped = states[status];
  return mapped
    ? result(mapped[0], evaluatorKey, evaluatorVersion(evaluatorKey), mapped[1])
    : null;
}

function evaluatePrimitive(
  config: Exclude<AutoMarketConfig, { evaluatorKey: 'COMPOSITE' }>,
  fixture: MarketEvaluationInput['fixture'],
): MarketEvaluationResult {
  if (config.evaluatorKey === 'MATCH_RESULT') {
    if (!validScore(fixture.homeScore) || !validScore(fixture.awayScore))
      return result(
        'MANUAL',
        config.evaluatorKey,
        evaluatorVersions.MATCH_RESULT,
        'MISSING_SCORE',
      );
    const actual =
      fixture.homeScore > fixture.awayScore
        ? 'HOME'
        : fixture.homeScore < fixture.awayScore
          ? 'AWAY'
          : 'DRAW';
    const matched = actual === config.parameters.result;
    return result(
      matched ? 'GREEN' : 'RED',
      config.evaluatorKey,
      evaluatorVersions.MATCH_RESULT,
      matched ? 'MATCH_RESULT_MATCHED' : 'MATCH_RESULT_NOT_MATCHED',
      { actualResult: actual },
    );
  }
  if (config.evaluatorKey === 'DOUBLE_CHANCE') {
    if (!validScore(fixture.homeScore) || !validScore(fixture.awayScore))
      return result(
        'MANUAL',
        config.evaluatorKey,
        evaluatorVersions.DOUBLE_CHANCE,
        'MISSING_SCORE',
      );
    const actual =
      fixture.homeScore > fixture.awayScore
        ? 'HOME'
        : fixture.homeScore < fixture.awayScore
          ? 'AWAY'
          : 'DRAW';
    const matched =
      config.parameters.outcome === '1X'
        ? actual !== 'AWAY'
        : config.parameters.outcome === 'X2'
          ? actual !== 'HOME'
          : actual !== 'DRAW';
    return result(
      matched ? 'GREEN' : 'RED',
      config.evaluatorKey,
      evaluatorVersions.DOUBLE_CHANCE,
      matched ? 'DOUBLE_CHANCE_MATCHED' : 'DOUBLE_CHANCE_NOT_MATCHED',
      { actualResult: actual },
    );
  }
  if (config.evaluatorKey === 'BTTS') {
    if (!validScore(fixture.homeScore) || !validScore(fixture.awayScore))
      return result(
        'MANUAL',
        config.evaluatorKey,
        evaluatorVersions.BTTS,
        'MISSING_SCORE',
      );
    const bothScored = fixture.homeScore > 0 && fixture.awayScore > 0;
    const matched =
      config.parameters.selection === 'YES' ? bothScored : !bothScored;
    return result(
      matched ? 'GREEN' : 'RED',
      config.evaluatorKey,
      evaluatorVersions.BTTS,
      matched ? 'BTTS_MATCHED' : 'BTTS_NOT_MATCHED',
      { bothScored },
    );
  }
  if (config.evaluatorKey === 'TOTAL_GOALS') {
    if (!validScore(fixture.homeScore) || !validScore(fixture.awayScore))
      return result(
        'MANUAL',
        config.evaluatorKey,
        evaluatorVersions.TOTAL_GOALS,
        'MISSING_SCORE',
      );
    const totalGoals = fixture.homeScore + fixture.awayScore;
    const matched =
      config.parameters.direction === 'OVER'
        ? totalGoals > config.parameters.line
        : totalGoals < config.parameters.line;
    return result(
      matched ? 'GREEN' : 'RED',
      config.evaluatorKey,
      evaluatorVersions.TOTAL_GOALS,
      matched ? 'TOTAL_GOALS_MATCHED' : 'TOTAL_GOALS_NOT_MATCHED',
      {
        totalGoals,
        line: config.parameters.line,
        direction: config.parameters.direction,
      },
    );
  }
  if (!validScore(fixture.homeCorners) || !validScore(fixture.awayCorners))
    return result(
      'MANUAL',
      config.evaluatorKey,
      evaluatorVersions.TOTAL_CORNERS,
      'MISSING_CORNERS',
    );
  const totalCorners = fixture.homeCorners + fixture.awayCorners;
  const matched =
    config.parameters.direction === 'OVER'
      ? totalCorners > config.parameters.line
      : totalCorners < config.parameters.line;
  return result(
    matched ? 'GREEN' : 'RED',
    config.evaluatorKey,
    evaluatorVersions.TOTAL_CORNERS,
    matched ? 'TOTAL_CORNERS_MATCHED' : 'TOTAL_CORNERS_NOT_MATCHED',
    {
      totalCorners,
      line: config.parameters.line,
      direction: config.parameters.direction,
    },
  );
}

function evaluateComposite(
  config: Extract<AutoMarketConfig, { evaluatorKey: 'COMPOSITE' }>,
  fixture: MarketEvaluationInput['fixture'],
): MarketEvaluationResult {
  const children = config.parameters.conditions.map((condition) =>
    evaluatePrimitive(condition, fixture),
  );
  const statuses = children.map((child) => child.status);
  const matched =
    config.parameters.operator === 'AND'
      ? statuses.every((status) => status === 'GREEN')
      : statuses.some((status) => status === 'GREEN');
  const failed =
    config.parameters.operator === 'AND'
      ? statuses.includes('RED')
      : statuses.every((status) => status === 'RED');
  const manual = statuses.includes('MANUAL');
  const pending = statuses.includes('PENDING');
  const status: SelectionStatus = matched
    ? 'GREEN'
    : failed
      ? 'RED'
      : manual
        ? 'MANUAL'
        : pending
          ? 'PENDING'
          : 'MANUAL';
  const reasonCode =
    status === 'GREEN'
      ? 'COMPOSITE_MATCHED'
      : status === 'RED'
        ? 'COMPOSITE_FAILED'
        : status === 'PENDING'
          ? 'COMPOSITE_PENDING'
          : status === 'MANUAL'
            ? 'COMPOSITE_MANUAL'
            : 'COMPOSITE_INVALID';
  return result(status, 'COMPOSITE', evaluatorVersions.COMPOSITE, reasonCode, {
    childStatuses: statuses,
  });
}

function validScore(value: number | null | undefined): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function result(
  status: SelectionStatus,
  evaluatorKey: string | null,
  evaluatorVersion: number | null,
  reasonCode: MarketEvaluationReasonCode,
  details?: Record<string, unknown>,
): MarketEvaluationResult {
  return {
    status,
    evaluatorKey,
    evaluatorVersion,
    reasonCode,
    ...(details ? { details } : {}),
  };
}

function evaluatorVersion(evaluatorKey: string | null): number | null {
  if (!evaluatorKey) return null;
  return evaluatorKey in evaluatorRegistry
    ? evaluatorRegistry[evaluatorKey as keyof typeof evaluatorRegistry].version
    : null;
}

export function resolveEffectiveStatus(
  calculatedStatus: SelectionStatus,
  manualStatus: SelectionStatus | null,
): SelectionStatus {
  return manualStatus ?? calculatedStatus;
}

export function aggregateBulletinStatus(
  statuses: SelectionStatus[],
): SelectionStatus {
  if (statuses.includes('RED')) return 'RED';
  if (statuses.includes('PENDING')) return 'PENDING';
  if (statuses.includes('MANUAL')) return 'MANUAL';
  if (statuses.every((status) => status === 'VOID')) return 'VOID';
  return 'GREEN';
}
