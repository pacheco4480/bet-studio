import type {
  ExternalCompetition,
  ExternalFixture,
  ExternalTeam,
  FootballDataProvider,
  FixturesQuery,
  ProviderStatus,
} from '../providers/football-provider.js';
import type {
  Competition,
  Fixture,
  FixtureResultDetails,
  ProviderReference,
  Team,
} from '../../domain/core/types.js';
import type {
  CompetitionId,
  FixtureId,
  ProviderId,
  TeamId,
} from '../../domain/shared/ids.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc, toUtcDateString } from '../../domain/shared/time.js';
import {
  NotFoundError,
  ProviderError,
  ValidationError,
} from '../../shared/errors.js';
import type {
  SyncRepository,
  SyncResource,
  SyncResult,
} from './synchronization-types.js';

type SyncCounters = Omit<
  SyncResult,
  'providerCode' | 'resourceType' | 'scopeKey' | 'completedAt'
>;

export const defaultCompetitionImportNames = [
  'Bundesliga',
  'LaLiga',
  'Ligue 1',
  'Premier League',
  'Serie A',
  'Liga Portugal Betclic',
  'UEFA Champions League',
  'UEFA Europa League',
  'UEFA Conference League',
  'UEFA Nations League',
] as const;

const defaultCompetitionTargets = [
  { name: 'Bundesliga', regions: ['Germany'] },
  { name: 'La Liga', regions: ['Spain'] },
  { name: 'Ligue 1', regions: ['France'] },
  { name: 'Premier League', regions: ['England'] },
  { name: 'Serie A', regions: ['Italy'] },
  { name: 'Primeira Liga', regions: ['Portugal'] },
  { name: 'UEFA Champions League', regions: ['Europe'] },
  { name: 'UEFA Europa League', regions: ['Europe'] },
  { name: 'UEFA Conference League', regions: ['Europe'] },
  { name: 'UEFA Nations League', regions: ['Europe', 'eurocups'] },
];

export class SynchronizationService {
  constructor(
    private readonly repository: SyncRepository,
    private readonly provider: FootballDataProvider | null,
  ) {}

  getProviderStatuses(): ProviderStatus[] {
    if (!this.provider) return [];
    const provider = this.ensureProvider();
    return [
      {
        code: this.provider.code,
        displayName: this.provider.displayName,
        configured: provider.enabled,
        capabilities: this.provider.capabilities,
        lastSuccessfulSyncAt: this.repository.lastSuccessfulSyncAt(provider.id),
      },
    ];
  }

  async syncCompetitions(
    options: { maxPages?: number; names?: string[] } = {},
  ): Promise<SyncResult> {
    return this.runSync('COMPETITIONS', null, async (providerRecord) => {
      const external = await this.requireProvider().listCompetitions(options);
      return this.syncExternalCompetitions(
        providerRecord.id,
        filterCompetitionsByName(external, options.names),
      );
    });
  }

  async syncTeams(competitionId: string): Promise<SyncResult> {
    const localCompetition = this.repository.findCompetition(
      competitionId as CompetitionId,
    );
    if (!localCompetition) throw new NotFoundError('Competition not found');

    return this.runSync(
      'TEAMS',
      `competition:${competitionId}`,
      async (providerRecord) => {
        const competitionReference =
          this.repository.findProviderReferenceByLocal(
            providerRecord.id,
            'COMPETITION',
            competitionId,
          );
        if (!competitionReference)
          throw new ValidationError('Competition has no GOAL API mapping');

        const external = await this.requireProvider().listTeams({
          competitionExternalId: competitionReference.externalId,
        });
        return this.syncExternalTeams(
          providerRecord.id,
          localCompetition.id,
          external,
        );
      },
    );
  }

  async syncAllTeams(): Promise<SyncResult> {
    const competitions = this.repository.listActiveCompetitions();
    const results = await Promise.all(
      competitions.map((competition) => this.syncTeams(competition.id)),
    );
    return combineSyncResults(results, 'all-active-competitions');
  }

  async syncFixtures(query: FixturesQuery): Promise<SyncResult> {
    const scopeKey = query.date
      ? `date:${query.date}`
      : query.competitionExternalId
        ? `competition:${query.competitionExternalId}`
        : null;

    return this.runSync('FIXTURES', scopeKey, async (providerRecord) => {
      const external = await this.requireProvider().listFixtures(query);
      return this.syncExternalFixtures(providerRecord.id, external);
    });
  }

