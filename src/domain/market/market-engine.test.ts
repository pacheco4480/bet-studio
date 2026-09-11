import { describe, expect, it } from 'vitest';
import {
  aggregateBulletinStatus,
  evaluateMarket,
  evaluatorRegistry,
  resolveEffectiveStatus,
} from './market-engine.js';

const finished = (
  homeScore: number | null,
  awayScore: number | null,
  extra = {},
) => ({
  status: 'FINISHED' as const,
  homeScore,
  awayScore,
  ...extra,
});

describe('market engine', () => {
  it.each([
    ['HOME', 2, 1, 'GREEN'],
    ['HOME', 0, 0, 'RED'],
    ['DRAW', 2, 2, 'GREEN'],
    ['DRAW', 1, 0, 'RED'],
    ['AWAY', 0, 2, 'GREEN'],
    ['AWAY', 3, 1, 'RED'],
  ])('evaluates match result %s', (selection, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'RESULT',
          autoEvaluable: true,
          evaluatorKey: 'MATCH_RESULT',
          parameters: { result: selection },
        },
        fixture: finished(home, away),
      }).status,
    ).toBe(status);
  });

  it.each([
    ['OVER', 2.5, 2, 1, 'GREEN'],
    ['OVER', 2.5, 1, 1, 'RED'],
    ['UNDER', 2.5, 1, 1, 'GREEN'],
    ['UNDER', 2.5, 2, 1, 'RED'],
  ])('evaluates total goals', (direction, line, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'GOALS',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_GOALS',
          parameters: { direction, line },
        },
        fixture: finished(home, away),
      }).status,
    ).toBe(status);
  });

  it.each([
    ['OVER', 9.5, 6, 5, 'GREEN'],
    ['OVER', 9.5, 4, 5, 'RED'],
    ['UNDER', 9.5, 4, 4, 'GREEN'],
    ['UNDER', 9.5, 5, 5, 'RED'],
    ['OVER', 9.5, 0, 0, 'RED'],
  ])('evaluates total corners', (direction, line, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'CORNERS',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_CORNERS',
          parameters: { direction, line },
        },
        fixture: finished(0, 0, { homeCorners: home, awayCorners: away }),
      }).status,
    ).toBe(status);
  });

  it.each([
    ['1X', 2, 1, 'GREEN'],
    ['1X', 0, 1, 'RED'],
    ['X2', 0, 1, 'GREEN'],
    ['X2', 2, 1, 'RED'],
    ['12', 2, 1, 'GREEN'],
    ['12', 1, 1, 'RED'],
  ])('evaluates double chance', (outcome, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'DC',
          autoEvaluable: true,
          evaluatorKey: 'DOUBLE_CHANCE',
          parameters: { outcome },
        },
        fixture: finished(home, away),
      }).status,
    ).toBe(status);
  });

  it.each([
    ['YES', 1, 1, 'GREEN'],
    ['YES', 1, 0, 'RED'],
    ['NO', 0, 0, 'GREEN'],
    ['NO', 1, 1, 'RED'],
  ])('evaluates BTTS', (selection, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'BTTS',
          autoEvaluable: true,
          evaluatorKey: 'BTTS',
          parameters: { selection },
        },
        fixture: finished(home, away),
      }).status,
    ).toBe(status);
  });

  it('handles fixture states before market evaluation', () => {
    for (const [status, expected] of [
      ['SCHEDULED', 'PENDING'],
      ['LIVE', 'PENDING'],
      ['POSTPONED', 'PENDING'],
      ['CANCELLED', 'VOID'],
      ['ABANDONED', 'MANUAL'],
      ['UNKNOWN', 'MANUAL'],
    ] as const) {
      expect(
        evaluateMarket({
          market: {
            code: 'X',
            autoEvaluable: true,
            evaluatorKey: 'BTTS',
            parameters: { selection: 'YES' },
          },
          fixture: { status, homeScore: 4, awayScore: 0 },
        }).status,
      ).toBe(expected);
    }
  });

  it('returns manual for invalid or missing facts', () => {
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_GOALS',
          parameters: { direction: 'OVER', line: 2.25 },
        },
        fixture: finished(2, 1),
      }).status,
    ).toBe('MANUAL');
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_CORNERS',
          parameters: { direction: 'OVER', line: 9.5 },
        },
        fixture: finished(2, 1),
      }).reasonCode,
    ).toBe('MISSING_CORNERS');
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: true,
          evaluatorKey: 'MATCH_RESULT',
          parameters: { result: 'HOME' },
        },
        fixture: finished(-1, 0),
      }).status,
    ).toBe('MANUAL');
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: true,
          evaluatorKey: 'TOTAL_CORNERS',
          parameters: { direction: 'UNDER', line: 9.5 },
        },
        fixture: finished(0, 0, { homeCorners: -2, awayCorners: 4 }),
      }).status,
    ).toBe('MANUAL');
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: true,
          evaluatorKey: 'UNKNOWN',
          parameters: {},
        },
        fixture: finished(2, 1),
      }).reasonCode,
    ).toBe('INVALID_MARKET_PARAMETERS');
    expect(
      evaluateMarket({
        market: {
          code: 'X',
          autoEvaluable: false,
          evaluatorKey: null,
          parameters: null,
        },
        fixture: finished(2, 1),
      }).reasonCode,
    ).toBe('MARKET_MANUAL_ONLY');
  });

  it.each([
    ['AND', 2, 1, 'GREEN'],
    ['AND', 1, 1, 'RED'],
    ['OR', 1, 1, 'GREEN'],
    ['OR', 1, 0, 'RED'],
  ])('evaluates composite %s markets', (operator, home, away, status) => {
    expect(
      evaluateMarket({
        market: {
          code: 'COMBO',
          autoEvaluable: true,
          evaluatorKey: 'COMPOSITE',
          parameters: {
            operator,
            conditions: [
              { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
              {
                evaluatorKey: 'TOTAL_GOALS',
                parameters: { direction: 'OVER', line: 2.5 },
              },
            ],
          },
        },
        fixture: finished(home, away),
      }).status,
    ).toBe(status);
  });

  it('reports composite child statuses from primitive evaluator results', () => {
    const result = evaluateMarket({
      market: {
        code: 'COMBO',
        autoEvaluable: true,
        evaluatorKey: 'COMPOSITE',
        parameters: {
          operator: 'AND',
          conditions: [
            { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
            {
              evaluatorKey: 'TOTAL_GOALS',
              parameters: { direction: 'OVER', line: 2.5 },
            },
          ],
        },
      },
      fixture: finished(2, 1),
    });
    expect(result.status).toBe('GREEN');
    expect(result.details).toEqual({ childStatuses: ['GREEN', 'GREEN'] });
  });

  it.each([
    [
      {
        evaluatorKey: 'COMPOSITE',
        parameters: { operator: 'AND', conditions: [] },
      },
    ],
    [
      {
        evaluatorKey: 'COMPOSITE',
        parameters: {
          operator: 'AND',
          conditions: [
            { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
            {
              evaluatorKey: 'COMPOSITE',
              parameters: { operator: 'OR', conditions: [] },
            },
          ],
        },
      },
    ],
  ])('rejects malformed composite configurations', (parameters) => {
    expect(
      evaluateMarket({
        market: {
          code: 'BAD_COMBO',
          autoEvaluable: true,
          evaluatorKey: 'COMPOSITE',
          parameters: parameters.parameters,
        },
        fixture: finished(2, 1),
      }).status,
    ).toBe('MANUAL');
  });

  it('does not evaluate from provider DTOs or labels', () => {
    const result = evaluateMarket({
      market: {
        code: 'RENAMED_MARKET',
        autoEvaluable: true,
        evaluatorKey: 'TOTAL_GOALS',
        parameters: { direction: 'OVER', line: 2.5 },
      },
      fixture: finished(2, 1),
    });

    expect(result.status).toBe('GREEN');
    expect(result.reasonCode).toBe('TOTAL_GOALS_MATCHED');
  });

  it('is deterministic for identical normalized inputs', () => {
    const input = {
      market: {
        code: 'OVER_2_5',
        autoEvaluable: true,
        evaluatorKey: 'TOTAL_GOALS',
        parameters: { direction: 'OVER', line: 2.5 },
      },
      fixture: finished(2, 1),
    };

    expect(evaluateMarket(input)).toEqual(evaluateMarket(input));
  });

  it('exposes supported evaluator versions through a registry', () => {
    expect(Object.keys(evaluatorRegistry).sort()).toEqual(
      [
        'BTTS',
        'COMPOSITE',
        'DOUBLE_CHANCE',
        'MATCH_RESULT',
        'TOTAL_CORNERS',
        'TOTAL_GOALS',
      ].sort(),
    );
    expect(evaluatorRegistry.TOTAL_GOALS.version).toBe(1);
  });

  it.each([
    [['GREEN', 'GREEN'], 'GREEN'],
    [['GREEN', 'VOID'], 'GREEN'],
    [['VOID', 'VOID'], 'VOID'],
    [['GREEN', 'PENDING'], 'PENDING'],
    [['GREEN', 'MANUAL'], 'MANUAL'],
    [['GREEN', 'RED'], 'RED'],
    [['PENDING', 'RED'], 'RED'],
    [['MANUAL', 'RED'], 'RED'],
  ])('aggregates bulletin statuses', (statuses, expected) => {
    expect(aggregateBulletinStatus(statuses as never[])).toBe(expected);
  });

  it('preserves manual status over recalculated status', () => {
    expect(resolveEffectiveStatus('GREEN', 'VOID')).toBe('VOID');
    expect(resolveEffectiveStatus('RED', null)).toBe('RED');
  });
});
