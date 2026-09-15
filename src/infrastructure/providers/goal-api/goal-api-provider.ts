import { z, ZodError } from 'zod';
import type {
  ExternalCompetition,
  ExternalFixture,
  ExternalTeam,
  CompetitionsQuery,
  FixturesQuery,
  FootballDataProvider,
  ProviderCapabilities,
  TeamsQuery,
} from '../../../application/providers/football-provider.js';
import type { FixtureStatus } from '../../../domain/core/types.js';
import { ProviderValidationError } from '../../../shared/errors.js';
import type { JsonHttpClient } from '../http-client.js';

const paginationSchema = z
  .object({
    limit: z.number().optional(),
    offset: z.number().optional(),
    hasMore: z.boolean().optional(),
  })
  .optional();

const responseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  pagination: paginationSchema,
});

const countrySchema = z.union([
  z.string(),
  z
    .object({
      name: z.string().nullable().optional(),
      code: z.string().nullable().optional(),
    })
    .passthrough(),
]);

const leagueSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    apiId: z.union([z.string(), z.number()]).optional(),
    name: z.string(),
    shortName: z.string().nullable().optional(),
    country: countrySchema.nullable().optional(),
    countryCode: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
  })
  .passthrough();

const teamSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    apiId: z.union([z.string(), z.number()]).optional(),
    name: z.string(),
    shortName: z.string().nullable().optional(),
    country: countrySchema.nullable().optional(),
    countryCode: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    badge: z.string().nullable().optional(),
  })
  .passthrough();

const standingTeamSchema = z
  .object({
    teamId: z.union([z.string(), z.number()]).optional(),
    teamName: z.string().optional(),
    team: teamSchema.optional(),
  })
  .passthrough();

