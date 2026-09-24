import { z } from 'zod';
import type {
  ExternalCountryArtwork,
  ExternalTeamArtwork,
  TeamArtworkCompetition,
  TeamArtworkProvider,
} from '../../../application/providers/team-artwork-provider.js';
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  ProviderValidationError,
} from '../../../shared/errors.js';

type CompetitionMapping = {
  leagueId: number;
  regionName: string;
};

const competitionMappings = new Map<string, CompetitionMapping>([
  ['bundesliga|germany', { leagueId: 78, regionName: 'Germany' }],
  ['la liga|spain', { leagueId: 140, regionName: 'Spain' }],
  ['ligue 1|france', { leagueId: 61, regionName: 'France' }],
  ['premier league|england', { leagueId: 39, regionName: 'England' }],
  ['primeira liga|portugal', { leagueId: 94, regionName: 'Portugal' }],
  ['serie a|italy', { leagueId: 135, regionName: 'Italy' }],
  ['uefa champions league|europe', { leagueId: 2, regionName: 'Europe' }],
  ['uefa conference league|europe', { leagueId: 848, regionName: 'Europe' }],
  ['uefa europa league|europe', { leagueId: 3, regionName: 'Europe' }],
  ['uefa nations league|eurocups', { leagueId: 5, regionName: 'eurocups' }],
]);

const responseSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(
    z.object({
      team: z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1),
        country: z.string().nullable().optional(),
        logo: z.string().url().startsWith('https://'),
      }),
    }),
  ),
});

const countriesResponseSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(
    z.object({
      name: z.string().trim().min(1),
      code: z.string().trim().min(2).nullable().optional(),
      flag: z.string().url().startsWith('https://').nullable().optional(),
    }),
  ),
});

export type ApiFootballArtworkProviderOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  season: number;
  minRequestIntervalMs?: number;
  fetchFn?: typeof fetch;
};

export class ApiFootballArtworkProvider implements TeamArtworkProvider {
  readonly code = 'API_FOOTBALL';
  readonly displayName = 'API-Football';
  private readonly fetchFn: typeof fetch;
  private lastRequestStartedAt = 0;

  constructor(private readonly options: ApiFootballArtworkProviderOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  supportsCompetition(competition: TeamArtworkCompetition): boolean {
    return competitionMappings.has(mappingKey(competition));
  }

  async listCountryArtwork(): Promise<ExternalCountryArtwork[]> {
    await this.waitForRequestSlot();
    const url = new URL('countries', ensureTrailingSlash(this.options.baseUrl));
    const data = await this.requestJson(url);
    const parsed = countriesResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderValidationError(
        'API-Football returned an invalid countries response',
      );
    }
    if (hasErrors(parsed.data.errors)) {
      throw new ProviderValidationError(
        `API-Football rejected the request: ${errorSummary(parsed.data.errors)}`,
      );
    }

    return parsed.data.response
      .filter(
        (
          country,
        ): country is {
          name: string;
          code: string;
          flag: string;
        } => Boolean(country.code && country.flag),
      )
      .map((country) => ({
        code: country.code.toUpperCase(),
        name: country.name,
        flagUrl: country.flag,
      }));
  }

  async listTeamArtwork(
    competition: TeamArtworkCompetition,
  ): Promise<ExternalTeamArtwork[]> {
    const mapping = competitionMappings.get(mappingKey(competition));
    if (!mapping) return [];

    return this.requestTeams({
      league: String(mapping.leagueId),
      season: String(this.options.season),
    });
  }

  async searchTeamArtwork(name: string): Promise<ExternalTeamArtwork[]> {
    const search = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (search.length < 3) return [];
    return this.requestTeams({ search });
  }

  private async requestTeams(
    query: Record<string, string>,
  ): Promise<ExternalTeamArtwork[]> {
    await this.waitForRequestSlot();
    const url = new URL('teams', ensureTrailingSlash(this.options.baseUrl));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const parsed = responseSchema.safeParse(await this.requestJson(url));
    if (!parsed.success) {
      throw new ProviderValidationError(
        'API-Football returned an invalid teams response',
      );
    }
    if (hasErrors(parsed.data.errors)) {
      throw new ProviderValidationError(
        `API-Football rejected the request: ${errorSummary(parsed.data.errors)}`,
      );
    }

    return parsed.data.response.map(({ team }) => ({
      externalId: String(team.id),
      name: team.name,
      country: team.country ?? null,
      logoUrl: team.logo,
    }));
  }

  private async requestJson(url: URL): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );

    try {
      const response = await this.fetchFn(url, {
        headers: { 'x-apisports-key': this.options.apiKey },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new ProviderAuthenticationError(
          'API-Football authentication failed',
        );
      }
      if (response.status === 429) {
        throw new ProviderRateLimitError('API-Football rate limit exceeded');
      }
      if (!response.ok) {
        throw new ProviderValidationError(
          `API-Football request failed with status ${response.status}`,
        );
      }

      return response.json();
    } catch (error) {
      if (
        error instanceof ProviderAuthenticationError ||
        error instanceof ProviderRateLimitError ||
        error instanceof ProviderValidationError
      ) {
        throw error;
      }
      throw new ProviderUnavailableError('API-Football request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForRequestSlot(): Promise<void> {
    const interval = this.options.minRequestIntervalMs ?? 0;
    const waitMs = Math.max(
      0,
      this.lastRequestStartedAt + interval - Date.now(),
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestStartedAt = Date.now();
  }
}

function mappingKey(competition: TeamArtworkCompetition): string {
  return `${competition.name.trim().toLowerCase()}|${(competition.regionName ?? '').trim().toLowerCase()}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function hasErrors(errors: unknown[] | Record<string, unknown>): boolean {
  return Array.isArray(errors)
    ? errors.length > 0
    : Object.keys(errors).length > 0;
}

function errorSummary(errors: unknown[] | Record<string, unknown>): string {
  const values = Array.isArray(errors) ? errors : Object.values(errors);
  return values
    .filter((value): value is string => typeof value === 'string')
    .join('; ')
    .slice(0, 300);
}
