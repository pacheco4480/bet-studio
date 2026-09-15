import { describe, expect, it } from 'vitest';
import {
  AnalyticsService,
  type AnalyticsRepository,
} from './analytics-service.js';

describe('AnalyticsService', () => {
  it('summarizes local bulletin and selection performance', () => {
    const repository: AnalyticsRepository = {
      listBulletins: () => [
        {
          id: 'bulletin-1',
          type: 'SINGLE',
          mode: 'PRE_MATCH',
          status: 'GREEN',
          stake: '10.00',
          totalOdd: '2.50',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'bulletin-2',
          type: 'MULTI',
          mode: 'LIVE',
          status: 'RED',
          stake: '5.00',
          totalOdd: '3.00',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'bulletin-3',
          type: 'SINGLE',
          mode: 'PRE_MATCH',
          status: 'PENDING',
          stake: '20.00',
          totalOdd: '1.80',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
      ],
      listSelections: () => [
        {
          bulletinId: 'bulletin-1',
          effectiveStatus: 'GREEN',
          odd: '2.50',
          marketName: 'Over 2.5',
          marketCategory: 'Goals',
          competitionName: 'Premier League',
        },
        {
          bulletinId: 'bulletin-2',
          effectiveStatus: 'RED',
          odd: '1.50',
          marketName: 'Over 2.5',
          marketCategory: 'Goals',
          competitionName: 'Premier League',
        },
        {
          bulletinId: 'bulletin-2',
          effectiveStatus: 'PENDING',
          odd: '2.00',
          marketName: 'Home win',
          marketCategory: 'Result',
          competitionName: null,
        },
      ],
    };

    const summary = new AnalyticsService(repository).getSummary();

    expect(summary.totals).toMatchObject({
      bulletins: 3,
      selections: 3,
      greenBulletins: 1,
      redBulletins: 1,
      pendingBulletins: 1,
    });
    expect(summary.performance).toMatchObject({
      bulletinWinRate: '50.0%',
      selectionWinRate: '50.0%',
      totalStake: '15.00',
      realizedReturn: '25.00',
      realizedProfit: '10.00',
      averageOdd: '2.00',
    });
    expect(summary.byMarket[0]).toMatchObject({
      label: 'Over 2.5',
      total: 2,
      green: 1,
      red: 1,
      winRate: '50.0%',
    });
  });
});