const scoreSchema = z
  .object({
    home: z.union([z.string(), z.number()]).nullable().optional(),
    away: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

const fixtureSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    apiId: z.union([z.string(), z.number()]).optional(),
    leagueId: z.union([z.string(), z.number()]).nullable().optional(),
    competitionId: z.union([z.string(), z.number()]).nullable().optional(),
    homeTeamId: z.union([z.string(), z.number()]).nullable().optional(),
    awayTeamId: z.union([z.string(), z.number()]).nullable().optional(),
    homeTeam: z.union([z.string(), teamSchema]).nullable().optional(),
    awayTeam: z.union([z.string(), teamSchema]).nullable().optional(),
    kickoffUtc: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    matchStatus: z.string().nullable().optional(),
    score: scoreSchema.nullable().optional(),
    homeScore: z.union([z.string(), z.number()]).nullable().optional(),
    awayScore: z.union([z.string(), z.number()]).nullable().optional(),
    halfTimeHomeScore: z.union([z.string(), z.number()]).nullable().optional(),
    halfTimeAwayScore: z.union([z.string(), z.number()]).nullable().optional(),
    homeTeamScore: z.union([z.string(), z.number()]).nullable().optional(),
    awayTeamScore: z.union([z.string(), z.number()]).nullable().optional(),
    homeTeamHalftimeScore: z
      .union([z.string(), z.number()])
      .nullable()
      .optional(),
    awayTeamHalftimeScore: z
      .union([z.string(), z.number()])
      .nullable()
      .optional(),
    homeTeamFtScore: z.union([z.string(), z.number()]).nullable().optional(),
    awayTeamFtScore: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

export const goalApiCapabilities: ProviderCapabilities = {
  competitions: true,
  teams: true,
  fixtures: true,
  liveScores: true,
  finalScores: true,
  fixtureStatistics: true,
  corners: false,
  teamLogos: false,
  competitionLogos: false,
};

export class GoalApiProvider implements FootballDataProvider {
  readonly code = 'GOAL_API';
  readonly displayName = 'GOAL API';
  readonly capabilities = goalApiCapabilities;

  constructor(private readonly http: JsonHttpClient) {}

  async listCompetitions(
    query: CompetitionsQuery = {},
  ): Promise<ExternalCompetition[]> {
    return this.readPages('leagues', {}, query.maxPages ?? 100, (item) =>
      this.normalizeCompetition(leagueSchema.parse(item)),
    );
  }

  async listTeams(query: TeamsQuery): Promise<ExternalTeam[]> {
    return this.readPages(
      `standings/${encodeURIComponent(query.competitionExternalId)}`,
      {},
      100,
      (item) =>
        this.normalizeStandingTeam(
          standingTeamSchema.parse(item),
          query.competitionExternalId,
        ),
    );
  }

  async listFixtures(query: FixturesQuery): Promise<ExternalFixture[]> {
    if (query.date) {
      return this.readPages(
        `fixtures/date/${encodeURIComponent(query.date)}`,
        {},
        100,
        (item) => this.normalizeFixture(fixtureSchema.parse(item)),
      );
    }
    if (query.competitionExternalId) {
      return this.readPages(
        `leagues/${encodeURIComponent(query.competitionExternalId)}/fixtures`,
        {},
        100,
        (item) => this.normalizeFixture(fixtureSchema.parse(item)),
      );
    }
    return this.readPages(
      'fixtures',
      { from: query.from, to: query.to },
      100,
      (item) => this.normalizeFixture(fixtureSchema.parse(item)),
    );
  }

  async getFixture(externalFixtureId: string): Promise<ExternalFixture | null> {
    const body = await this.readResponse(
      `fixtures/${encodeURIComponent(externalFixtureId)}`,
    );
    if (body.data === null) return null;
    const fixture = fixtureSchema.parse(body.data);
    return this.normalizeFixture(fixture);
  }

  private async readPages<T>(
    path: string,
    query: Record<string, string | number | null | undefined>,
    maxPages: number,
    mapItem: (item: unknown) => T,
  ): Promise<T[]> {
    const items: T[] = [];
    let offset = 0;
    const limit = 50;

    for (let page = 0; page < maxPages; page += 1) {
      const body = await this.readResponse(path, { ...query, limit, offset });
      const pageItems = z.array(z.unknown()).parse(body.data);
      items.push(...pageItems.map(mapItem));
      if (!body.pagination?.hasMore || pageItems.length === 0) return items;
      offset += body.pagination.limit ?? limit;
    }

    if (items.length > 0) return items;
    throw new ProviderValidationError(
      'GOAL API returned no synchronized records',
    );
  }

  private async readResponse(
    path: string,
    query: Record<string, string | number | null | undefined> = {},
  ) {
    try {
      const response = await this.http.get<unknown>(path, query);
      const body = responseSchema.parse(response.data);
      if (!body.success)
        throw new ProviderValidationError(
          'GOAL API returned an unsuccessful response',
        );
      return body;
    } catch (error) {
      if (error instanceof ZodError)
        throw new ProviderValidationError('GOAL API response shape is invalid');
      throw error;
    }
  }

  private normalizeCompetition(
    league: z.infer<typeof leagueSchema>,
  ): ExternalCompetition {
    return {
      providerCode: this.code,
      externalId: externalId(league),
      name: league.name,
      shortName: league.shortName ?? null,
      countryCode: league.countryCode ?? countryCode(league.country) ?? null,
      regionName: league.region ?? countryName(league.country) ?? null,
      logoUrl: safeHttpsUrl(league.logoUrl ?? league.logo ?? null),
    };
  }

  private normalizeTeam(
    team: z.infer<typeof teamSchema>,
    competitionExternalId: string | null,
  ): ExternalTeam {
    return {
      providerCode: this.code,
      externalId: externalId(team),
      competitionExternalId,
      name: team.name,
      shortName: team.shortName ?? null,
      countryCode: team.countryCode ?? countryCode(team.country) ?? null,
      logoUrl: safeHttpsUrl(team.logoUrl ?? team.logo ?? team.badge ?? null),
    };
  }

  private normalizeStandingTeam(
    standing: z.infer<typeof standingTeamSchema>,
    competitionExternalId: string,
  ): ExternalTeam {
    if (standing.team)
      return this.normalizeTeam(standing.team, competitionExternalId);

    const teamId = nullableId(standing.teamId);
    if (!teamId)
      throw new ProviderValidationError('GOAL API record is missing an id');

    return {
      providerCode: this.code,
      externalId: teamId,
      competitionExternalId,
      name: standing.teamName ?? '',
      shortName: null,
      countryCode: null,
      logoUrl: null,
    };
  }

  private normalizeFixture(
    fixture: z.infer<typeof fixtureSchema>,
  ): ExternalFixture {
    const homeTeam =
      typeof fixture.homeTeam === 'object' && fixture.homeTeam !== null
        ? fixture.homeTeam
        : null;
    const awayTeam =
      typeof fixture.awayTeam === 'object' && fixture.awayTeam !== null
        ? fixture.awayTeam
        : null;

    return {
      providerCode: this.code,
      externalId: externalId(fixture),
      competitionExternalId: nullableId(
        fixture.leagueId ?? fixture.competitionId,
      ),
      homeTeamExternalId: nullableId(
        fixture.homeTeamId ?? homeTeam?.id ?? homeTeam?.apiId,
      ),
      awayTeamExternalId: nullableId(
        fixture.awayTeamId ?? awayTeam?.id ?? awayTeam?.apiId,
      ),
      homeTeamName:
        typeof fixture.homeTeam === 'string'
          ? fixture.homeTeam
          : (homeTeam?.name ?? ''),
      awayTeamName:
        typeof fixture.awayTeam === 'string'
          ? fixture.awayTeam
          : (awayTeam?.name ?? ''),
      kickoffAt: fixture.kickoffUtc ?? null,
      status: normalizeStatus(fixture.status ?? fixture.matchStatus ?? null),
      homeScore: nullableInteger(
        fixture.homeScore ?? fixture.score?.home ?? fixture.homeTeamFtScore,
      ),
      awayScore: nullableInteger(
        fixture.awayScore ?? fixture.score?.away ?? fixture.awayTeamFtScore,
      ),
      halfTimeHomeScore: nullableInteger(
        fixture.halfTimeHomeScore ?? fixture.homeTeamHalftimeScore,
      ),
      halfTimeAwayScore: nullableInteger(
        fixture.halfTimeAwayScore ?? fixture.awayTeamHalftimeScore,
      ),
      homeCorners: null,
      awayCorners: null,
    };
  }
}

function externalId(value: {
  id?: string | number;
  apiId?: string | number;
}): string {
  const id = value.id ?? value.apiId;
  if (id === undefined || id === null || id === '')
    throw new ProviderValidationError('GOAL API record is missing an id');
  return String(id);
}

function nullableId(value: string | number | null | undefined): string | null {
  return value === null || value === undefined || value === ''
    ? null
    : String(value);
}

function nullableInteger(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeStatus(value: string | null): FixtureStatus {
  switch (value) {
    case 'NS':
    case 'TBD':
    case 'SCHEDULED':
      return 'SCHEDULED';
    case '1H':
    case '2H':
    case 'HT':
    case 'LIVE':
      return 'LIVE';
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'FINISHED':
      return 'FINISHED';
    case 'PST':
    case 'POSTPONED':
      return 'POSTPONED';
    case 'CANC':
    case 'CANCELLED':
      return 'CANCELLED';
    case 'ABD':
    case 'ABANDONED':
      return 'ABANDONED';
    default:
      return 'UNKNOWN';
  }
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function countryCode(
  value: z.infer<typeof countrySchema> | null | undefined,
): string | null {
  return typeof value === 'object' && value !== null
    ? (value.code ?? null)
    : null;
}

function countryName(
  value: z.infer<typeof countrySchema> | null | undefined,
): string | null {
  if (typeof value === 'string') return value;
  return typeof value === 'object' && value !== null
    ? (value.name ?? null)
    : null;
}
