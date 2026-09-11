import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProviderValidationError } from '../../../shared/errors.js';
import type { HttpResponse, JsonHttpClient } from '../http-client.js';
import { GoalApiProvider } from './goal-api-provider.js';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      join('src/infrastructure/providers/goal-api/__fixtures__', name),
      'utf8',
    ),
  ) as unknown;
}

describe('GoalApiProvider', () => {
  it('normalizes paginated competitions', async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http: JsonHttpClient = {
      get<T>(
        path: string,
        query?: Record<string, string | number | null | undefined>,
      ) {
        calls.push({ path, query });
        return Promise.resolve({
          data: fixture(
            calls.length === 1 ? 'leagues-page-1.json' : 'leagues-page-2.json',
          ) as T,
          headers: new Headers(),
        } satisfies HttpResponse<T>);
      },
    };

    const competitions = await new GoalApiProvider(http).listCompetitions();

    expect(calls).toEqual([
      { path: 'leagues', query: { limit: 50, offset: 0 } },
      { path: 'leagues', query: { limit: 50, offset: 1 } },
    ]);
    expect(competitions).toEqual([
      expect.objectContaining({
        externalId: '152',
        name: 'Premier League',
        countryCode: 'GB',
      }),
      expect.objectContaining({
        externalId: '302',
        name: 'Liga Portugal',
        countryCode: 'PT',
      }),
    ]);
  });

  it('normalizes fixture scores and documented status codes', async () => {
    const http: JsonHttpClient = {
      get<T>() {
        return Promise.resolve({
          data: fixture('fixtures.json') as T,
          headers: new Headers(),
        } satisfies HttpResponse<T>);
      },
    };

    const fixtures = await new GoalApiProvider(http).listFixtures({
      date: '2026-09-11',
    });

    expect(fixtures[0]).toMatchObject({
      externalId: 'match_1',
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      halfTimeHomeScore: 1,
      halfTimeAwayScore: 0,
      homeCorners: null,
      awayCorners: null,
    });
  });

  it('rejects malformed provider responses', async () => {
    const http: JsonHttpClient = {
      get<T>() {
        return Promise.resolve({
          data: { success: true, data: [{ name: 'Missing id' }] } as T,
          headers: new Headers(),
        } satisfies HttpResponse<T>);
      },
    };

    await expect(
      new GoalApiProvider(http).listCompetitions(),
    ).rejects.toBeInstanceOf(ProviderValidationError);
  });
});