  async syncFixtureResult(fixtureId: string): Promise<SyncResult> {
    const providerRecord = this.ensureProvider();
    const fixtureReference = this.repository.findProviderReferenceByLocal(
      providerRecord.id,
      'FIXTURE',
      fixtureId,
    );
    if (!fixtureReference)
      throw new ValidationError('Fixture has no GOAL API mapping');

    return this.runSync('RESULTS', `fixture:${fixtureId}`, async (record) => {
      const external = await this.requireProvider().getFixture(
        fixtureReference.externalId,
      );
      if (!external)
        return {
          status: 'FAILED',
          processed: 0,
          created: 0,
          updated: 0,
          unresolved: 0,
          failed: 1,
          message: 'Provider fixture not found',
        };
      return this.syncExternalFixtures(record.id, [external]);
    });
  }

  private syncExternalCompetitions(
    providerId: ProviderId,
    external: ExternalCompetition[],
  ): SyncCounters {
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const item of external) {
      try {
        const reference = this.repository.findProviderReference(
          providerId,
          'COMPETITION',
          item.externalId,
        );
        const matchedCompetition = reference
          ? null
          : this.repository.findCompetitionByNameAndRegion(
              item.name,
              item.regionName,
            );
        const now = nowUtc();
        const competition: Competition = reference
          ? {
              ...this.requireCompetition(reference.localEntityId),
              name: item.name,
              shortName: item.shortName,
              countryCode: item.countryCode,
              regionName: item.regionName,
              updatedAt: now,
            }
          : matchedCompetition
            ? {
                ...matchedCompetition,
                shortName: matchedCompetition.shortName ?? item.shortName,
                countryCode: matchedCompetition.countryCode ?? item.countryCode,
                updatedAt: now,
              }
            : {
                id: createId<'CompetitionId'>(),
                name: item.name,
                shortName: item.shortName,
                countryCode: item.countryCode,
                regionName: item.regionName,
                logoAssetId: null,
                active: true,
                archivedAt: null,
                createdAt: now,
                updatedAt: now,
              };
        this.repository.saveCompetition(competition);
        this.saveReference(
          providerId,
          'COMPETITION',
          competition.id,
          item.externalId,
        );
        if (reference || matchedCompetition) updated += 1;
        else created += 1;
      } catch {
        failed += 1;
      }
    }

