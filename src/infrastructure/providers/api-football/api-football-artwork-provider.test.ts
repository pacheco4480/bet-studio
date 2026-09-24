// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ProviderAuthenticationError } from '../../../shared/errors.js';
import { ApiFootballArtworkProvider } from './api-football-artwork-provider.js';

function provider(fetchFn: typeof fetch) {
  return new ApiFootballArtworkProvider({
    apiKey: 'test-key',
    baseUrl: 'https://v3.football.api-sports.io',
    timeoutMs: 5000,
    season: 2026,
    fetchFn,
  });
}

describe('ApiFootballArtworkProvider', () => {
  it('loads normalized logos for a supported competition', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [],
          response: [
            {
              team: {
                id: 40,
                name: 'Liverpool',
                country: 'England',
                logo: 'https://media.api-sports.io/football/teams/40.png',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await provider(fetchFn).listTeamArtwork({
      name: 'Premier League',
      regionName: 'England',
    });

    expect(result).toEqual([
      {
        externalId: '40',
        name: 'Liverpool',
        country: 'England',
        logoUrl: 'https://media.api-sports.io/football/teams/40.png',
      },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.objectContaining({
        search: '?league=39&season=2026',
      }),
      expect.objectContaining({
        headers: { 'x-apisports-key': 'test-key' },
      }),
    );
  });

  it('does not request unsupported competitions', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const result = await provider(fetchFn).listTeamArtwork({
      name: 'Local Cup',
      regionName: 'Portugal',
    });

    expect(result).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('loads country flags for competition artwork', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [],
          response: [
            {
              name: 'World',
              code: null,
              flag: null,
            },
            {
              name: 'England',
              code: 'GB-ENG',
              flag: 'https://media.api-sports.io/flags/gb-eng.svg',
            },
            {
              name: 'Incomplete',
              code: 'ZZ',
              flag: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(provider(fetchFn).listCountryArtwork()).resolves.toEqual([
      {
        name: 'England',
        code: 'GB-ENG',
        flagUrl: 'https://media.api-sports.io/flags/gb-eng.svg',
      },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/countries' }),
      expect.anything(),
    );
  });

  it('searches current teams without a season filter', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ errors: [], response: [] }), {
        status: 200,
      }),
    );

    await provider(fetchFn).searchTeamArtwork('Academico Viseu');

    expect(fetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ search: '?search=Academico+Viseu' }),
      expect.anything(),
    );
  });

  it('sanitizes punctuation and accents in provider searches', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ errors: [], response: [] }), {
        status: 200,
      }),
    );

    await provider(fetchFn).searchTeamArtwork("Vitória d'Ávila-FC");

    expect(fetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ search: '?search=Vitoria+d+Avila+FC' }),
      expect.anything(),
    );
  });

  it('skips searches shorter than the provider minimum', async () => {
    const fetchFn = vi.fn<typeof fetch>();

    expect(await provider(fetchFn).searchTeamArtwork('KI')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('normalizes authentication failures', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      provider(fetchFn).listTeamArtwork({
        name: 'Premier League',
        regionName: 'England',
      }),
    ).rejects.toBeInstanceOf(ProviderAuthenticationError);
  });
});
