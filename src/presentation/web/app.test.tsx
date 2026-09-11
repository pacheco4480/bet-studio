import { render, screen } from '@testing-library/react';
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
      return Promise.resolve(response({ items: [] }));
    });

    render(<App />);

    expect(screen.getByText('Bet Studio')).toBeInTheDocument();
    expect(screen.getByText('Catalog Management')).toBeInTheDocument();
    expect(await screen.findByText(/Home FC vs Away FC/)).toBeInTheDocument();
    expect(screen.getByText(/Over 2.5 Goals/)).toBeInTheDocument();
  });
});

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}