    return this.successCounters(external.length, created, updated, 0, failed);
  }

  private syncExternalTeams(
    providerId: ProviderId,
    competitionId: CompetitionId,
    external: ExternalTeam[],
  ): SyncCounters {
    let created = 0;
    let updated = 0;
    let unresolved = 0;
    let failed = 0;

    for (const item of external) {
      try {
        const reference = this.repository.findProviderReference(
          providerId,
          'TEAM',
          item.externalId,
        );
        const aliasMatches = reference
          ? []
          : this.repository.findTeamByNormalizedAlias(item.name);
        if (!reference && aliasMatches.length > 1) {
          unresolved += 1;
          continue;
        }
        const now = nowUtc();
        const existing = reference
          ? this.repository.findTeam(reference.localEntityId as TeamId)
          : (aliasMatches[0] ?? null);
        const team: Team = existing
          ? {
              ...existing,
              name: existing.name,
              shortName: existing.shortName ?? item.shortName,
              countryCode: existing.countryCode ?? item.countryCode,
              updatedAt: now,
            }
          : {
              id: createId<'TeamId'>(),
              name: item.name,
              shortName: item.shortName,
              countryCode: item.countryCode,
              logoAssetId: null,
              active: true,
              archivedAt: null,
              createdAt: now,
              updatedAt: now,
            };
        this.repository.saveTeam(team);
        this.repository.assignTeamToCompetition(team.id, competitionId);
        this.saveReference(providerId, 'TEAM', team.id, item.externalId);
        if (existing) updated += 1;
        else created += 1;
      } catch {
        failed += 1;
      }
    }

    return this.successCounters(
      external.length,
      created,
      updated,
      unresolved,
      failed,
    );
  }

  private syncExternalFixtures(
    providerId: ProviderId,
    external: ExternalFixture[],
  ): SyncCounters {
    let created = 0;
    let updated = 0;
    let unresolved = 0;
    let failed = 0;

    for (const item of external) {
      try {
        const competitionId = item.competitionExternalId
          ? (this.repository.findProviderReference(
              providerId,
              'COMPETITION',
              item.competitionExternalId,
            )?.localEntityId ?? null)
          : null;
        const homeTeamId = item.homeTeamExternalId
          ? this.repository.findProviderReference(
              providerId,
              'TEAM',
              item.homeTeamExternalId,
            )?.localEntityId
          : null;
        const awayTeamId = item.awayTeamExternalId
          ? this.repository.findProviderReference(
              providerId,
              'TEAM',
              item.awayTeamExternalId,
            )?.localEntityId
          : null;

        if (!homeTeamId || !awayTeamId) {
          unresolved += 1;
          continue;
        }

        const reference = this.repository.findProviderReference(
          providerId,
          'FIXTURE',
          item.externalId,
        );
        const matched =
          reference?.localEntityId ??
          this.repository.findFixtureByTeamsAndKickoff({
            competitionId: competitionId as CompetitionId | null,
            homeTeamId: homeTeamId as TeamId,
            awayTeamId: awayTeamId as TeamId,
            kickoffAt: item.kickoffAt,
          })?.id ??
          null;
        const existing = matched
          ? this.repository.findFixture(matched as FixtureId)?.fixture
          : null;
        const now = nowUtc();
        const kickoffAt = item.kickoffAt
          ? toUtcDateString(new Date(item.kickoffAt))
          : null;
        const fixture: Fixture = existing
          ? {
              ...existing,
              status: item.status,
              homeScore: item.homeScore,
              awayScore: item.awayScore,
              updatedAt: now,
            }
          : {
              id: createId<'FixtureId'>(),
              competitionId: competitionId as CompetitionId | null,
              homeTeamId: homeTeamId as TeamId,
              awayTeamId: awayTeamId as TeamId,
              kickoffAt,
              status: item.status,
              homeScore: item.homeScore,
              awayScore: item.awayScore,
              liveMinute: null,
              sourceType: 'SYNCED',
              createdAt: now,
              updatedAt: now,
            };
        const details: FixtureResultDetails = {
          fixtureId: fixture.id,
          halfTimeHomeScore: item.halfTimeHomeScore,
          halfTimeAwayScore: item.halfTimeAwayScore,
          homeCorners: item.homeCorners,
          awayCorners: item.awayCorners,
          extraData: null,
          updatedAt: now,
        };
        this.repository.saveFixture(fixture, details);
        this.saveReference(providerId, 'FIXTURE', fixture.id, item.externalId);
        if (existing) updated += 1;
        else created += 1;
      } catch {
        failed += 1;
      }
    }

    return this.successCounters(
      external.length,
      created,
      updated,
      unresolved,
      failed,
    );
  }

  private async runSync(
    resourceType: SyncResource,
    scopeKey: string | null,
    operation: (providerRecord: {
      id: ProviderId;
    }) => Promise<SyncCounters> | SyncCounters,
  ): Promise<SyncResult> {
    const providerRecord = this.ensureProvider();
    const startedAt = nowUtc();
    let counters: SyncCounters;

    try {
      counters = await operation(providerRecord);
    } catch (error) {
      counters = {
        status: 'FAILED',
        processed: 0,
        created: 0,
        updated: 0,
        unresolved: 0,
        failed: 1,
        message:
          error instanceof Error ? error.message : 'Synchronization failed',
      };
    }

    const completedAt = nowUtc();
    this.repository.saveSyncRecord({
      id: createId<'SyncRecordId'>(),
      providerId: providerRecord.id,
      resourceType,
      scopeKey,
      status: counters.status,
      startedAt,
      completedAt,
      recordsProcessed: counters.processed,
      errorCode: counters.status === 'SUCCESS' ? null : counters.status,
      errorMessage: counters.message,
    });

    return {
      providerCode: this.requireProvider().code,
      resourceType,
      scopeKey,
      completedAt,
      ...counters,
    };
  }

  private ensureProvider() {
    const provider = this.requireProvider();
    return this.repository.ensureProvider({
      code: provider.code,
      displayName: provider.displayName,
      enabled: true,
    });
  }

  private requireProvider(): FootballDataProvider {
    if (!this.provider)
      throw new ProviderError('GOAL API provider is not configured');
    return this.provider;
  }

  private requireCompetition(id: string): Competition {
    const competition = this.repository.findCompetition(id as CompetitionId);
    if (!competition) throw new NotFoundError('Mapped competition not found');
    return competition;
  }

  private saveReference(
    providerId: ProviderId,
    entityType: 'COMPETITION' | 'TEAM' | 'FIXTURE',
    localEntityId: string,
    externalId: string,
  ): void {
    const now = nowUtc();
    const existing =
      this.repository.findProviderReference(
        providerId,
        entityType,
        externalId,
      ) ??
      this.repository.findProviderReferenceByLocal(
        providerId,
        entityType,
        localEntityId,
      );
    const reference: ProviderReference = {
      id: existing?.id ?? createId<'ProviderReferenceId'>(),
      providerId,
      entityType,
      localEntityId,
      externalId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.repository.saveProviderReference(reference);
  }

  private successCounters(
    processed: number,
    created: number,
    updated: number,
    unresolved: number,
    failed: number,
  ): SyncCounters {
    return {
      status: failed > 0 || unresolved > 0 ? 'PARTIAL' : 'SUCCESS',
      processed,
      created,
      updated,
      unresolved,
      failed,
      message:
        failed > 0 || unresolved > 0
          ? 'Some provider records could not be synchronized safely'
          : null,
    };
  }
}

