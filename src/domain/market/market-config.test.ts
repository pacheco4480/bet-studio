import { describe, expect, it } from 'vitest';
import { validateMarketConfiguration } from './market-config.js';

describe('validateMarketConfiguration', () => {
  it('normalizes manual markets to a manual configuration', () => {
    expect(
      validateMarketConfiguration({
        autoEvaluable: false,
        evaluatorKey: 'TOTAL_GOALS',
        parameters: { direction: 'OVER', line: 2.5 },
      }),
    ).toEqual({ evaluatorKey: null, parameters: null });
  });

  it.each([
    ['MATCH_RESULT', { result: 'HOME' }],
    ['TOTAL_GOALS', { direction: 'OVER', line: 2.5 }],
    ['DOUBLE_CHANCE', { outcome: '1X' }],
    ['BTTS', { selection: 'YES' }],
    ['TOTAL_CORNERS', { direction: 'UNDER', line: 9.5 }],
  ])('accepts %s primitive market parameters', (evaluatorKey, parameters) => {
    expect(
      validateMarketConfiguration({
        autoEvaluable: true,
        evaluatorKey,
        parameters,
      }),
    ).toEqual({
      evaluatorKey,
      parameters,
    });
  });

  it('accepts a composite market with two to four primitive conditions', () => {
    const parameters = {
      operator: 'AND',
      conditions: [
        { evaluatorKey: 'MATCH_RESULT', parameters: { result: 'HOME' } },
        { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
      ],
    };

    expect(
      validateMarketConfiguration({
        autoEvaluable: true,
        evaluatorKey: 'COMPOSITE',
        parameters,
      }),
    ).toEqual({
      evaluatorKey: 'COMPOSITE',
      parameters,
    });
  });

  it.each([
    [
      'unsupported goal lines',
      'TOTAL_GOALS',
      { direction: 'OVER', line: 2.25 },
    ],
    [
      'nested composite conditions',
      'COMPOSITE',
      {
        operator: 'AND',
        conditions: [
          {
            evaluatorKey: 'COMPOSITE',
            parameters: { operator: 'AND', conditions: [] },
          },
          { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
        ],
      },
    ],
    [
      'single composite condition',
      'COMPOSITE',
      {
        operator: 'AND',
        conditions: [
          { evaluatorKey: 'BTTS', parameters: { selection: 'YES' } },
        ],
      },
    ],
  ])('rejects %s', (_case, evaluatorKey, parameters) => {
    expect(() =>
      validateMarketConfiguration({
        autoEvaluable: true,
        evaluatorKey,
        parameters,
      }),
    ).toThrow();
  });
});
