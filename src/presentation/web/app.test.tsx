import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the bulletin builder shell and loads local picker data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.startsWith('/api/builder/fixtures')) {
        return Promise.resolve(
          response({
            items: [
              {
                fixture: {
                  id: 'fixture_1',
                  kickoffAt: '2026-09-11T20:00:00.000Z',
                  status: 'SCHEDULED',
                  homeScore: null,
                  awayScore: null,
                  liveMinute: null,
                },
                homeTeam: { id: 'team_1', name: 'Home FC' },
                awayTeam: { id: 'team_2', name: 'Away FC' },
                competition: { id: 'competition_1', name: 'Liga Portugal' },
              },
            ],
          }),
        );
      }
      if (url.startsWith('/api/builder/markets')) {
        return Promise.resolve(
          response({
            items: [
              {
                id: 'market_1',
                code: 'OVER_2_5',
                name: 'Over 2.5 Goals',
                category: 'Total Goals',
                active: true,
                autoEvaluable: true,
                evaluatorKey: 'TOTAL_GOALS',
                parameters: { direction: 'OVER', line: 2.5 },
              },
            ],
          }),
        );
      }
      if (url.startsWith('/api/analytics/summary')) {
        return Promise.resolve(
          response({
            totals: {
              bulletins: 2,
              selections: 3,
              settledBulletins: 1,
              pendingBulletins: 1,
              greenBulletins: 1,
              redBulletins: 0,
              voidBulletins: 0,
              manualBulletins: 0,
            },
            performance: {
              bulletinWinRate: '100.0%',
              selectionWinRate: '50.0%',
              totalStake: '10.00',
              realizedReturn: '20.00',
              realizedProfit: '10.00',
              averageOdd: '1.80',
            },
            byStatus: [
              { status: 'PENDING', count: 1 },
              { status: 'GREEN', count: 1 },
            ],
            byType: [{ type: 'SINGLE', count: 2 }],
            byMode: [{ mode: 'PRE_MATCH', count: 2 }],
            byMarket: [
              {
                label: 'Over 2.5 Goals',
                total: 2,
                green: 1,
                red: 1,
                pending: 0,
                manual: 0,
                void: 0,
                winRate: '50.0%',
              },
            ],
            byCompetition: [],
          }),
        );
      }
      return Promise.resolve(response({ items: [] }));
    });

    render(<App />);

    expect(screen.getByText('Bet Studio')).toBeInTheDocument();
    expect(screen.getByText('Catalog Management')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bulletins' }));
    expect(await screen.findByText(/Home FC vs Away FC/)).toBeInTheDocument();
    expect(screen.getByText(/Over 2.5 Goals/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
    expect(await screen.findByText('Realized profit')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}
