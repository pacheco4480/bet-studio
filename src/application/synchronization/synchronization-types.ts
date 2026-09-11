import type {
  Competition,
  Fixture,
  FixtureResultDetails,
  Provider,
  ProviderEntityType,
  ProviderReference,
  SyncRecord,
  Team,
} from '../../domain/core/types.js';
import type {
  CompetitionId,
  FixtureId,
  ProviderId,
  TeamId,
} from '../../domain/shared/ids.js';

export type SyncResource = 'COMPETITIONS' | 'TEAMS' | 'FIXTURES' | 'RESULTS';

export type SyncResult = {
  providerCode: string;
  resourceType: SyncResource;
  scopeKey: string | null;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  processed: number;
  created: number;
  updated: number;
  unresolved: number;
  failed: number;
  message: string | null;
  completedAt: string;
};

export type SyncRepository = {
  ensureProvider(
    provider: Pick<Provider, 'code' | 'displayName' | 'enabled'>,
  ): Provider;
  findProviderByCode(code: string): Provider | null;
  findProviderReference(
    providerId: ProviderId,
    entityType: ProviderEntityType,
    externalId: string,
  ): ProviderReference | null;
  findProviderReferenceByLocal(
    providerId: ProviderId,
    entityType: ProviderEntityType,
    localEntityId: string,
  ): ProviderReference | null;
  findCompetitionByNameAndRegion(
    name: string,
    regionName: string | null,
  ): Competition | null;
  saveProviderReference(reference: ProviderReference): void;
  findCompetition(id: CompetitionId): Competition | null;
  listActiveCompetitions(): Competition[];
  findTeam(id: TeamId): Team | null;
  findFixture(
    id: FixtureId,
  ): { fixture: Fixture; details: FixtureResultDetails | null } | null;
  findTeamByNormalizedAlias(value: string): Team[];
  findFixtureByTeamsAndKickoff(input: {
    competitionId: CompetitionId | null;
    homeTeamId: TeamId;
    awayTeamId: TeamId;
    kickoffAt: string | null;
  }): Fixture | null;
  saveCompetition(competition: Competition): void;
  saveTeam(team: Team): void;
  assignTeamToCompetition(teamId: TeamId, competitionId: CompetitionId): void;
  saveFixture(fixture: Fixture, details?: FixtureResultDetails): void;
  saveSyncRecord(record: SyncRecord): void;
  lastSuccessfulSyncAt(
    providerId: ProviderId,
    resourceType?: SyncResource,
  ): string | null;
};
