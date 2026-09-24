import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('shows team logos, provider origin and initials fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.startsWith('/api/teams')) {
        return Promise.resolve(
          response({
            items: [
              {
                id: 'team_1',
                name: 'Arsenal FC',
                shortName: 'Arsenal',
                countryCode: 'GB',
                logoAssetId: 'asset_1',
                logo: {
                  assetId: 'asset_1',
                  source: 'PROVIDER',
                  providerCode: 'API_FOOTBALL',
                  url: '/api/assets/asset_1',
                },
                active: true,
                aliases: [],
                competitions: [],
              },
              {
                id: 'team_2',
                name: 'Local Club',
                shortName: null,
                countryCode: null,
                logoAssetId: null,
                logo: null,
                active: true,
                aliases: [],
                competitions: [],
              },
            ],
          }),
        );
      }
      if (url.startsWith('/api/competitions')) {
        return Promise.resolve(
          response({
            items: [
              {
                id: 'competition_1',
                name: 'UEFA Champions League',
                shortName: 'UCL',
                countryCode: null,
                regionName: 'Europe',
                logoAssetId: 'asset_competition_1',
                logo: {
                  assetId: 'asset_competition_1',
                  source: 'PROVIDER',
                  providerCode: 'API_FOOTBALL',
                  url: '/api/assets/asset_competition_1',
                },
                active: true,
              },
            ],
          }),
        );
      }
      return Promise.resolve(response({ items: [] }));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Teams' }));

    expect(await screen.findByAltText('Arsenal FC logo')).toHaveAttribute(
      'src',
      '/api/assets/asset_1',
    );
    expect(screen.getByText('API-Football')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Local Club initials fallback'),
    ).toHaveTextContent('LC');
    expect(screen.getByText('Initials')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Replace Arsenal FC logo'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Add Local Club logo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove logo' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Competitions' }));
    expect(
      await screen.findByAltText('UEFA Champions League logo'),
    ).toHaveAttribute('src', '/api/assets/asset_competition_1');
  });

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