function filterCompetitionsByName(
  competitions: ExternalCompetition[],
  names: string[] | undefined,
): ExternalCompetition[] {
  const targets = names
    ? names.map((name) => ({ name, regions: [] as string[] }))
    : defaultCompetitionTargets;
  return competitions.filter((competition) => {
    const keys = competitionNameKeys(competition.name);
    return targets.some((target) => {
      const nameMatches = competitionNameKeys(target.name).some((key) =>
        keys.includes(key),
      );
      if (!nameMatches) return false;
      if (target.regions.length === 0) return true;
      const region = normalizeName(competition.regionName ?? '');
      return target.regions.map(normalizeName).includes(region);
    });
  });
}

function competitionNameKeys(name: string): string[] {
  const normalized = normalizeName(name);
  const aliases: Record<string, string[]> = {
    'liga 1': ['ligue 1'],
    'ligue 1': ['liga 1'],
    laliga: ['la liga'],
    'la liga': ['laliga'],
    'série a': ['serie a'],
    'serie a': ['série a'],
    'liga portugal betclic': ['primeira liga'],
    'primeira liga': ['liga portugal betclic'],
    'liga dos campeões': ['uefa champions league', 'champions league'],
    'liga dos campeoes': ['uefa champions league', 'champions league'],
    'uefa champions league': [
      'liga dos campeões',
      'liga dos campeoes',
      'champions league',
    ],
    'liga europa': ['uefa europa league', 'europa league'],
    'uefa europa league': ['liga europa', 'europa league'],
    'liga conferência': [
      'uefa conference league',
      'conference league',
      'uefa europa conference league',
    ],
    'liga conferencia': [
      'uefa conference league',
      'conference league',
      'uefa europa conference league',
    ],
    'uefa conference league': [
      'liga conferência',
      'liga conferencia',
      'uefa europa conference league',
    ],
    'liga das nações': ['uefa nations league', 'nations league'],
    'liga das nacoes': ['uefa nations league', 'nations league'],
    'uefa nations league': [
      'liga das nações',
      'liga das nacoes',
      'nations league',
    ],
  };
  return [normalized, ...(aliases[normalized] ?? [])].map(normalizeName);
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function combineSyncResults(
  results: SyncResult[],
  scopeKey: string,
): SyncResult {
  const first = results[0];
  return {
    providerCode: first?.providerCode ?? 'GOAL_API',
    resourceType: 'TEAMS',
    scopeKey,
    status: results.some((result) => result.status === 'FAILED')
      ? 'FAILED'
      : results.some((result) => result.status === 'PARTIAL')
        ? 'PARTIAL'
        : 'SUCCESS',
    processed: results.reduce((sum, result) => sum + result.processed, 0),
    created: results.reduce((sum, result) => sum + result.created, 0),
    updated: results.reduce((sum, result) => sum + result.updated, 0),
    unresolved: results.reduce((sum, result) => sum + result.unresolved, 0),
    failed: results.reduce((sum, result) => sum + result.failed, 0),
    message: results.some((result) => result.message)
      ? 'Some competitions could not be synchronized completely'
      : null,
    completedAt: results.at(-1)?.completedAt ?? nowUtc(),
  };
}
